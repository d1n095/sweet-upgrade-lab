import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

// ── SCAN & DATA CENTER — Task Manager (100% rule-based, zero AI) ──

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── GLOBAL AI BLOCK ───────────────────────────────────────────────────
function blockAIUsage(code: string): boolean {
  const forbidden = ["openai", "anthropic", "gpt", "claude", "lovable_key", "LOVABLE_API_KEY", "ai.gateway"];
  return forbidden.some((word) => code.toLowerCase().includes(word.toLowerCase()));
}
// ─────────────────────────────────────────────────────────────────────

// ── Rule-based task processor ──
function processTasks(tasks: any[]): any[] {
  return tasks.map((task) => {
    const text = `${task.title || ""} ${task.description || ""}`.toLowerCase();

    let priority = task.priority || "medium";
    let confidence = "high";
    let category = "task";
    let itemType = task.item_type || "task";

    // Bug patterns
    if (
      /crash|error|broken|misslyck|fel|inte fungerar|failed|null pointer|undefined|exception|404|500|403|stacktrace/.test(text) ||
      task.item_type === "bug" ||
      task.source_type === "bug_report"
    ) {
      priority = "high";
      category = "bug";
      itemType = "bug";
    }

    // Critical patterns
    if (
      /payment|betaling|checkout|stripe|order faile|order saknas|kritisk|critical|blocker|data loss|förlorad data/.test(text) ||
      task.item_type === "bug" && /critical|blocker/.test(text)
    ) {
      priority = "critical";
      category = "bug";
      confidence = "high";
    }

    // Warning patterns
    if (
      /slow|trög|performance|warning|varning|improvement|förbättring|bör|should|could|kan|ux|layout|spacing/.test(text) &&
      priority !== "critical" && priority !== "high"
    ) {
      priority = "medium";
      category = "improvement";
      itemType = "improvement";
    }

    return {
      ...task,
      priority,
      ai_confidence: confidence,
      ai_category: category,
      item_type: itemType,
    };
  });
}

// ── Rule-based auto-assign ──
async function autoAssign(supabase: any, item: any): Promise<string | null> {
  try {
    // Find staff who handle this type of item
    const relevantRoles = item.item_type === "bug" || item.ai_category === "bug"
      ? ["it", "founder", "admin"]
      : ["admin", "founder", "support"];

    const { data: eligibleStaff } = await supabase
      .from("user_roles")
      .select("user_id, role")
      .in("role", relevantRoles)
      .limit(10);

    if (!eligibleStaff?.length) return null;

    // Assign to staff with fewest open items (round-robin by work load)
    let minLoad = Infinity;
    let chosen: string | null = null;

    for (const staff of eligibleStaff) {
      const { count } = await supabase
        .from("work_items")
        .select("id", { count: "exact", head: true })
        .eq("assigned_to", staff.user_id)
        .in("status", ["open", "claimed", "in_progress"]);

      if ((count ?? 0) < minLoad) {
        minLoad = count ?? 0;
        chosen = staff.user_id;
      }
    }

    return chosen;
  } catch {
    return null;
  }
}

// ── Rule-based orchestration ──
function buildRuleBasedOrchestration(items: any[]): any[] {
  // Sort by priority
  const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  const sorted = [...items].sort((a, b) =>
    (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2)
  );

  // Group by type for parallel execution
  const bugItems = sorted.filter((i) => i.item_type === "bug" || i.ai_category === "bug");
  const otherItems = sorted.filter((i) => i.item_type !== "bug" && i.ai_category !== "bug");

  const result: any[] = [];
  let order = 0;

  // Bugs first (parallel group A)
  for (const item of bugItems) {
    result.push({
      ...item,
      execution_order: order++,
      parallel_group: "A",
      reason: "Bug items prioritized first",
      depends_on: [],
      blocks: [],
    });
  }

  // Other items (parallel group B)
  for (const item of otherItems) {
    result.push({
      ...item,
      execution_order: order++,
      parallel_group: "B",
      reason: "Standard execution order by priority",
      depends_on: [],
      blocks: [],
    });
  }

  return result;
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";

    // Auth
    const authHeader = req.headers.get("authorization") || "";
    const isServiceRole = authHeader === `Bearer ${serviceKey}`;
    const cronSecret = Deno.env.get("CRON_SECRET");
    const isCron = cronSecret && req.headers.get("x-cron-secret") === cronSecret;
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
      orchestrator_mode: "rule_based",
      orchestrator_error: null,
    };

    // ─── 1. RULE-BASED PRIORITIZATION ───
    if (action === "full_cycle" || action === "prioritize") {
      const { data: items } = await supabase
        .from("work_items")
        .select("id, title, description, priority, item_type, source_type, source_id, related_order_id, ai_confidence, status")
        .in("status", ["open", "claimed", "in_progress", "escalated"])
        .or("ai_confidence.is.null,ai_confidence.eq.none")
        .limit(20);

      const processed = processTasks(items || []);

      for (const item of processed) {
        await supabase.from("work_items").update({
          priority: item.priority,
          ai_confidence: item.ai_confidence,
          ai_category: item.ai_category,
          item_type: item.item_type,
          updated_at: new Date().toISOString(),
        }).eq("id", item.id);
        results.prioritized++;
      }
    }

    // ─── 2. AUTO-ASSIGN ───
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

    // ─── 3. AUTO-RESOLVE stale/done items ───
    if (action === "full_cycle" || action === "resolve") {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: staleDone } = await supabase
        .from("work_items")
        .select("id")
        .eq("status", "done")
        .lt("updated_at", sevenDaysAgo)
        .is("verification_status", null)
        .limit(50);

      for (const item of staleDone || []) {
        await supabase.from("work_items").update({
          verification_status: "confirmed",
          updated_at: new Date().toISOString(),
        }).eq("id", item.id);
        results.resolved++;
      }
    }

    // ─── 4. RULE-BASED ORCHESTRATION ───
    if (action === "full_cycle" || action === "orchestrate") {
      const { data: activeItems } = await supabase
        .from("work_items")
        .select("id, title, item_type, priority, status, ai_category, execution_order, depends_on, blocks, duplicate_of, conflict_flag")
        .in("status", ["open", "claimed", "in_progress", "escalated", "new", "pending", "detected"])
        .limit(100);

      results.orchestrator_scanned = activeItems?.length || 0;

      if (!activeItems?.length) {
        results.orchestrator_mode = "rule_based";
      } else {
        const orchestrated = buildRuleBasedOrchestration(activeItems);
        results.orchestrator_mode = "rule_based";

        for (const batch of chunkArray(orchestrated, 25)) {
          await Promise.all(batch.map(async (task: any) => {
            const updates: any = {
              execution_order: task.execution_order,
              orchestrator_result: {
                reason: task.reason || null,
                parallel_group: task.parallel_group || null,
                updated_at: new Date().toISOString(),
                mode: "rule_based",
              },
              updated_at: new Date().toISOString(),
            };
            updates.depends_on = Array.isArray(task.depends_on) ? task.depends_on : [];
            updates.blocks = Array.isArray(task.blocks) ? task.blocks : [];
            updates.duplicate_of = task.duplicate_of || null;
            updates.conflict_flag = false;

            try {
              await supabase.from("work_items").update(updates).eq("id", task.id);
              results.orchestrated++;
            } catch { /* skip individual failures */ }
          }));
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, results, mode: "rule_based", ai_used: false }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("[task-manager] error:", e?.message);
    return new Response(
      JSON.stringify({ error: e?.message || "Unknown error", mode: "rule_based" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
