// erp-book-order: skapar dubbla verifikationer i ledger_entries när en order betalas.
// Anropas från Stripe webhook eller manuellt av admin/finance.
// Payment isolation: läser endast från orders (SSOT), aldrig direkt från Stripe.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod";

const BodySchema = z.object({
  order_id: z.string().uuid(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";

    // Auth: staff (finance/founder) OR service-role internal call
    const isServiceRole = authHeader === `Bearer ${serviceKey}`;
    let userId: string | null = null;
    if (!isServiceRole) {
      const authed = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
      const { data: u } = await authed.auth.getUser();
      if (!u?.user) {
        return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      userId = u.user.id;
      const { data: allowed } = await authed.rpc("is_finance_or_founder", { _user_id: userId });
      if (!allowed) {
        return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten() }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const svc = createClient(url, serviceKey);
    const { data: order, error: orderErr } = await svc
      .from("orders")
      .select("id, total, payment_status, deleted_at, status, created_at, human_ref, currency")
      .eq("id", parsed.data.order_id)
      .single();
    if (orderErr) throw orderErr;
    if (!order || order.deleted_at) throw new Error("order not found or deleted");
    if (order.payment_status !== "paid") {
      return new Response(JSON.stringify({ error: "order not paid", payment_status: order.payment_status }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Idempotency: check if already booked
    const { data: existing } = await svc
      .from("ledger_entries")
      .select("id")
      .eq("source_type", "order")
      .eq("source_id", order.id)
      .limit(1);
    if (existing && existing.length > 0) {
      return new Response(JSON.stringify({ ok: true, already_booked: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const total = Number(order.total ?? 0);
    const vatRate = 0.25; // Sverige 25% standard
    const exVat = Math.round((total / (1 + vatRate)) * 100) / 100;
    const vat = Math.round((total - exVat) * 100) / 100;
    const period = new Date(order.created_at as string).toISOString().slice(0, 7); // YYYY-MM

    const { data: verifData, error: verifErr } = await svc.rpc("next_verification_number");
    if (verifErr) throw verifErr;
    const verif = verifData as string;

    const rows = [
      {
        verification_number: verif,
        account: "1930",
        account_name: "Företagskonto (bank)",
        debit: total,
        credit: 0,
        description: `Order ${order.human_ref ?? order.id}`,
        source_type: "order",
        source_id: order.id,
        order_id: order.id,
        fiscal_period: period,
        currency: order.currency ?? "SEK",
      },
      {
        verification_number: verif,
        account: "3001",
        account_name: "Försäljning varor 25%",
        debit: 0,
        credit: exVat,
        description: `Order ${order.human_ref ?? order.id}`,
        source_type: "order",
        source_id: order.id,
        order_id: order.id,
        fiscal_period: period,
        currency: order.currency ?? "SEK",
      },
      {
        verification_number: verif,
        account: "2611",
        account_name: "Utgående moms 25%",
        debit: 0,
        credit: vat,
        description: `Moms order ${order.human_ref ?? order.id}`,
        source_type: "order",
        source_id: order.id,
        order_id: order.id,
        fiscal_period: period,
        currency: order.currency ?? "SEK",
      },
    ];

    const { error: insErr } = await svc.from("ledger_entries").insert(rows);
    if (insErr) throw insErr;

    return new Response(JSON.stringify({ ok: true, verification_number: verif, entries: rows.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
