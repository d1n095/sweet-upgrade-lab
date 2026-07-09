import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const productId = String(body.product_id ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const name = body.name ? String(body.name).trim().slice(0, 120) : null;
    const phone = body.phone ? String(body.phone).trim().slice(0, 40) : null;
    const note = body.note ? String(body.note).trim().slice(0, 500) : null;
    const quantity = Math.max(1, Math.min(20, parseInt(body.quantity ?? 1, 10) || 1));

    if (!productId || !/^[0-9a-f-]{36}$/i.test(productId)) {
      return new Response(JSON.stringify({ error: "invalid product_id" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({ error: "invalid email" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: product, error: pErr } = await admin
      .from("products")
      .select("id,title_sv,is_prebuy,is_visible")
      .eq("id", productId)
      .maybeSingle();
    if (pErr || !product) {
      return new Response(JSON.stringify({ error: "product not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!product.is_prebuy) {
      return new Response(JSON.stringify({ error: "product is not open for prebuy" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Try to attribute to a signed-in user if a JWT is provided
    let userId: string | null = null;
    const auth = req.headers.get("Authorization");
    if (auth?.startsWith("Bearer ")) {
      const jwt = auth.slice(7);
      const { data } = await admin.auth.getUser(jwt);
      userId = data.user?.id ?? null;
    }

    const { data: inserted, error: insErr } = await admin
      .from("prebuy_reservations")
      .insert({ product_id: productId, user_id: userId, email, name, phone, note, quantity, status: "pending" })
      .select("id")
      .single();
    if (insErr) throw insErr;

    return new Response(JSON.stringify({ ok: true, id: inserted.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
