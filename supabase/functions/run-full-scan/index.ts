import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STEPS = [
  { id: "data_flow_validation", scanType: "data_integrity", label: "Validerar dataflöden..." },
  { id: "component_map", scanType: "component_map", label: "Kartlägger komponenter..." },
  { id: "ui_data_binding", scanType: "sync_scan", label: "Validerar UI-databindning..." },
  { id: "interaction_qa", scanType: "interaction_qa", label: "Testar interaktioner..." },
  { id: "human_test", scanType: "human_test", label: "Simulerar användarbeteende..." },
  { id: "navigation_verification", scanType: "nav_scan", label: "Verifierar navigering..." },
  { id: "feature_detection", scanType: "feature_detection", label: "Klassificerar funktioner..." },
  { id: "regression_detection", scanType: "system_scan", label: "Detekterar regressioner..." },
  { id: "decision_engine", scanType: "decision_engine", label: "Kör beslutsmotor..." },
  { id: "blocker_detection", scanType: "blocker_detection", label: "Söker blockerare..." },
];

function buildUnifiedResult(stepResults: Record<string, any>, totalDuration: number) {
  const blocker = stepResults.blocker_detection?.primary_blocker || stepResults.blocker_detection?.detected_blockers?.[0] || null;

  const broken_flows: any[] = [];
  if (stepResults.data_flow_validation?.issues) broken_flows.push(...stepResults.data_flow_validation.issues);
  if (stepResults.data_flow_validation?.broken_links) broken_flows.push(...stepResults.data_flow_validation.broken_links);
  if (stepResults.navigation_verification?.issues) broken_flows.push(...stepResults.navigation_verification.issues);
  if (stepResults.navigation_verification?.broken_routes) broken_flows.push(...stepResults.navigation_verification.broken_routes);

  const fake_features: any[] = [];
  if (stepResults.feature_detection?.features) {
    fake_features.push(...stepResults.feature_detection.features.filter((f: any) => f.status === "fake" || f.classification === "fake"));
  }

  const interaction_failures: any[] = [];
  if (stepResults.interaction_qa?.issues) interaction_failures.push(...stepResults.interaction_qa.issues);
  if (stepResults.human_test?.issues) interaction_failures.push(...stepResults.human_test.issues);
  if (stepResults.human_test?.test_failures) interaction_failures.push(...stepResults.human_test.test_failures);

  const data_issues: any[] = [];
  if (stepResults.ui_data_binding?.issues) data_issues.push(...stepResults.ui_data_binding.issues);
  if (stepResults.ui_data_binding?.mismatches) data_issues.push(...stepResults.ui_data_binding.mismatches);

  const scores: number[] = [];
  for (const key of Object.keys(stepResults)) {
    const r = stepResults[key];
    if (r?.overall_score != null) scores.push(r.overall_score);
    if (r?.system_score != null) scores.push(r.system_score);
    if (r?.health_score != null) scores.push(r.health_score);
    if (r?.score != null) scores.push(r.score);
  }
  const system_health_score = scores.length > 0 ? Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length) : 0;

  return {
    blocker,
    broken_flows,
    fake_features,
    interaction_failures,
    data_issues,
    system_health_score,
    step_results: stepResults,
    completed_at: new Date().toISOString(),
    total_duration_ms: totalDuration,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    const { action, scan_run_id, step_index } = body;

    // ── START: Begin a new scan ──
    if (action === "start") {
      const authHeader = req.headers.get("authorization");
      if (!authHeader) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
      }

      const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const token = authHeader.replace("Bearer ", "");
      const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
      if (claimsError || !claimsData?.claims?.sub) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
      }
      const userId = claimsData.claims.sub as string;

      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
      const isStaff = roles?.some((r: any) => ["admin", "founder", "it", "support", "moderator"].includes(r.role));
      if (!isStaff) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 403, headers: corsHeaders });
      }

      // Check if a scan is already running (global lock)
      const { data: running } = await supabase
        .from("scan_runs")
        .select("id, started_by, current_step_label, started_at")
        .eq("status", "running")
        .limit(1);

      if (running?.length) {
        // Auto-expire scans older than 15 minutes (stale)
        const startedAt = new Date(running[0].started_at).getTime();
        const fifteenMin = 15 * 60 * 1000;
        if (Date.now() - startedAt > fifteenMin) {
          await supabase.from("scan_runs").update({
            status: "error",
            error_message: "Automatiskt avbruten — timeout efter 15 min",
            completed_at: new Date().toISOString(),
          }).eq("id", running[0].id);
        } else {
          return new Response(JSON.stringify({
            error: "En skanning körs redan av en annan användare",
            running_scan: running[0],
          }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }

      // Create scan run record
      const { data: scanRun, error: insertError } = await supabase.from("scan_runs").insert({
        status: "running",
        started_by: userId,
        current_step: 0,
        total_steps: STEPS.length,
        current_step_label: STEPS[0].label,
        steps_results: {},
      }).select("id").single();

      if (insertError || !scanRun) {
        return new Response(JSON.stringify({ error: "Failed to create scan run" }), { status: 500, headers: corsHeaders });
      }

      // Fire first step (non-blocking — self-chaining)
      fetch(`${supabaseUrl}/functions/v1/run-full-scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
        body: JSON.stringify({ action: "process_step", scan_run_id: scanRun.id, step_index: 0 }),
      }).catch((e) => console.error("Failed to chain first step:", e));

      return new Response(JSON.stringify({ scan_run_id: scanRun.id, status: "started" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── PROCESS_STEP: Execute one scan step then chain to next ──
    if (action === "process_step" && scan_run_id && step_index !== undefined) {
      // Verify scan is still running
      const { data: scanRun } = await supabase.from("scan_runs").select("*").eq("id", scan_run_id).single();
      if (!scanRun || scanRun.status !== "running") {
        return new Response(JSON.stringify({ error: "Scan not running" }), { status: 400, headers: corsHeaders });
      }

      const step = STEPS[step_index];
      if (!step) {
        return new Response(JSON.stringify({ error: "Invalid step index" }), { status: 400, headers: corsHeaders });
      }

      // Update progress
      await supabase.from("scan_runs").update({
        current_step: step_index,
        current_step_label: step.label,
      }).eq("id", scan_run_id);

      // Call ai-assistant for this scan type (using service role — bypasses user auth)
      let stepResult: any = { error: "unknown", failed: true };
      const stepStart = Date.now();

      try {
        const previousContext: Record<string, any> = {};
        const existingResults = scanRun.steps_results || {};
        for (const [key, val] of Object.entries(existingResults)) {
          const v = val as any;
          if (v?.overall_score != null) previousContext[key] = { score: v.overall_score };
          if (v?.issues_count != null) previousContext[key] = { ...previousContext[key], issues: v.issues_count };
        }

        const resp = await fetch(`${supabaseUrl}/functions/v1/ai-assistant`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            type: step.scanType,
            orchestrated: true,
            step_index,
            previous_context: Object.keys(previousContext).length > 0 ? previousContext : undefined,
          }),
        });

        if (resp.ok) {
          const data = await resp.json();
          stepResult = data.result || data;
        } else {
          const errBody = await resp.text().catch(() => "");
          stepResult = { error: `HTTP ${resp.status}: ${errBody.substring(0, 200)}`, failed: true };
        }
      } catch (e: any) {
        stepResult = { error: e.message, failed: true };
      }

      const duration_ms = Date.now() - stepStart;
      stepResult._duration_ms = duration_ms;
      stepResult._step_id = step.id;

      // Save step result
      const updatedResults = { ...(scanRun.steps_results || {}), [step.id]: stepResult };

      // Check if this is the last step
      const isLastStep = step_index + 1 >= STEPS.length;

      if (!isLastStep) {
        // Update progress and chain to next step
        const nextStep = STEPS[step_index + 1];
        await supabase.from("scan_runs").update({
          steps_results: updatedResults,
          current_step: step_index + 1,
          current_step_label: nextStep.label,
        }).eq("id", scan_run_id);

        // Chain to next step (non-blocking)
        fetch(`${supabaseUrl}/functions/v1/run-full-scan`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
          body: JSON.stringify({ action: "process_step", scan_run_id, step_index: step_index + 1 }),
        }).catch((e) => console.error("Failed to chain next step:", e));
      } else {
        // ── FINALIZE: All steps done ──
        const totalDuration = Object.values(updatedResults).reduce(
          (sum: number, r: any) => sum + (r?._duration_ms || 0), 0
        );
        const unified = buildUnifiedResult(updatedResults, totalDuration);
        const issuesCount = unified.broken_flows.length + unified.fake_features.length +
          unified.interaction_failures.length + unified.data_issues.length;

        // Persist unified result to ai_scan_results
        await supabase.from("ai_scan_results").insert({
          scan_type: "full_orchestrated",
          results: unified,
          overall_score: unified.system_health_score,
          overall_status: unified.system_health_score >= 75 ? "healthy" : unified.system_health_score >= 50 ? "warning" : "critical",
          executive_summary: `Full scan: ${unified.system_health_score}/100 | ${unified.broken_flows.length} broken flows | ${unified.fake_features.length} fake features | ${unified.interaction_failures.length} interaction failures | ${unified.data_issues.length} data issues | Blocker: ${unified.blocker ? "YES" : "none"}`,
          issues_count: issuesCount,
          scanned_by: scanRun.started_by,
        });

        // ── Save each step result as individual ai_scan_results entry ──
        // This makes the data available in each scanner's overview tab
        for (const stepDef of STEPS) {
          const stepRes = updatedResults[stepDef.id];
          if (!stepRes || stepRes.failed) continue;

          const stepScore = stepRes.overall_score ?? stepRes.system_score ?? stepRes.score ?? stepRes.health_score ?? stepRes.sync_score ?? stepRes.ux_score ?? stepRes.interaction_score ?? null;
          const stepIssues = stepRes.issues_found ?? stepRes.issues?.length ?? stepRes.dead_elements?.length ?? stepRes.mismatches?.length ?? 0;

          await supabase.from("ai_scan_results").insert({
            scan_type: stepDef.scanType,
            results: stepRes,
            overall_score: stepScore,
            overall_status: stepScore != null ? (stepScore >= 75 ? "healthy" : stepScore >= 50 ? "warning" : "critical") : null,
            executive_summary: stepRes.executive_summary || stepRes.summary || `${stepDef.id}: score ${stepScore ?? '?'}, ${stepIssues} issues`,
            issues_count: stepIssues,
            tasks_created: stepRes.tasks_created || 0,
            scanned_by: scanRun.started_by,
          });
        }

        // ── Auto-generate work items from ALL findings ──
        let workItemsCreated = 0;
        const allWorkIssues: { title: string; priority: string; item_type: string; description?: string }[] = [];

        // Blocker
        if (unified.blocker) {
          allWorkIssues.push({
            title: `BLOCKER: ${unified.blocker.description || unified.blocker.title || "Critical blocker detected"}`.slice(0, 120),
            priority: "critical",
            item_type: "bug",
          });
        }

        // Broken flows
        for (const flow of unified.broken_flows.slice(0, 8)) {
          allWorkIssues.push({
            title: `Broken flow: ${flow.description || flow.route || flow.issue || "unknown"}`.slice(0, 120),
            priority: "high",
            item_type: "bug",
            description: flow.fix_suggestion || flow.detail || "",
          });
        }

        // Fake features
        for (const fake of unified.fake_features.slice(0, 8)) {
          allWorkIssues.push({
            title: `Fake feature: ${fake.name || fake.component || fake.description || "unknown"}`.slice(0, 120),
            priority: "high",
            item_type: "improvement",
            description: fake.reason || fake.detail || "",
          });
        }

        // Interaction failures
        for (const fail of unified.interaction_failures.slice(0, 8)) {
          allWorkIssues.push({
            title: `Interaction fail: ${fail.title || fail.element || fail.description || "unknown"}`.slice(0, 120),
            priority: fail.severity === "critical" ? "critical" : "high",
            item_type: "bug",
            description: fail.fix_suggestion || fail.detail || fail.issue || "",
          });
        }

        // Data issues
        for (const issue of unified.data_issues.slice(0, 8)) {
          allWorkIssues.push({
            title: `Data issue: ${issue.title || issue.field || issue.description || "unknown"}`.slice(0, 120),
            priority: issue.severity === "critical" ? "critical" : "medium",
            item_type: "bug",
            description: issue.fix_suggestion || issue.detail || "",
          });
        }

        // Collect per-step issues not already covered by unified categories
        for (const stepDef of STEPS) {
          const stepRes = updatedResults[stepDef.id];
          if (!stepRes || stepRes.failed) continue;

          // Collect issues from various possible fields
          const stepIssues = stepRes.issues || stepRes.critical_issues || stepRes.dead_elements || stepRes.mismatches || [];
          for (const si of stepIssues.slice(0, 5)) {
            const title = `[${stepDef.id}] ${si.title || si.element || si.field || si.description || "Issue"}`.slice(0, 120);
            // Check if this issue is already in allWorkIssues (fuzzy match)
            const titleLower = title.toLowerCase();
            const isDupe = allWorkIssues.some(existing => {
              const el = existing.title.toLowerCase();
              return el.includes(titleLower.substring(0, 30)) || titleLower.includes(el.substring(0, 30));
            });
            if (isDupe) continue;

            allWorkIssues.push({
              title,
              priority: si.severity === "critical" ? "critical" : si.severity === "high" ? "high" : "medium",
              item_type: "bug",
              description: si.fix_suggestion || si.description || si.detail || si.issue || "",
            });
          }
        }

        // Deduplicate against existing work items and insert
        for (const issue of allWorkIssues) {
          const searchTitle = issue.title.substring(0, 40);
          const { data: existing } = await supabase
            .from("work_items")
            .select("id")
            .ilike("title", `%${searchTitle}%`)
            .in("status", ["open", "claimed", "in_progress", "escalated"])
            .limit(1);
          if (existing?.length) continue;

          const { error } = await supabase.from("work_items").insert({
            title: issue.title,
            description: issue.description || "Auto-generated from full orchestrated scan",
            status: "open",
            priority: issue.priority,
            item_type: issue.item_type,
            source_type: "ai_scan",
            ai_detected: true,
          });
          if (!error) workItemsCreated++;
        }

        // Finalize scan run
        const execSummary = `${unified.system_health_score}/100 — ${issuesCount} issues — ${workItemsCreated} uppgifter skapade`;
        await supabase.from("scan_runs").update({
          status: "done",
          completed_at: new Date().toISOString(),
          steps_results: updatedResults,
          unified_result: unified,
          system_health_score: unified.system_health_score,
          executive_summary: execSummary,
          work_items_created: workItemsCreated,
          current_step: STEPS.length,
          current_step_label: "Klar ✓",
        }).eq("id", scan_run_id);
      }

      return new Response(JSON.stringify({ ok: true, step: step.id, step_index }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── STATUS: Check current scan status ──
    if (action === "status") {
      // Get latest or specific scan run
      let query = supabase.from("scan_runs").select("*");
      if (scan_run_id) {
        query = query.eq("id", scan_run_id);
      } else {
        query = query.order("created_at", { ascending: false }).limit(1);
      }
      const { data } = await query.single();
      return new Response(JSON.stringify(data || null), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), { status: 400, headers: corsHeaders });
  } catch (e: any) {
    console.error("run-full-scan error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
