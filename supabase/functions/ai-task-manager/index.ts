import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");

    if (!lovableKey) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Auth: accept service role, cron secret, or authenticated staff
    const authHeader = req.headers.get("authorization") || "";
    const isServiceRole = authHeader === `Bearer ${serviceKey}`;
    const cronSecret = Deno.env.get("CRON_SECRET");
    const isCron = cronSecret && req.headers.get("x-cron-secret") === cronSecret;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const isAnonCron = authHeader === `Bearer ${anonKey}`;

    if (!isServiceRole && !isCron && !isAnonCron) {
      const anonClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await anonClient.auth.getUser();
      if (!user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const supabase = createClient(supabaseUrl, serviceKey);
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      const staffRoles = ["admin", "founder", "it"];
      if (!roles?.some((r: any) => staffRoles.includes(r.role))) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    let body: any = {};
    try { body = await req.json(); } catch { /* empty body for cron */ }
    const action = body.action || "full_cycle";

    const results: any = {
      prioritized: 0,
      assigned: 0,
      detected: 0,
      resolved: 0,
      flagged: 0,
      orchestrated: 0,
      orchestrator_scanned: 0,
      orchestrator_mode: null,
      orchestrator_error: null,
    };

    // ─── 1. AI PRIORITIZATION ───
    if (action === "full_cycle" || action === "prioritize") {
      const { data: items } = await supabase
        .from("work_items")
        .select("id, title, description, priority, item_type, source_type, source_id, related_order_id, ai_confidence, status")
        .in("status", ["open", "claimed", "in_progress", "escalated"])
        .or("ai_confidence.is.null,ai_confidence.eq.none")
        .limit(20);

      if (items?.length) {
        const itemsSummary = items.map((it: any) =>
          `ID:${it.id} Type:${it.item_type} Title:${it.title} Desc:${it.description?.substring(0, 200) || "N/A"} CurrentPriority:${it.priority}`
        ).join("\n");

        try {
          const aiResult = await callAI(lovableKey, [
            {
              role: "system",
              content: `You are a task manager for a Swedish e-commerce platform. Analyze work items and:
1. Assign priority based on business impact
2. Classify the TYPE of each item:
   - bug: something is broken/not working
   - improvement: existing feature can be better
   - feature: new functionality request
   - upgrade: performance, security, scalability enhancement
   - task: manual/admin operational task

Priority rules:
- checkout/payment issues → critical
- order fulfillment issues → high  
- bugs affecting users → high
- UI issues → medium
- improvements/features → medium or low
- internal/manual tasks → low

Respond using the prioritize_tasks function.`,
            },
            { role: "user", content: `Prioritize and classify these work items:\n${itemsSummary}` },
          ], [{
            type: "function",
            function: {
              name: "prioritize_tasks",
              description: "Assign priorities and classify work items",
              parameters: {
                type: "object",
                properties: {
                  tasks: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "string" },
                        priority: { type: "string", enum: ["low", "medium", "high", "critical"] },
                        confidence: { type: "string", enum: ["low", "medium", "high"] },
                        category: { type: "string" },
                        reason: { type: "string" },
                        classification: { type: "string", enum: ["bug", "improvement", "feature", "upgrade", "task"] },
                        classification_reason: { type: "string", description: "Short explanation: why this type" },
                      },
                      required: ["id", "priority", "confidence", "category", "classification"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["tasks"],
                additionalProperties: false,
              },
            },
          }], { type: "function", function: { name: "prioritize_tasks" } });

          for (const task of aiResult?.tasks || []) {
            await supabase.from("work_items").update({
              priority: task.priority,
              ai_confidence: task.confidence,
              ai_category: task.category,
              ai_type_classification: task.classification || null,
              ai_type_reason: task.classification_reason || null,
              updated_at: new Date().toISOString(),
            }).eq("id", task.id);
            results.prioritized++;
          }
        } catch (e) {
          console.error("AI prioritization error:", e);
        }
      }
    }

    // ─── 2. AI AUTO-ASSIGN ───
    if (action === "full_cycle" || action === "assign") {
      const { data: unassigned } = await supabase
        .from("work_items")
        .select("id, item_type, ai_category, priority")
        .eq("status", "open")
        .is("assigned_to", null)
        .is("claimed_by", null)
        .limit(20);

      for (const item of unassigned || []) {
        const assignee = await autoAssign(supabase, item);
        if (assignee) {
          await supabase.from("work_items").update({
            assigned_to: assignee,
            ai_assigned: true,
            updated_at: new Date().toISOString(),
          }).eq("id", item.id);

          await supabase.from("notifications").insert({
            user_id: assignee,
            type: "task",
            message: `🤖 AI tilldelad uppgift: ${item.item_type}`,
            related_id: item.id,
            related_type: "work_item",
          });
          results.assigned++;
        }
      }
    }

    // ─── 3. AI AUTO-DETECTION ───
    if (action === "full_cycle" || action === "detect") {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

      const { data: recentErrors } = await supabase
        .from("analytics_events")
        .select("event_type, event_data, created_at")
        .in("event_type", ["checkout_abandon", "payment_error", "page_error"])
        .gte("created_at", oneHourAgo)
        .limit(100);

      const errorCounts: Record<string, number> = {};
      for (const evt of recentErrors || []) {
        errorCounts[evt.event_type] = (errorCounts[evt.event_type] || 0) + 1;
      }

      for (const [eventType, count] of Object.entries(errorCounts)) {
        if (count < 3) continue;

        const { data: existing } = await supabase
          .from("work_items")
          .select("id")
          .eq("ai_detected", true)
          .eq("item_type", "anomaly")
          .ilike("title", `%${eventType}%`)
          .in("status", ["open", "claimed", "in_progress"])
          .limit(1);

        if (!existing?.length) {
          const priority = eventType.includes("payment") || eventType.includes("checkout")
            ? "critical" : "high";

          await supabase.from("work_items").insert({
            title: `AI: ${count}x ${eventType} senaste timmen`,
            description: `Automatiskt detekterat: ${count} ${eventType}-händelser under senaste timmen.`,
            status: "open",
            priority,
            item_type: "anomaly",
            source_type: "ai_detection",
            ai_detected: true,
            ai_confidence: priority === "critical" ? "high" : "medium",
            ai_category: eventType.includes("payment") ? "payment" : eventType.includes("checkout") ? "checkout" : "system",
          });
          results.detected++;
        }
      }

      // Stuck orders
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: stuckOrders } = await supabase
        .from("orders")
        .select("id, order_number, created_at, total_amount")
        .eq("payment_status", "paid")
        .in("fulfillment_status", ["pending", "unfulfilled"])
        .is("deleted_at", null)
        .lt("created_at", oneDayAgo)
        .limit(10);

      for (const order of stuckOrders || []) {
        const { data: existingItem } = await supabase
          .from("work_items")
          .select("id")
          .eq("related_order_id", order.id)
          .eq("ai_detected", true)
          .in("status", ["open", "claimed", "in_progress"])
          .limit(1);

        if (!existingItem?.length) {
          await supabase.from("work_items").insert({
            title: `AI: Order ${order.order_number || order.id.slice(0, 8)} väntar >24h`,
            description: `Order betald ${order.created_at} (${order.total_amount} kr) men inte packad.`,
            status: "open",
            priority: order.total_amount >= 500 ? "critical" : "high",
            item_type: "order_action",
            source_type: "ai_detection",
            related_order_id: order.id,
            ai_detected: true,
            ai_confidence: "high",
            ai_category: "fulfillment",
          });
          results.detected++;
        }
      }
    }

    // ─── 4. AI RESOLUTION DETECTION ───
    if (action === "full_cycle" || action === "resolve") {
      const { data: bugItems } = await supabase
        .from("work_items")
        .select("id, source_id, source_type, title, created_at, ai_confidence")
        .eq("item_type", "bug")
        .eq("source_type", "bug_report")
        .in("status", ["open", "in_progress"])
        .not("source_id", "is", null)
        .limit(20);

      for (const item of bugItems || []) {
        const { data: bug } = await supabase
          .from("bug_reports")
          .select("status, resolved_at, page_url")
          .eq("id", item.source_id)
          .single();

        if (bug?.status === "resolved") {
          await supabase.from("work_items").update({
            status: "done",
            completed_at: new Date().toISOString(),
            ai_resolution_notes: "Automatiskt stängd: källbugg markerad som löst.",
            ai_confidence: "high",
            updated_at: new Date().toISOString(),
          }).eq("id", item.id);
          results.resolved++;
          continue;
        }

        if (bug?.page_url) {
          const recentWindow = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
          const { data: recentBugs } = await supabase
            .from("bug_reports")
            .select("id")
            .eq("page_url", bug.page_url)
            .eq("status", "open")
            .gte("created_at", recentWindow)
            .limit(1);

          if (!recentBugs?.length) {
            const itemAge = Date.now() - new Date(item.created_at).getTime();
            if (itemAge / (1000 * 60 * 60) > 48) {
              await supabase.from("work_items").update({
                ai_confidence: "medium",
                ai_resolution_notes: "Inga nya rapporter för samma sida på 24h. Kan vara löst.",
                updated_at: new Date().toISOString(),
              }).eq("id", item.id);
              results.flagged++;
            }
          }
        }
      }

      // Anomaly resolution
      const { data: anomalyItems } = await supabase
        .from("work_items")
        .select("id, title, ai_category, created_at")
        .eq("item_type", "anomaly")
        .eq("ai_detected", true)
        .in("status", ["open", "claimed", "in_progress"])
        .limit(10);

      const oneHourAgo2 = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      for (const item of anomalyItems || []) {
        const match = item.title.match(/AI: \d+x (\S+)/);
        if (!match) continue;

        const { count } = await supabase
          .from("analytics_events")
          .select("id", { count: "exact", head: true })
          .eq("event_type", match[1])
          .gte("created_at", oneHourAgo2);

        if ((count || 0) < 2) {
          await supabase.from("work_items").update({
            ai_confidence: "medium",
            ai_resolution_notes: `Felfrekvens sjunkit till ${count || 0} senaste timmen. Troligen löst.`,
            updated_at: new Date().toISOString(),
          }).eq("id", item.id);
          results.flagged++;
        }
      }
    }

    // ─── 5. AI AUTO-CLOSE (HIGH CONFIDENCE ONLY) ───
    if (action === "full_cycle" || action === "auto_close") {
      const { data: highConfItems } = await supabase
        .from("work_items")
        .select("id, title, ai_confidence, ai_resolution_notes")
        .eq("ai_confidence", "high")
        .not("ai_resolution_notes", "is", null)
        .in("status", ["open", "claimed"])
        .eq("ai_detected", true)
        .limit(10);

      for (const item of highConfItems || []) {
        await supabase.from("work_items").update({
          status: "done",
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq("id", item.id);

        await supabase.from("automation_logs").insert({
          action_type: "ai_auto_close",
          target_type: "work_item",
          target_id: item.id,
          reason: `AI auto-stängd (hög konfidens): ${item.ai_resolution_notes}`,
        });
        results.resolved++;
      }
    }

    // ─── 6. AI ORCHESTRATOR (DEPENDENCIES, DUPLICATES, CONFLICTS) ───
    if (action === "full_cycle" || action === "orchestrate") {
      const { data: activeItems, error: activeItemsError } = await supabase
        .from("work_items")
        .select("id, title, description, item_type, source_type, ai_category, priority, status, ai_type_classification, depends_on, blocks, created_at")
        .neq("status", "done")
        .neq("status", "cancelled")
        .order("created_at", { ascending: true })
        .limit(1000);

      if (activeItemsError) {
        results.orchestrator_error = activeItemsError.message;
        throw new Error(`Orchestrator query failed: ${activeItemsError.message}`);
      }

      results.orchestrator_scanned = activeItems?.length || 0;
      console.log(`[orchestrator] scanned=${results.orchestrator_scanned}`);

      // No work
      if (!activeItems?.length) {
        results.orchestrator_mode = "no_items";
      }
      // Single item -> still orchestrate to avoid "0 tasks"
      else if (activeItems.length === 1) {
        await supabase.from("work_items").update({
          execution_order: 1,
          depends_on: [],
          blocks: [],
          conflict_flag: false,
          duplicate_of: null,
          orchestrator_result: {
            reason: "Endast en aktiv uppgift i kön",
            parallel_group: "solo",
            conflict_with: null,
            updated_at: new Date().toISOString(),
            mode: "single_item",
          },
          updated_at: new Date().toISOString(),
        }).eq("id", activeItems[0].id);

        results.orchestrated = 1;
        results.orchestrator_mode = "single_item";
      } else {
        const itemList = activeItems.map((it: any) =>
          `ID:${it.id} Type:${it.item_type} Class:${it.ai_type_classification || "unknown"} Cat:${it.ai_category || "unknown"} Pri:${it.priority} Title:${it.title} Desc:${(it.description || "").substring(0, 150)}`
        ).join("\n");

        let aiTasks: any[] = [];
        const useAI = activeItems.length <= 50;

        if (useAI) {
          try {
            const orchestratorResult = await callAI(lovableKey, [
              {
                role: "system",
                content: `You are a task orchestrator for a Swedish e-commerce platform. Analyze all active work items and determine:
1. Dependencies: which tasks must be completed before others
2. Duplicates: which tasks are duplicates or very similar
3. Conflicts: which tasks affect the same system and could conflict
4. Execution order: optimal order to complete tasks

Rules:
- Payment/checkout fixes block order-related tasks
- Auth fixes block everything user-facing
- Bug fixes for same page/system are potential duplicates
- Two fixes to the same component = potential conflict
- Critical/blocking tasks get execution_order 1-10
- Regular tasks get 11-50
- Optional tasks get 51+

Return one entry for EACH input ID.`,
              },
              { role: "user", content: `Orchestrate these ${activeItems.length} work items:\n${itemList}` },
            ], [{
              type: "function",
              function: {
                name: "orchestrate_tasks",
                description: "Set dependencies, duplicates, conflicts and execution order",
                parameters: {
                  type: "object",
                  properties: {
                    tasks: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          id: { type: "string" },
                          depends_on: { type: "array", items: { type: "string" }, description: "IDs of tasks that must be done first" },
                          blocks: { type: "array", items: { type: "string" }, description: "IDs of tasks blocked by this one" },
                          duplicate_of: { type: "string", description: "ID of the original task if this is a duplicate" },
                          conflict_with: { type: "string", description: "ID of conflicting task" },
                          execution_order: { type: "integer", description: "1=most urgent, higher=less urgent" },
                          parallel_group: { type: "string", description: "Group name for tasks that can run in parallel" },
                          reason: { type: "string" },
                        },
                        required: ["id", "execution_order"],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ["tasks"],
                  additionalProperties: false,
                },
              },
            }], { type: "function", function: { name: "orchestrate_tasks" } });

            aiTasks = (orchestratorResult?.tasks || []).filter((task: any) =>
              task?.id && activeItems.some((it: any) => it.id === task.id)
            );
          } catch (e: any) {
            console.error("AI orchestrator error:", e);
            results.orchestrator_error = e?.message || "AI orchestrator failed";
          }
        }

        if (!useAI) {
          results.orchestrator_mode = "fallback_large_queue";
        }

        // Fallback when AI is disabled for large queues OR returns nothing/partial
        if (!aiTasks.length || aiTasks.length < activeItems.length) {
          const fallback = buildFallbackOrchestration(activeItems);
          const mergedById = new Map<string, any>();
          for (const t of fallback) mergedById.set(t.id, t);
          for (const t of aiTasks) mergedById.set(t.id, { ...mergedById.get(t.id), ...t });
          aiTasks = Array.from(mergedById.values());
          if (!results.orchestrator_mode) {
            results.orchestrator_mode = useAI ? "fallback_merge" : "fallback_large_queue";
          }
        } else {
          results.orchestrator_mode = "ai";
        }

        console.log(`[orchestrator] mode=${results.orchestrator_mode} tasks=${aiTasks.length}`);

        for (const task of aiTasks) {
          const updates: any = {
            execution_order: task.execution_order,
            orchestrator_result: {
              reason: task.reason || null,
              parallel_group: task.parallel_group || null,
              conflict_with: task.conflict_with || null,
              updated_at: new Date().toISOString(),
              mode: results.orchestrator_mode,
            },
            updated_at: new Date().toISOString(),
          };
          updates.depends_on = Array.isArray(task.depends_on) ? task.depends_on : [];
          updates.blocks = Array.isArray(task.blocks) ? task.blocks : [];
          updates.duplicate_of = task.duplicate_of || null;
          updates.conflict_flag = !!task.conflict_with;

          await supabase.from("work_items").update(updates).eq("id", task.id);
          results.orchestrated++;
        }
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-task-manager error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ─── Helpers ───

async function callAI(apiKey: string, messages: any[], tools?: any[], tool_choice?: any) {
  const body: any = { model: "google/gemini-3-flash-preview", messages };
  if (tools) body.tools = tools;
  if (tool_choice) body.tool_choice = tool_choice;

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    if (resp.status === 429) throw Object.assign(new Error("Rate limited"), { status: 429 });
    if (resp.status === 402) throw Object.assign(new Error("Credits exhausted"), { status: 402 });
    throw new Error(`AI error: ${resp.status}`);
  }

  const data = await resp.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (toolCall) return JSON.parse(toolCall.function.arguments);
  return { text: data.choices?.[0]?.message?.content || "" };
}

function buildFallbackOrchestration(activeItems: any[]) {
  const priorityScore: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

  const sorted = [...activeItems].sort((a, b) => {
    const pa = priorityScore[a.priority] ?? 2;
    const pb = priorityScore[b.priority] ?? 2;
    if (pa !== pb) return pa - pb;

    const aBug = a.item_type === "bug" ? 0 : 1;
    const bBug = b.item_type === "bug" ? 0 : 1;
    if (aBug !== bBug) return aBug - bBug;

    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });

  const blockers = sorted.filter((it) => {
    const text = `${it.title || ""} ${it.description || ""}`.toLowerCase();
    return text.includes("payment") || text.includes("checkout") || text.includes("auth") || text.includes("login");
  });

  return sorted.map((item, index) => {
    const text = `${item.title || ""} ${item.description || ""}`.toLowerCase();
    const isFeatureLike = ["feature", "improvement", "upgrade"].includes(item.ai_type_classification || "");

    const depends_on = blockers
      .filter((b) => b.id !== item.id)
      .filter((b) => {
        if (isFeatureLike) return true;
        if (text.includes("order") || text.includes("shipping") || text.includes("warehouse")) {
          const bText = `${b.title || ""} ${b.description || ""}`.toLowerCase();
          return bText.includes("payment") || bText.includes("checkout");
        }
        return false;
      })
      .slice(0, 3)
      .map((b) => b.id);

    return {
      id: item.id,
      execution_order: index + 1,
      depends_on,
      blocks: [],
      duplicate_of: null,
      conflict_with: null,
      parallel_group: depends_on.length ? null : `lane_${(index % 3) + 1}`,
      reason: depends_on.length
        ? "Fallback: beroende upptäckta mot blockerande uppgifter"
        : "Fallback: prioriterad efter severity + ålder",
    };
  });
}

async function autoAssign(supabase: any, item: any): Promise<string | null> {
  const categoryRoleMap: Record<string, string[]> = {
    payment: ["finance", "admin", "founder"],
    checkout: ["it", "admin", "founder"],
    fulfillment: ["warehouse", "admin", "founder"],
    UI: ["it", "admin", "founder"],
    system: ["it", "admin", "founder"],
    support: ["support", "moderator", "admin", "founder"],
  };

  const typeRoleMap: Record<string, string[]> = {
    bug: ["it", "admin", "founder"],
    incident: ["support", "admin", "founder"],
    order_action: ["warehouse", "admin", "founder"],
    pack_order: ["warehouse", "admin", "founder"],
    anomaly: ["it", "admin", "founder"],
    manual: ["admin", "founder"],
  };

  const roles = categoryRoleMap[item.ai_category] || typeRoleMap[item.item_type] || ["admin", "founder"];

  const { data: candidates } = await supabase
    .from("user_roles")
    .select("user_id")
    .in("role", roles);

  if (!candidates?.length) return null;

  let bestUser: string | null = null;
  let minTasks = Infinity;

  for (const c of candidates) {
    const { count } = await supabase
      .from("work_items")
      .select("id", { count: "exact", head: true })
      .or(`assigned_to.eq.${c.user_id},claimed_by.eq.${c.user_id}`)
      .in("status", ["open", "claimed", "in_progress"]);

    if ((count || 0) < minTasks) {
      minTasks = count || 0;
      bestUser = c.user_id;
    }
  }

  return bestUser;
}
