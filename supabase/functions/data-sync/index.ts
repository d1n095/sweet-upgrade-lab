import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify caller is staff
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await anonClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(supabaseUrl, serviceKey);
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
    const isStaff = roles?.some((r: any) => ["admin", "founder", "it"].includes(r.role));
    if (!isStaff) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 403, headers: corsHeaders });
    }

    const body = await req.json().catch(() => ({}));
    const mode = body.mode || "scan"; // scan | repair

    const results = {
      orphan_work_items: 0,
      orphan_work_items_fixed: 0,
      bugs_without_work_items: 0,
      bugs_without_work_items_fixed: 0,
      status_mismatches: 0,
      status_mismatches_fixed: 0,
      deleted_order_tasks: 0,
      deleted_order_tasks_fixed: 0,
      completed_order_tasks: 0,
      completed_order_tasks_fixed: 0,
      cancelled_order_tasks: 0,
      cancelled_order_tasks_fixed: 0,
      sourceless_items: 0,
      sourceless_items_fixed: 0,
      duplicate_work_items: 0,
      stale_claimed: 0,
      stale_claimed_fixed: 0,
      total_issues: 0,
      total_fixed: 0,
      details: [] as { type: string; message: string; fixed: boolean }[],
    };

    // ─── 1. ORPHAN WORK ITEMS (invalid source_id) ───
    const { data: workItems } = await supabase
      .from("work_items")
      .select("id, title, source_type, source_id, status, related_order_id")
      .in("status", ["open", "claimed", "in_progress", "escalated"])
      .limit(500);

    for (const wi of workItems || []) {
      if (wi.source_type === "bug_report" && wi.source_id) {
        const { data: bug } = await supabase.from("bug_reports").select("id").eq("id", wi.source_id).single();
        if (!bug) {
          results.orphan_work_items++;
          results.details.push({ type: "orphan", message: `Work item "${wi.title}" → bug ${wi.source_id} saknas`, fixed: false });
          if (mode === "repair") {
            await supabase.from("work_items").update({
              status: "cancelled",
              updated_at: new Date().toISOString(),
            }).eq("id", wi.id);
            await logRepair(supabase, "orphan_cleanup", "work_item", wi.id, "Källa (bug_report) saknas. Avbruten.");
            results.orphan_work_items_fixed++;
            results.details[results.details.length - 1].fixed = true;
          }
        }
      }

      if (wi.source_type === "order_incident" && wi.source_id) {
        const { data: inc } = await supabase.from("order_incidents").select("id").eq("id", wi.source_id).single();
        if (!inc) {
          results.orphan_work_items++;
          results.details.push({ type: "orphan", message: `Work item "${wi.title}" → incident ${wi.source_id} saknas`, fixed: false });
          if (mode === "repair") {
            await supabase.from("work_items").update({
              status: "cancelled",
              updated_at: new Date().toISOString(),
            }).eq("id", wi.id);
            await logRepair(supabase, "orphan_cleanup", "work_item", wi.id, "Källa (order_incident) saknas. Avbruten.");
            results.orphan_work_items_fixed++;
            results.details[results.details.length - 1].fixed = true;
          }
        }
      }

      // Tasks linked to deleted orders
      if (wi.related_order_id) {
        const { data: order } = await supabase
          .from("orders")
          .select("id, deleted_at")
          .eq("id", wi.related_order_id)
          .single();
        if (!order || order.deleted_at) {
          results.deleted_order_tasks++;
          results.details.push({ type: "deleted_order", message: `Work item "${wi.title}" → order raderad`, fixed: false });
          if (mode === "repair") {
            await supabase.from("work_items").update({
              status: "cancelled",
              updated_at: new Date().toISOString(),
            }).eq("id", wi.id);
            await logRepair(supabase, "deleted_order_cleanup", "work_item", wi.id, "Kopplad order raderad. Avbruten.");
            results.deleted_order_tasks_fixed++;
            results.details[results.details.length - 1].fixed = true;
          }
        }
      }
    }

    // ─── 1b. COMPLETED ORDER TASKS (still active) ───
    for (const wi of workItems || []) {
      if (!wi.related_order_id || !["open", "claimed", "in_progress"].includes(wi.status)) continue;
      // Already checked deleted above, now check completed/delivered
      const { data: order } = await supabase
        .from("orders")
        .select("id, status, deleted_at")
        .eq("id", wi.related_order_id)
        .single();
      if (!order || order.deleted_at) continue; // handled above

      if (["delivered", "completed"].includes(order.status) && ["pack_order", "packing", "shipping"].includes(wi.item_type)) {
        results.completed_order_tasks++;
        results.details.push({ type: "completed_order", message: `"${wi.title}" → order redan levererad/klar`, fixed: false });
        if (mode === "repair") {
          await supabase.from("work_items").update({
            status: "done",
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }).eq("id", wi.id);
          await logRepair(supabase, "order_complete_sync", "work_item", wi.id, "Order levererad. Task stängd.");
          results.completed_order_tasks_fixed++;
          results.details[results.details.length - 1].fixed = true;
        }
      }

      if (order.status === "cancelled") {
        results.cancelled_order_tasks++;
        results.details.push({ type: "cancelled_order", message: `"${wi.title}" → order avbruten`, fixed: false });
        if (mode === "repair") {
          await supabase.from("work_items").update({
            status: "cancelled",
            updated_at: new Date().toISOString(),
          }).eq("id", wi.id);
          await logRepair(supabase, "order_cancel_sync", "work_item", wi.id, "Order avbruten. Task avbruten.");
          results.cancelled_order_tasks_fixed++;
          results.details[results.details.length - 1].fixed = true;
        }
      }
    }

    // ─── 1c. SOURCELESS ITEMS (no source_type or source_id on non-manual items) ───
    const sourcelessItems = (workItems || []).filter((wi: any) =>
      !["manual", "manual_task", "general"].includes(wi.item_type) &&
      !wi.source_type && !wi.source_id &&
      ["open", "claimed", "in_progress"].includes(wi.status)
    );
    for (const wi of sourcelessItems) {
      results.sourceless_items++;
      results.details.push({ type: "sourceless", message: `"${wi.title}" (${wi.item_type}) saknar source_type/source_id`, fixed: false });
      if (mode === "repair") {
        // Flag it with source_type = "unknown" so it's visible
        await supabase.from("work_items").update({
          source_type: "unknown",
          updated_at: new Date().toISOString(),
        }).eq("id", wi.id);
        await logRepair(supabase, "flag_sourceless", "work_item", wi.id, "Saknar källa. Flaggad.");
        results.sourceless_items_fixed++;
        results.details[results.details.length - 1].fixed = true;
      }
    }

    // ─── 2. BUGS WITHOUT WORK ITEMS ───
    const { data: openBugs } = await supabase
      .from("bug_reports")
      .select("id, description")
      .eq("status", "open")
      .limit(200);

    for (const bug of openBugs || []) {
      const { data: linkedWi } = await supabase
        .from("work_items")
        .select("id")
        .eq("source_type", "bug_report")
        .eq("source_id", bug.id)
        .limit(1);

      if (!linkedWi?.length) {
        results.bugs_without_work_items++;
        results.details.push({ type: "unlinked_bug", message: `Bug ${bug.id.slice(0, 8)} har ingen work_item`, fixed: false });
        if (mode === "repair") {
          await supabase.from("work_items").insert({
            title: "Bug: " + (bug.description || "").substring(0, 80),
            description: bug.description || "",
            status: "open",
            priority: "medium",
            item_type: "bug",
            source_type: "bug_report",
            source_id: bug.id,
          });
          await logRepair(supabase, "create_missing", "work_item", bug.id, "Work item skapad för olänkad bug.");
          results.bugs_without_work_items_fixed++;
          results.details[results.details.length - 1].fixed = true;
        }
      }
    }

    // ─── 3. STATUS MISMATCHES (bi-directional sync) ───
    // Bug resolved but work_item still open
    const { data: resolvedBugs } = await supabase
      .from("bug_reports")
      .select("id")
      .eq("status", "resolved")
      .limit(200);

    for (const bug of resolvedBugs || []) {
      const { data: activeWi } = await supabase
        .from("work_items")
        .select("id, title")
        .eq("source_type", "bug_report")
        .eq("source_id", bug.id)
        .in("status", ["open", "claimed", "in_progress", "escalated"])
        .limit(1);

      if (activeWi?.length) {
        results.status_mismatches++;
        results.details.push({ type: "mismatch", message: `Bug ${bug.id.slice(0, 8)} löst men work_item "${activeWi[0].title}" fortfarande aktiv`, fixed: false });
        if (mode === "repair") {
          await supabase.from("work_items").update({
            status: "done",
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }).eq("id", activeWi[0].id);
          await logRepair(supabase, "status_sync", "work_item", activeWi[0].id, "Bug redan löst. Work item stängd.");
          results.status_mismatches_fixed++;
          results.details[results.details.length - 1].fixed = true;
        }
      }
    }

    // Work item done but bug still open
    const { data: doneWi } = await supabase
      .from("work_items")
      .select("id, source_id, title")
      .eq("source_type", "bug_report")
      .eq("status", "done")
      .limit(200);

    for (const wi of doneWi || []) {
      if (!wi.source_id) continue;
      const { data: bug } = await supabase
        .from("bug_reports")
        .select("id, status")
        .eq("id", wi.source_id)
        .single();

      if (bug && bug.status === "open") {
        results.status_mismatches++;
        results.details.push({ type: "mismatch", message: `Work item "${wi.title}" klar men bug ${bug.id.slice(0, 8)} fortfarande öppen`, fixed: false });
        if (mode === "repair") {
          await supabase.from("bug_reports").update({
            status: "resolved",
            resolved_at: new Date().toISOString(),
          }).eq("id", bug.id);
          await logRepair(supabase, "status_sync", "bug_report", bug.id, "Work item klar. Bug markerad som löst.");
          results.status_mismatches_fixed++;
          results.details[results.details.length - 1].fixed = true;
        }
      }
    }

    // ─── 4. DUPLICATE WORK ITEMS ───
    const { data: allActive } = await supabase
      .from("work_items")
      .select("id, source_type, source_id")
      .in("status", ["open", "claimed", "in_progress", "escalated"])
      .not("source_id", "is", null)
      .limit(500);

    const sourceMap = new Map<string, string[]>();
    for (const wi of allActive || []) {
      const key = `${wi.source_type}:${wi.source_id}`;
      if (!sourceMap.has(key)) sourceMap.set(key, []);
      sourceMap.get(key)!.push(wi.id);
    }
    for (const [key, ids] of sourceMap) {
      if (ids.length > 1) {
        results.duplicate_work_items += ids.length - 1;
        results.details.push({ type: "duplicate", message: `${ids.length} work_items för ${key}`, fixed: false });
        if (mode === "repair") {
          // Keep first, cancel rest
          for (const id of ids.slice(1)) {
            await supabase.from("work_items").update({
              status: "cancelled",
              updated_at: new Date().toISOString(),
            }).eq("id", id);
            await logRepair(supabase, "dedup", "work_item", id, `Dubblett av ${ids[0]}. Avbruten.`);
          }
          results.details[results.details.length - 1].fixed = true;
        }
      }
    }

    // ─── 5. STALE CLAIMED (> 30min without progress) ───
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data: staleClaimed } = await supabase
      .from("work_items")
      .select("id, title, claimed_by")
      .eq("status", "claimed")
      .not("claimed_at", "is", null)
      .lt("claimed_at", thirtyMinAgo)
      .limit(50);

    for (const wi of staleClaimed || []) {
      results.stale_claimed++;
      results.details.push({ type: "stale", message: `"${wi.title}" claimad >30min utan start`, fixed: false });
      if (mode === "repair") {
        await supabase.from("work_items").update({
          status: "open",
          assigned_to: null,
          claimed_by: null,
          claimed_at: null,
          updated_at: new Date().toISOString(),
        }).eq("id", wi.id);
        await logRepair(supabase, "stale_release", "work_item", wi.id, "Claimad >30min. Frisläppt.");
        results.stale_claimed_fixed++;
        results.details[results.details.length - 1].fixed = true;
      }
    }

    results.total_issues = results.orphan_work_items + results.bugs_without_work_items +
      results.status_mismatches + results.deleted_order_tasks +
      results.duplicate_work_items + results.stale_claimed;

    results.total_fixed = results.orphan_work_items_fixed + results.bugs_without_work_items_fixed +
      results.status_mismatches_fixed + results.deleted_order_tasks_fixed +
      results.stale_claimed_fixed;

    return new Response(JSON.stringify({ success: true, mode, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("data-sync error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function logRepair(supabase: any, action: string, targetType: string, targetId: string, reason: string) {
  await supabase.from("automation_logs").insert({
    action_type: action,
    target_type: targetType,
    target_id: targetId,
    reason,
    details: { source: "data-sync", auto_repair: true },
  });
}
