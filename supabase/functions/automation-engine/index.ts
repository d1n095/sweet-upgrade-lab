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

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const results = {
    escalated: 0,
    reprioritized: 0,
    reassigned: 0,
    alerts: 0,
  };

  try {
    // ─── 1. AUTO-ESCALATE: SLA overdue tasks ───
    const { data: overdueTasks } = await supabase
      .from("staff_tasks")
      .select("id, title, assigned_to, priority, due_at, status, task_type")
      .in("status", ["open", "claimed", "in_progress"])
      .not("due_at", "is", null)
      .lt("due_at", new Date().toISOString());

    for (const task of overdueTasks || []) {
      // Escalate priority
      const newPriority = task.priority === "low" ? "medium" : "high";
      await supabase
        .from("staff_tasks")
        .update({ priority: newPriority, updated_at: new Date().toISOString() })
        .eq("id", task.id);

      // Log
      await supabase.from("automation_logs").insert({
        action_type: "escalate",
        target_type: "task",
        target_id: task.id,
        reason: `SLA överskriden. Prioritet höjd till ${newPriority}.`,
        details: { old_priority: task.priority, new_priority: newPriority },
      });

      // Notify admins
      const { data: admins } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("role", ["admin", "founder"]);

      for (const a of admins || []) {
        await supabase.from("notifications").insert({
          user_id: a.user_id,
          type: "urgent",
          message: `⏰ Auto-eskalerad: ${task.title}`,
          related_id: task.id,
          related_type: "task",
        });
      }
      results.escalated++;
    }

    // ─── 2. AUTO-ESCALATE: SLA overdue incidents ───
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

      await supabase.from("automation_logs").insert({
        action_type: "escalate",
        target_type: "incident",
        target_id: inc.id,
        reason: `SLA-deadline passerad. Eskalerat till hög prioritet.`,
      });
      results.escalated++;
    }

    // ─── 3. AUTO-REASSIGN: Claimed but idle > 2h ───
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const { data: idleTasks } = await supabase
      .from("staff_tasks")
      .select("id, title, assigned_to, claimed_by, claimed_at, task_type")
      .eq("status", "claimed")
      .not("claimed_at", "is", null)
      .lt("claimed_at", twoHoursAgo);

    for (const task of idleTasks || []) {
      // Find new assignee
      const { data: newAssignee } = await supabase.rpc("auto_assign_task", {
        p_task_type: task.task_type,
      });

      const updates: Record<string, any> = {
        status: "open",
        assigned_to: newAssignee || null,
        claimed_by: null,
        claimed_at: null,
        updated_at: new Date().toISOString(),
      };

      if (newAssignee) {
        updates.status = "open";
        updates.assigned_to = newAssignee;
      }

      await supabase.from("staff_tasks").update(updates).eq("id", task.id);

      await supabase.from("automation_logs").insert({
        action_type: "reassign",
        target_type: "task",
        target_id: task.id,
        reason: `Claimed i >2h utan aktivitet. Omfördelad.`,
        details: {
          old_assignee: task.claimed_by,
          new_assignee: newAssignee,
        },
      });

      // Notify old assignee
      if (task.claimed_by) {
        await supabase.from("notifications").insert({
          user_id: task.claimed_by,
          type: "info",
          message: `🔄 Uppgift omfördelad: ${task.title}`,
          related_id: task.id,
          related_type: "task",
        });
      }
      results.reassigned++;
    }

    // ─── 4. AUTO-REPRIORITIZE: High value orders with incidents ───
    const { data: highValueOrders } = await supabase
      .from("orders")
      .select("id, total_amount")
      .eq("payment_status", "paid")
      .in("fulfillment_status", ["pending", "unfulfilled"])
      .gte("total_amount", 500);

    for (const order of highValueOrders || []) {
      // Check if related tasks exist and are not already high
      const { data: relatedTasks } = await supabase
        .from("staff_tasks")
        .select("id, priority")
        .eq("related_order_id", order.id)
        .neq("priority", "high")
        .in("status", ["open", "claimed", "in_progress"]);

      for (const task of relatedTasks || []) {
        await supabase
          .from("staff_tasks")
          .update({ priority: "high", updated_at: new Date().toISOString() })
          .eq("id", task.id);

        await supabase.from("automation_logs").insert({
          action_type: "reprioritize",
          target_type: "task",
          target_id: task.id,
          reason: `Hög ordervärde (${order.total_amount} kr). Prioritet höjd.`,
          details: { order_id: order.id, order_amount: order.total_amount },
        });
        results.reprioritized++;
      }
    }

    // ─── 5. AUTO-ALERTS: Bottleneck detection ───
    // Alert if >5 orders stuck in same status for >24h
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
        // Avoid duplicate alerts: check recent
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
