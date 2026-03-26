import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

async function logRuntimeTrace(source: string, function_name: string, endpoint: string, error_message: string, payload_snapshot: any) {
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    await sb.from("runtime_traces").insert({
      source, function_name, endpoint, error_message,
      payload_snapshot: typeof payload_snapshot === "object" ? JSON.parse(JSON.stringify(payload_snapshot, (_, v) => typeof v === "string" && v.length > 200 ? v.slice(0, 200) + "…" : v)) : {},
    });
  } catch (_) {}
}

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

    // Verify auth
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

    const body = await req.json();
    const { action, refund_request_id, order_id, reason } = body;

    // Check user role
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["admin", "founder", "it", "moderator", "support", "manager"]);

    if (!roles || roles.length === 0) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isAdmin = roles.some(r => ["admin", "founder", "it"].includes(r.role as string));

    // ACTION: create_request — any staff can do this
    if (action === "create_request") {
      if (!order_id || !reason) {
        return new Response(JSON.stringify({ error: "Missing order_id or reason" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: order } = await supabase
        .from("orders")
        .select("id, payment_status, refund_status, total_amount")
        .eq("id", order_id)
        .single();

      if (!order) {
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

      // Check no pending request exists
      const { data: existing } = await supabase
        .from("refund_requests")
        .select("id")
        .eq("order_id", order_id)
        .eq("status", "pending")
        .limit(1);

      if (existing && existing.length > 0) {
        return new Response(JSON.stringify({ error: "Pending request already exists" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: request, error: insertErr } = await supabase
        .from("refund_requests")
        .insert({
          order_id,
          requested_by: user.id,
          reason,
          refund_amount: order.total_amount,
          status: "pending",
        })
        .select()
        .single();

      if (insertErr) throw insertErr;

      await supabase.from("activity_logs").insert({
        log_type: "info",
        category: "admin",
        message: `Återbetalningsförfrågan skapad för order ${order_id.slice(0, 8)}`,
        details: { reason, amount: order.total_amount, requested_by: user.email },
        order_id,
        user_id: user.id,
      });

      return new Response(JSON.stringify({ success: true, request }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ACTION: approve — only admin can do this
    if (action === "approve") {
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: "Only admins can approve refunds" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!refund_request_id) {
        return new Response(JSON.stringify({ error: "Missing refund_request_id" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: request } = await supabase
        .from("refund_requests")
        .select("*, orders!inner(id, payment_intent_id, total_amount, payment_status, refund_status, order_number, status_history)")
        .eq("id", refund_request_id)
        .eq("status", "pending")
        .single();

      if (!request) {
        return new Response(JSON.stringify({ error: "Request not found or not pending" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const order = (request as any).orders;

      if (order.payment_status !== "paid" || order.refund_status === "refunded") {
        return new Response(JSON.stringify({ error: "Order not eligible for refund" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Execute Stripe refund
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
            // Update request as rejected if Stripe fails
            await supabase.from("refund_requests").update({
              status: "rejected",
              admin_notes: `Stripe error: ${JSON.stringify(refundData.error?.message || refundData)}`,
              approved_by: user.id,
              processed_at: new Date().toISOString(),
            }).eq("id", refund_request_id);

            return new Response(JSON.stringify({ error: "Stripe refund failed", details: refundData }), {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        } catch (e) {
          console.error("Stripe refund error:", e);
          return new Response(JSON.stringify({ error: "Stripe connection failed" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      // Update order
      const existingHistory = Array.isArray(order.status_history) ? order.status_history : [];
      const newHistory = [
        ...existingHistory,
        {
          status: "refunded",
          timestamp: new Date().toISOString(),
          note: stripeRefundId
            ? `Återbetald via Stripe (${stripeRefundId})`
            : "Manuellt godkänd återbetalning",
        },
      ];

      await supabase.from("orders").update({
        refund_status: "refunded",
        refund_amount: order.total_amount,
        refunded_at: new Date().toISOString(),
        status_history: newHistory,
      }).eq("id", order.id);

      // Update request
      await supabase.from("refund_requests").update({
        status: "approved",
        approved_by: user.id,
        stripe_refund_id: stripeRefundId,
        processed_at: new Date().toISOString(),
      }).eq("id", refund_request_id);

      // Log
      await supabase.from("activity_logs").insert({
        log_type: "warning",
        category: "admin",
        message: `Återbetalning godkänd för order ${order.order_number || order.id.slice(0, 8)}${stripeRefundId ? " via Stripe" : ""}`,
        details: {
          amount: order.total_amount,
          stripe_refund_id: stripeRefundId,
          approved_by: user.email,
          request_id: refund_request_id,
        },
        order_id: order.id,
        user_id: user.id,
      });

      return new Response(JSON.stringify({
        success: true,
        stripe_refund_id: stripeRefundId,
        amount: order.total_amount,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ACTION: reject — only admin
    if (action === "reject") {
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: "Only admins can reject refunds" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!refund_request_id) {
        return new Response(JSON.stringify({ error: "Missing refund_request_id" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabase.from("refund_requests").update({
        status: "rejected",
        approved_by: user.id,
        admin_notes: body.admin_notes || null,
        processed_at: new Date().toISOString(),
      }).eq("id", refund_request_id).eq("status", "pending");

      await supabase.from("activity_logs").insert({
        log_type: "info",
        category: "admin",
        message: `Återbetalningsförfrågan avvisad`,
        details: { request_id: refund_request_id, rejected_by: user.email, reason: body.admin_notes },
        user_id: user.id,
      });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action. Use: create_request, approve, reject" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Refund error:", err);
    await logRuntimeTrace("api", "process-refund", "/process-refund", err?.message || "Unknown", { stack: err?.stack?.slice(0, 500) });
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
