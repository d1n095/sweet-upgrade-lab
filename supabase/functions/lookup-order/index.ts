import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json().catch(() => ({}));
    const sessionId = (body.session_id || "").trim();
    const query = (body.query || "").trim();
    const email = (body.email || "").trim().toLowerCase();

    if (!sessionId && !query && !email) {
      return json({ error: "Missing session_id, query or email" }, 400);
    }

    // Build search — service role bypasses RLS
    let dbQuery = supabase
      .from("orders")
      .select(
        "id, order_number, shopify_order_number, stripe_session_id, order_email, status, tracking_number, estimated_delivery, created_at, items, total_amount, currency, shipping_address, payment_status, payment_method",
      )
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(1);

    // Prefer explicit session lookup for confirmation page
    if (sessionId) {
      dbQuery = dbQuery.eq("stripe_session_id", sessionId);
    } else if (query) {
      const orFilters = [
        `order_number.eq.${query}`,
        `shopify_order_number.eq.${query}`,
        `tracking_number.eq.${query}`,
        `stripe_session_id.eq.${query}`,
      ];
      dbQuery = dbQuery.or(orFilters.join(","));
    } else if (email) {
      // Email-only search — return latest order for that email
      dbQuery = dbQuery.eq("order_email", email);
    }

    const { data, error } = await dbQuery;

    if (error) {
      console.error("[lookup-order] DB error:", error);
      return json({ error: "Search failed" }, 500);
    }

    if (!data || data.length === 0) {
      return json({ found: false });
    }

    const order = data[0];

    // If email was provided, verify it matches (prevents enumeration)
    if (email && order.order_email.toLowerCase() !== email) {
      return json({ found: false });
    }

    // Strip sensitive fields
    return json({
      found: true,
      order: {
        id: order.id,
        order_number: order.order_number,
        shopify_order_number: order.shopify_order_number,
        order_email: order.order_email,
        status: order.status,
        tracking_number: order.tracking_number,
        estimated_delivery: order.estimated_delivery,
        created_at: order.created_at,
        items: order.items,
        total_amount: order.total_amount,
        currency: order.currency,
        shipping_address: order.shipping_address,
        payment_status: order.payment_status,
      },
    });
  } catch (err: any) {
    console.error("[lookup-order] Error:", err);
    return json({ error: "Internal error" }, 500);
  }
});
