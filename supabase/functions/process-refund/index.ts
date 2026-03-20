import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");

    if (!stripeKey) {
      return new Response(JSON.stringify({ error: "Stripe not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify auth - must be admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    
    const { data: { user }, error: authError } = await anonClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin role
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["admin", "founder", "it"]);

    if (!roles || roles.length === 0) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { order_id } = await req.json();

    if (!order_id) {
      return new Response(JSON.stringify({ error: "Missing order_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get order
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("*")
      .eq("id", order_id)
      .single();

    if (orderError || !order) {
      return new Response(JSON.stringify({ error: "Order not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (order.payment_status !== "paid") {
      return new Response(JSON.stringify({ error: "Order not paid" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (order.refund_status === "refunded") {
      return new Response(JSON.stringify({ error: "Already refunded" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Try Stripe refund if we have payment_intent_id
    let stripeRefundId = null;
    if (order.payment_intent_id) {
      try {
        const refundRes = await fetch("https://api.stripe.com/v1/refunds", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${stripeKey}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: `payment_intent=${order.payment_intent_id}`,
        });
        const refundData = await refundRes.json();
        if (refundData.id) {
          stripeRefundId = refundData.id;
        } else {
          console.error("Stripe refund failed:", refundData);
        }
      } catch (e) {
        console.error("Stripe refund error:", e);
      }
    }

    // Update order in DB
    const existingHistory = Array.isArray(order.status_history) ? order.status_history : [];
    const newHistory = [
      ...existingHistory,
      {
        status: "refunded",
        timestamp: new Date().toISOString(),
        note: stripeRefundId
          ? `Återbetald via Stripe (${stripeRefundId})`
          : "Manuellt markerad som återbetald av admin",
      },
    ];

    const { error: updateError } = await supabase
      .from("orders")
      .update({
        refund_status: "refunded",
        refund_amount: order.total_amount,
        refunded_at: new Date().toISOString(),
        status_history: newHistory,
      })
      .eq("id", order_id);

    if (updateError) throw updateError;

    // Log activity
    await supabase.from("activity_logs").insert({
      log_type: "warning",
      category: "admin",
      message: `Order ${order.order_number || order_id.slice(0, 8)} återbetald${stripeRefundId ? " via Stripe" : " manuellt"}`,
      details: {
        amount: order.total_amount,
        stripe_refund_id: stripeRefundId,
        admin_user: user.email,
      },
      order_id,
      user_id: user.id,
    });

    return new Response(
      JSON.stringify({
        success: true,
        stripe_refund_id: stripeRefundId,
        amount: order.total_amount,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Refund error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
