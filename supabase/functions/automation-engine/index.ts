import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const isServiceRole = authHeader === `Bearer ${serviceRoleKey}`;
  const cronSecret = Deno.env.get("CRON_SECRET");
  const isCronCall = cronSecret && req.headers.get("x-cron-secret") === cronSecret;

  if (!isServiceRole && !isCronCall) {
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const isAnonCron = authHeader === `Bearer ${anonKey}`;
    if (!isAnonCron) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    serviceRoleKey
  );

  const results = { escalated: 0, reprioritized: 0, reassigned: 0, alerts: 0 };

  try {
    // ─── 1. AUTO-ESCALATE: SLA overdue work items ───
    const { data: overdueItems } = await supabase
      .from("work_items")
      .select("id, title, assigned_to, priority, due_at, status, item_type")
      .in("status", ["open", "claimed", "in_progress"])
      .not("due_at", "is", null)
      .lt("due_at", new Date().toISOString());

    for (const item of overdueItems || []) {
      const newPriority = item.priority === "low" ? "medium" : "high";
      await supabase
        .from("work_items")
        .update({ priority: newPriority, updated_at: new Date().toISOString() })
        .eq("id", item.id);

      await supabase.from("automation_logs").insert({
        action_type: "escalate",
        target_type: "work_item",
        target_id: item.id,
        reason: `SLA överskriden. Prioritet höjd till ${newPriority}.`,
        details: { old_priority: item.priority, new_priority: newPriority },
      });

      const { data: admins } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("role", ["admin", "founder"]);

      for (const a of admins || []) {
        await supabase.from("notifications").insert({
          user_id: a.user_id,
          type: "urgent",
          message: `⏰ Auto-eskalerad: ${item.title}`,
          related_id: item.id,
          related_type: "work_item",
        });
      }
      results.escalated++;
    }

    // ─── 2. AUTO-ESCALATE: SLA overdue incidents (sync) ───
    const { data: overdueIncidents } = await supabase
      .from("order_incidents")
      .select("id, title, priority, sla_deadline, status, assigned_to")
      .in("status", ["open", "investigating"])
      .not("sla_deadline", "is", null)
      .lt("sla_deadline", new Date().toISOString());

    for (const inc of overdueIncidents || []) {
      await supabase
        .from("order_incidents")
        .update({
          priority: "high",
          sla_status: "overdue",
          escalated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", inc.id);

      // Also escalate linked work_item
      await supabase
        .from("work_items")
        .update({ priority: "high", status: "escalated", updated_at: new Date().toISOString() })
        .eq("source_type", "order_incident")
        .eq("source_id", inc.id);

      await supabase.from("automation_logs").insert({
        action_type: "escalate",
        target_type: "work_item",
        target_id: inc.id,
        reason: `SLA-deadline passerad. Eskalerat till hög prioritet.`,
      });
      results.escalated++;
    }

    // ─── 3. AUTO-REASSIGN: Claimed but idle > 10min ───
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: idleClaimed } = await supabase
      .from("work_items")
      .select("id, title, assigned_to, claimed_by, claimed_at, item_type")
      .eq("status", "claimed")
      .not("claimed_at", "is", null)
      .lt("claimed_at", tenMinAgo);

    for (const item of idleClaimed || []) {
      await supabase.from("work_items").update({
        status: "open",
        assigned_to: null,
        claimed_by: null,
        claimed_at: null,
        updated_at: new Date().toISOString(),
      }).eq("id", item.id);

      await supabase.from("automation_logs").insert({
        action_type: "reassign",
        target_type: "work_item",
        target_id: item.id,
        reason: `Claimed i >10min utan start. Återställd till öppen.`,
        details: { old_assignee: item.claimed_by },
      });

      if (item.claimed_by) {
        await supabase.from("notifications").insert({
          user_id: item.claimed_by,
          type: "info",
          message: `🔄 Uppgift timeout: ${item.title}`,
          related_id: item.id,
          related_type: "work_item",
        });
      }
      results.reassigned++;
    }

    // ─── 3b. AUTO-REASSIGN: in_progress but idle > 60min ───
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: idleInProgress } = await supabase
      .from("work_items")
      .select("id, title, assigned_to, claimed_by, updated_at, item_type")
      .eq("status", "in_progress")
      .lt("updated_at", oneHourAgo);

    for (const item of idleInProgress || []) {
      await supabase.from("work_items").update({
        status: "open",
        assigned_to: null,
        claimed_by: null,
        claimed_at: null,
        updated_at: new Date().toISOString(),
      }).eq("id", item.id);

      await supabase.from("automation_logs").insert({
        action_type: "reassign",
        target_type: "work_item",
        target_id: item.id,
        reason: `In progress >60min utan aktivitet. Återställd till öppen.`,
        details: { old_assignee: item.claimed_by },
      });

      if (item.claimed_by) {
        await supabase.from("notifications").insert({
          user_id: item.claimed_by,
          type: "info",
          message: `🔄 Uppgift timeout (inaktiv >1h): ${item.title}`,
          related_id: item.id,
          related_type: "work_item",
        });
      }
      results.reassigned++;
    }

    // ─── 4. AUTO-REPRIORITIZE: High value orders ───
    const { data: highValueOrders } = await supabase
      .from("orders")
      .select("id, total_amount")
      .eq("payment_status", "paid")
      .in("fulfillment_status", ["pending", "unfulfilled"])
      .gte("total_amount", 500);

    for (const order of highValueOrders || []) {
      const { data: relatedItems } = await supabase
        .from("work_items")
        .select("id, priority")
        .eq("related_order_id", order.id)
        .neq("priority", "high")
        .in("status", ["open", "claimed", "in_progress"]);

      for (const item of relatedItems || []) {
        await supabase
          .from("work_items")
          .update({ priority: "high", updated_at: new Date().toISOString() })
          .eq("id", item.id);

        await supabase.from("automation_logs").insert({
          action_type: "reprioritize",
          target_type: "work_item",
          target_id: item.id,
          reason: `Hög ordervärde (${order.total_amount} kr). Prioritet höjd.`,
          details: { order_id: order.id, order_amount: order.total_amount },
        });
        results.reprioritized++;
      }
    }

    // ─── 5. AUTO-CLEANUP: Cancel orphan work items (order deleted) ───
    const { data: orphanItems } = await supabase
      .from("work_items")
      .select("id, related_order_id")
      .not("related_order_id", "is", null)
      .in("status", ["open", "claimed", "in_progress", "escalated"]);

    let orphansCancelled = 0;
    for (const item of orphanItems || []) {
      const { data: order } = await supabase
        .from("orders")
        .select("id, deleted_at")
        .eq("id", item.related_order_id!)
        .single();

      if (!order || order.deleted_at) {
        await supabase.from("work_items").update({
          status: "cancelled",
          updated_at: new Date().toISOString(),
        }).eq("id", item.id);

        await supabase.from("automation_logs").insert({
          action_type: "cleanup",
          target_type: "work_item",
          target_id: item.id,
          reason: "Order raderad – uppgift automatiskt avbruten.",
        });
        orphansCancelled++;
      }
    }
    results.reassigned += orphansCancelled;

    // ─── 5b. STOCK INTELLIGENCE: Update sales velocity ───
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: activeProducts } = await supabase
      .from("products")
      .select("id, title_sv, stock, low_stock_threshold, status")
      .eq("status", "active");

    for (const prod of activeProducts || []) {
      const { data: orders7d } = await supabase
        .from("orders")
        .select("items")
        .eq("payment_status", "paid")
        .gte("created_at", sevenDaysAgo);

      const { data: orders30d } = await supabase
        .from("orders")
        .select("items")
        .eq("payment_status", "paid")
        .gte("created_at", thirtyDaysAgo);

      let sold7d = 0, sold30d = 0;
      for (const o of orders7d || []) {
        const items = Array.isArray(o.items) ? o.items : [];
        for (const item of items) {
          if ((item as any)?.product_id === prod.id) sold7d += (item as any)?.quantity || 1;
        }
      }
      for (const o of orders30d || []) {
        const items = Array.isArray(o.items) ? o.items : [];
        for (const item of items) {
          if ((item as any)?.product_id === prod.id) sold30d += (item as any)?.quantity || 1;
        }
      }

      await supabase.from("products").update({
        units_sold_7d: sold7d,
        units_sold_30d: sold30d,
      }).eq("id", prod.id);

      if (prod.stock <= prod.low_stock_threshold && prod.stock > 0) {
        const { data: admins } = await supabase
          .from("user_roles")
          .select("user_id")
          .in("role", ["admin", "founder"]);

        for (const a of admins || []) {
          const { data: recent } = await supabase
            .from("notifications")
            .select("id")
            .eq("user_id", a.user_id)
            .ilike("message", `%${prod.title_sv}%lager%`)
            .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
            .limit(1);

          if (!recent?.length) {
            await supabase.from("notifications").insert({
              user_id: a.user_id,
              type: "warning",
              message: `📦 Lågt lager: ${prod.title_sv} (${prod.stock} kvar)`,
              related_type: "product",
              related_id: prod.id,
            });
            results.alerts++;
          }
        }
      }
    }

    // ─── 6. AUTO-ALERTS: Bottleneck detection ───
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: stuckOrders, count: stuckCount } = await supabase
      .from("orders")
      .select("id", { count: "exact" })
      .eq("payment_status", "paid")
      .eq("fulfillment_status", "pending")
      .lt("created_at", oneDayAgo);

    if ((stuckCount || 0) >= 5) {
      const { data: admins } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("role", ["admin", "founder"]);

      for (const a of admins || []) {
        const { data: recent } = await supabase
          .from("notifications")
          .select("id")
          .eq("user_id", a.user_id)
          .eq("type", "urgent")
          .ilike("message", "%orders fastnar%")
          .gte("created_at", new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString())
          .limit(1);

        if (!recent?.length) {
          await supabase.from("notifications").insert({
            user_id: a.user_id,
            type: "urgent",
            message: `🚨 ${stuckCount} orders fastnar i pending >24h`,
            related_type: "alert",
          });
          results.alerts++;
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Automation engine error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
