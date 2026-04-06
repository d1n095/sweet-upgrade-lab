import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

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

    // Rate-limit: require email for non-session lookups to prevent enumeration
    if (!sessionId && query && !email) {
      return json({ error: "Email required for order lookup" }, 400);
    }

    // Input validation
    if (sessionId && sessionId.length > 200) return json({ error: "Invalid session_id" }, 400);
    if (query && query.length > 100) return json({ error: "Invalid query" }, 400);
    if (email && (email.length > 255 || !email.includes("@"))) return json({ error: "Invalid email" }, 400);

    // Build search — service role bypasses RLS
    let dbQuery = supabase
      .from("orders")
      .select(
        "id, order_number, external_order_number, stripe_session_id, payment_intent_id, order_email, status, tracking_number, estimated_delivery, created_at, items, total_amount, currency, payment_status, payment_method",
      )
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(1);

    // Prefer explicit session lookup for confirmation page
    if (sessionId) {
      // Session lookup also requires email to prevent enumeration
      if (!email) {
        return json({ error: "Email required for session lookup" }, 400);
      }
      dbQuery = dbQuery.eq("stripe_session_id", sessionId).eq("order_email", email);
    } else if (query) {
      const orFilters = [
        `order_number.eq.${query}`,
        `external_order_number.eq.${query}`,
        `tracking_number.eq.${query}`,
      ];
      // Only allow session/payment ID lookup with email match
      dbQuery = dbQuery.or(orFilters.join(",")).eq("order_email", email);
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

    // Extra guard: verify email always matches
    if (email && order.order_email.toLowerCase() !== email) {
      return json({ found: false });
    }

    // Return ONLY safe fields — never shipping_address, never payment_intent_id
    return json({
      found: true,
      order: {
        id: order.id,
        order_number: order.order_number,
        stripe_session_id: order.stripe_session_id,
        status: order.status,
        tracking_number: order.tracking_number,
        estimated_delivery: order.estimated_delivery,
        created_at: order.created_at,
        items: order.items,
        total_amount: order.total_amount,
        currency: order.currency,
        payment_status: order.payment_status,
      },
    });
  } catch (err: any) {
    console.error("[lookup-order] Error:", err);
    return json({ error: "Internal error" }, 500);
  }
});
