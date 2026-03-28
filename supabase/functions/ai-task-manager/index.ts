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

    // ─── 1. RULE-BASED PRIORITIZATION (NO AI) ───
    if (action === "full_cycle" || action === "prioritize") {
      const { data: items } = await supabase
        .from("work_items")
        .select("id, title, description, priority, item_type, source_type, source_id, related_order_id, ai_confidence, status")
        .in("status", ["open", "claimed", "in_progress", "escalated"])
        .or("ai_confidence.is.null,ai_confidence.eq.none")
        .limit(20);

      for (const item of items || []) {
        const text = `${item.title || ""} ${item.description || ""}`.toLowerCase();
        
        // Rule-based priority
        let priority = item.priority || "medium";
        let confidence = "medium";
        let category = "system";
        let classification = "task";

        // Bug classification
        if (item.item_type === "bug" || text.includes("bug") || text.includes("fel") || text.includes("broken") || text.includes("trasig")) {
          classification = "bug";
          priority = "high";
          confidence = "high";
        }

        // Incident/support
        if (item.item_type === "incident" || text.includes("incident") || text.includes("ärende")) {
          classification = "bug";
          priority = "high";
          category = "support";
        }

        // UI issues
        if (text.includes("layout") || text.includes("overflow") || text.includes("responsiv") || text.includes("css")) {
          classification = "bug";
          category = "UI";
          priority = "medium";
        }

        // Feature/improvement
        if (text.includes("förbättr") || text.includes("improve") || text.includes("ny funktion") || text.includes("feature")) {
          classification = "improvement";
          priority = "low";
          confidence = "medium";
        }

        // Data issues
        if (text.includes("data") || text.includes("databas") || text.includes("sync") || text.includes("null") || text.includes("saknas")) {
          category = "data";
          if (!classification || classification === "task") classification = "bug";
        }

        // Critical: anything with "critical" in it
        if (text.includes("critical") || text.includes("kritisk") || item.priority === "critical") {
          priority = "critical";
          confidence = "high";
        }

        await supabase.from("work_items").update({
          priority,
          ai_confidence: confidence,
          ai_category: category,
          ai_type_classification: classification,
          ai_type_reason: "Regelbaserad klassificering",
          updated_at: new Date().toISOString(),
        }).eq("id", item.id);
        results.prioritized++;
      }
    }

    // ─── 2. RULE-BASED AUTO-ASSIGN ───
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
            message: `Automatiskt tilldelad uppgift: ${item.item_type}`,
            related_id: item.id,
            related_type: "work_item",
          });
          results.assigned++;
        }
      }
    }

    // ─── 3. RULE-BASED AUTO-DETECTION ───
    if (action === "full_cycle" || action === "detect") {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

      const { data: recentErrors } = await supabase
        .from("analytics_events")
        .select("event_type, event_data, created_at")
        .in("event_type", ["page_error"])
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
          await supabase.from("work_items").insert({
            title: `Auto: ${count}x ${eventType} senaste timmen`,
            description: `Automatiskt detekterat: ${count} ${eventType}-händelser under senaste timmen.`,
            status: "open",
            priority: "high",
            item_type: "anomaly",
            source_type: "ai_detection",
            ai_detected: true,
            ai_confidence: "medium",
            ai_category: "system",
          });
          results.detected++;
        }
      }
    }

    // ─── 4. RULE-BASED RESOLUTION DETECTION ───
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

        if (bug?.status === "resolved" && bug?.resolved_at) {
          await supabase.from("work_items").update({
            status: "done",
            completed_at: new Date().toISOString(),
            resolution_notes: "Automatiskt stängd — källbugg markerad som löst.",
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
        const match = item.title.match(/Auto: \d+x (\S+)/);
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

    // ─── 5. RULE-BASED AUTO-CLOSE (HIGH CONFIDENCE ONLY) ───
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
          action_type: "auto_close",
          target_type: "work_item",
          target_id: item.id,
          reason: `Auto-stängd (hög konfidens): ${item.ai_resolution_notes}`,
        });
        results.resolved++;
      }
    }

    // ─── 6. RULE-BASED ORCHESTRATOR ───
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

      if (!activeItems?.length) {
        results.orchestrator_mode = "no_items";
      } else if (activeItems.length === 1) {
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
            mode: "rule_based",
          },
          updated_at: new Date().toISOString(),
        }).eq("id", activeItems[0].id);

        results.orchestrated = 1;
        results.orchestrator_mode = "rule_based";
      } else {
        // Use rule-based orchestration for ALL cases
        const orchestrated = buildFallbackOrchestration(activeItems);
        results.orchestrator_mode = "rule_based";

        for (const batch of chunkArray(orchestrated, 25)) {
          await Promise.all(batch.map(async (task: any) => {
            const updates: any = {
              execution_order: task.execution_order,
              orchestrator_result: {
                reason: task.reason || null,
                parallel_group: task.parallel_group || null,
                conflict_with: task.conflict_with || null,
                updated_at: new Date().toISOString(),
                mode: "rule_based",
              },
              updated_at: new Date().toISOString(),
            };
            updates.depends_on = Array.isArray(task.depends_on) ? task.depends_on : [];
            updates.blocks = Array.isArray(task.blocks) ? task.blocks : [];
            updates.duplicate_of = task.duplicate_of || null;
            updates.conflict_flag = !!task.conflict_with;

            await supabase.from("work_items").update(updates).eq("id", task.id);
          }));

          results.orchestrated += batch.length;
        }
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("task-manager error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ─── Helpers ───

function chunkArray<T>(arr: T[], size: number): T[][] {
  if (size <= 0) return [arr];
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
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

  // Detect duplicates by similar titles
  const titleMap = new Map<string, string>();
  const duplicates = new Map<string, string>();
  for (const item of sorted) {
    const normalized = (item.title || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 40);
    if (titleMap.has(normalized)) {
      duplicates.set(item.id, titleMap.get(normalized)!);
    } else {
      titleMap.set(normalized, item.id);
    }
  }

  // Detect conflicts (same component)
  const componentMap = new Map<string, string[]>();
  for (const item of sorted) {
    const text = `${item.title || ""} ${item.description || ""}`.toLowerCase();
    const components = ["header", "footer", "checkout", "cart", "product", "order", "profile", "auth"];
    for (const comp of components) {
      if (text.includes(comp)) {
        if (!componentMap.has(comp)) componentMap.set(comp, []);
        componentMap.get(comp)!.push(item.id);
      }
    }
  }

  return sorted.map((item, index) => {
    const text = `${item.title || ""} ${item.description || ""}`.toLowerCase();
    const isFeatureLike = ["feature", "improvement", "upgrade"].includes(item.ai_type_classification || "");

    // Find conflicts
    let conflict_with: string | null = null;
    for (const [, ids] of componentMap) {
      if (ids.includes(item.id) && ids.length > 1) {
        conflict_with = ids.find(id => id !== item.id) || null;
        break;
      }
    }

    return {
      id: item.id,
      execution_order: index + 1,
      depends_on: [] as string[],
      blocks: [] as string[],
      duplicate_of: duplicates.get(item.id) || null,
      conflict_with,
      parallel_group: `lane_${(index % 3) + 1}`,
      reason: duplicates.has(item.id)
        ? "Möjlig duplikat"
        : conflict_with
          ? "Konflikt med annan uppgift på samma komponent"
          : "Prioriterad efter severity + ålder",
    };
  });
}

async function autoAssign(supabase: any, item: any): Promise<string | null> {
  const categoryRoleMap: Record<string, string[]> = {
    fulfillment: ["warehouse", "admin", "founder"],
    UI: ["it", "admin", "founder"],
    system: ["it", "admin", "founder"],
    support: ["support", "moderator", "admin", "founder"],
    data: ["it", "admin", "founder"],
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
