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

const MAX_ITERATIONS = 3;

// ── Helper: Load scan focus memory (historical hotspots) ──
async function loadFocusMemory(supabase: any): Promise<any[]> {
  const { data } = await supabase
    .from("scan_focus_memory")
    .select("*")
    .order("issue_count", { ascending: false })
    .limit(50);
  return data || [];
}

// ── Helper: Save/update focus memory after scan ──
async function saveFocusMemory(supabase: any, unified: any, highRiskAreas: any[], patterns: any[]) {
  const hotspots: Record<string, { focus_type: string; label: string; issues: number; severity: string; scan_types: Set<string> }> = {};

  // Extract from high-risk areas
  for (const area of highRiskAreas) {
    const key = `component::${(area.component || "unknown").toLowerCase()}`;
    if (!hotspots[key]) hotspots[key] = { focus_type: "component", label: area.component || "unknown", issues: 0, severity: "medium", scan_types: new Set() };
    hotspots[key].issues += area.issue_count || 1;
    if (area.risk_level === "critical") hotspots[key].severity = "critical";
    else if (area.risk_level === "high" && hotspots[key].severity !== "critical") hotspots[key].severity = "high";
  }

  // Extract from broken flows (pages/routes)
  for (const flow of (unified.broken_flows || [])) {
    const route = flow.route || flow.page || flow.path || "";
    if (!route) continue;
    const key = `page::${route.toLowerCase()}`;
    if (!hotspots[key]) hotspots[key] = { focus_type: "page", label: route, issues: 0, severity: "medium", scan_types: new Set() };
    hotspots[key].issues += 1;
    hotspots[key].scan_types.add("data_integrity");
  }

  // Extract from interaction failures
  for (const fail of (unified.interaction_failures || [])) {
    const comp = fail.component || fail.element || fail.page || "";
    if (!comp) continue;
    const key = `flow::${comp.toLowerCase()}`;
    if (!hotspots[key]) hotspots[key] = { focus_type: "flow", label: comp, issues: 0, severity: "medium", scan_types: new Set() };
    hotspots[key].issues += 1;
    hotspots[key].scan_types.add("interaction_qa");
    if (fail.severity === "critical") hotspots[key].severity = "critical";
  }

  // Extract from data issues
  for (const issue of (unified.data_issues || [])) {
    const comp = issue.component || issue.table || issue.field || "";
    if (!comp) continue;
    const key = `component::${comp.toLowerCase()}`;
    if (!hotspots[key]) hotspots[key] = { focus_type: "component", label: comp, issues: 0, severity: "medium", scan_types: new Set() };
    hotspots[key].issues += 1;
    hotspots[key].scan_types.add("sync_scan");
  }

  // Upsert into scan_focus_memory
  for (const [focusKey, data] of Object.entries(hotspots)) {
    const { data: existing } = await supabase
      .from("scan_focus_memory")
      .select("id, issue_count, scan_count, related_scan_types")
      .eq("focus_key", focusKey)
      .limit(1)
      .single();

    if (existing) {
      const mergedTypes = new Set([...(existing.related_scan_types || []), ...data.scan_types]);
      await supabase.from("scan_focus_memory").update({
        issue_count: existing.issue_count + data.issues,
        scan_count: existing.scan_count + 1,
        severity: data.severity === "critical" ? "critical" : existing.severity || data.severity,
        last_seen_at: new Date().toISOString(),
        related_scan_types: [...mergedTypes],
        updated_at: new Date().toISOString(),
      }).eq("id", existing.id);
    } else {
      await supabase.from("scan_focus_memory").insert({
        focus_key: focusKey,
        focus_type: data.focus_type,
        label: data.label,
        issue_count: data.issues,
        severity: data.severity,
        related_scan_types: [...data.scan_types],
        last_seen_at: new Date().toISOString(),
        first_seen_at: new Date().toISOString(),
      });
    }
  }
}

// ── Helper: Prioritize scan steps based on focus memory ──
function prioritizeSteps(steps: typeof STEPS, focusMemory: any[]): typeof STEPS {
  if (!focusMemory.length) return steps;

  // Build a relevance score per scan type from focus memory
  const scanTypeScores: Record<string, number> = {};
  for (const mem of focusMemory) {
    for (const st of (mem.related_scan_types || [])) {
      scanTypeScores[st] = (scanTypeScores[st] || 0) + mem.issue_count;
    }
  }

  // Sort steps: high-issue scan types first, preserve order for ties
  const scored = steps.map((s, i) => ({
    step: s,
    score: scanTypeScores[s.scanType] || 0,
    originalIndex: i,
  }));
  scored.sort((a, b) => b.score - a.score || a.originalIndex - b.originalIndex);
  return scored.map(s => s.step);
}

// ── Helper: Build unified result from step results ──
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

// ── Helper: Extract patterns from findings for re-scan targeting ──
function extractPatterns(unified: any, rootCauseData: any[]): { patterns: any[]; highRiskAreas: any[]; systemicIssues: any[] } {
  const patterns: any[] = [];
  const highRiskAreas: any[] = [];
  const componentCounts: Record<string, number> = {};
  const failureTypes: Record<string, number> = {};

  // ── Cross-pattern buckets ──
  const componentTypeBucket: Record<string, any[]> = {};   // e.g. "modal" → [issues]
  const interactionTypeBucket: Record<string, any[]> = {}; // e.g. "scroll", "click"
  const layoutPatternBucket: Record<string, any[]> = {};   // e.g. "overflow", "z-index"

  const COMPONENT_KEYWORDS = ["modal", "dialog", "drawer", "dropdown", "popover", "tooltip", "accordion", "tab", "form", "input", "select", "card", "table", "sidebar", "header", "footer", "nav", "menu", "carousel", "sheet"];
  const INTERACTION_KEYWORDS = ["scroll", "click", "hover", "focus", "drag", "swipe", "submit", "toggle", "expand", "collapse", "close", "open", "resize"];
  const LAYOUT_KEYWORDS = ["overflow", "z-index", "position", "sticky", "fixed", "absolute", "flex", "grid", "responsive", "mobile", "truncat", "clip", "hidden"];

  function classifyIssue(issue: any) {
    const text = JSON.stringify(issue).toLowerCase();

    // Classify by component type
    for (const kw of COMPONENT_KEYWORDS) {
      if (text.includes(kw)) {
        if (!componentTypeBucket[kw]) componentTypeBucket[kw] = [];
        componentTypeBucket[kw].push(issue);
      }
    }

    // Classify by interaction type
    for (const kw of INTERACTION_KEYWORDS) {
      if (text.includes(kw)) {
        if (!interactionTypeBucket[kw]) interactionTypeBucket[kw] = [];
        interactionTypeBucket[kw].push(issue);
      }
    }

    // Classify by layout pattern
    for (const kw of LAYOUT_KEYWORDS) {
      if (text.includes(kw)) {
        if (!layoutPatternBucket[kw]) layoutPatternBucket[kw] = [];
        layoutPatternBucket[kw].push(issue);
      }
    }
  }

  // Collect all issues into a flat list and classify each
  const allIssues = [
    ...(unified.broken_flows || []).map((i: any) => ({ ...i, _source: "broken_flow" })),
    ...(unified.interaction_failures || []).map((i: any) => ({ ...i, _source: "interaction_failure" })),
    ...(unified.data_issues || []).map((i: any) => ({ ...i, _source: "data_issue" })),
    ...(unified.fake_features || []).map((i: any) => ({ ...i, _source: "fake_feature" })),
  ];

  for (const issue of allIssues) {
    classifyIssue(issue);
    const comp = issue.component || issue.element || issue.route || issue.area || issue.page || issue.name || "unknown";
    componentCounts[comp] = (componentCounts[comp] || 0) + 1;
    const ftype = issue.type || issue.category || issue.interaction_type || issue._source;
    failureTypes[ftype] = (failureTypes[ftype] || 0) + 1;
  }

  // ── Cross-Pattern Detection: find systemic issues ──
  const systemicIssues: any[] = [];

  // Detect systemic issues by component type (e.g. multiple modals broken)
  for (const [compType, issues] of Object.entries(componentTypeBucket)) {
    if (issues.length >= 2) {
      // Check if issues come from different sources (cross-pattern)
      const sources = new Set(issues.map((i: any) => i._source));
      const uniqueComponents = new Set(issues.map((i: any) => i.component || i.element || i.title || "").filter(Boolean));

      if (sources.size >= 2 || uniqueComponents.size >= 2) {
        systemicIssues.push({
          type: "component_type",
          pattern: compType,
          label: `Systemiskt problem: ${compType}-komponenter`,
          description: `${issues.length} problem hittade i ${compType}-komponenter (${[...sources].join(", ")}). Trolig gemensam grundorsak.`,
          affected_count: issues.length,
          sources: [...sources],
          affected_components: [...uniqueComponents].slice(0, 8),
          severity: issues.length >= 4 ? "critical" : "high",
          examples: issues.slice(0, 3).map((i: any) => i.title || i.description || i.element || "unknown"),
        });
      }
    }
  }

  // Detect systemic issues by interaction type (e.g. scroll broken everywhere)
  for (const [interType, issues] of Object.entries(interactionTypeBucket)) {
    if (issues.length >= 2) {
      const uniqueComponents = new Set(issues.map((i: any) => i.component || i.element || i.title || "").filter(Boolean));
      if (uniqueComponents.size >= 2) {
        systemicIssues.push({
          type: "interaction_type",
          pattern: interType,
          label: `Systemiskt problem: ${interType}-interaktion`,
          description: `${issues.length} ${interType}-relaterade problem i ${uniqueComponents.size} olika komponenter. Gemensamt interaktionsproblem.`,
          affected_count: issues.length,
          affected_components: [...uniqueComponents].slice(0, 8),
          severity: issues.length >= 4 ? "critical" : "high",
          examples: issues.slice(0, 3).map((i: any) => i.title || i.description || i.element || "unknown"),
        });
      }
    }
  }

  // Detect systemic issues by layout pattern (e.g. overflow problems everywhere)
  for (const [layoutType, issues] of Object.entries(layoutPatternBucket)) {
    if (issues.length >= 2) {
      const uniqueComponents = new Set(issues.map((i: any) => i.component || i.element || i.title || "").filter(Boolean));
      if (uniqueComponents.size >= 2) {
        systemicIssues.push({
          type: "layout_pattern",
          pattern: layoutType,
          label: `Systemiskt problem: ${layoutType}-layout`,
          description: `${issues.length} ${layoutType}-relaterade layoutproblem i ${uniqueComponents.size} komponenter. Gemensamt CSS/layout-problem.`,
          affected_count: issues.length,
          affected_components: [...uniqueComponents].slice(0, 8),
          severity: issues.length >= 3 ? "critical" : "high",
          examples: issues.slice(0, 3).map((i: any) => i.title || i.description || i.element || "unknown"),
        });
      }
    }
  }

  // Cross-bucket detection: issues appearing in BOTH component+interaction buckets
  for (const [compType, compIssues] of Object.entries(componentTypeBucket)) {
    for (const [interType, interIssues] of Object.entries(interactionTypeBucket)) {
      const overlap = compIssues.filter((ci: any) => interIssues.some((ii: any) => ci === ii));
      if (overlap.length >= 2) {
        const alreadyDetected = systemicIssues.some(s => s.pattern === `${compType}+${interType}`);
        if (!alreadyDetected) {
          systemicIssues.push({
            type: "cross_pattern",
            pattern: `${compType}+${interType}`,
            label: `Korsmönster: ${compType} × ${interType}`,
            description: `${overlap.length} problem där ${interType}-interaktion i ${compType}-komponenter misslyckas. Trolig delad bugg.`,
            affected_count: overlap.length,
            severity: "critical",
            examples: overlap.slice(0, 3).map((i: any) => i.title || i.description || i.element || "unknown"),
          });
        }
      }
    }
  }

  // Identify high-risk areas
  for (const [comp, count] of Object.entries(componentCounts)) {
    if (count >= 2) {
      highRiskAreas.push({ component: comp, issue_count: count, risk_level: count >= 4 ? "critical" : "high" });
    }
  }

  // Extract patterns from root_cause_memory
  for (const rc of rootCauseData) {
    if (rc.recurrence_count >= 2) {
      patterns.push({
        pattern_key: rc.pattern_key,
        affected_system: rc.affected_system,
        root_cause: rc.root_cause,
        recurrence_count: rc.recurrence_count,
        severity: rc.severity,
      });
    }
  }

  // Extract failure type patterns
  for (const [ftype, count] of Object.entries(failureTypes)) {
    if (count >= 2) {
      patterns.push({
        pattern_key: `failure_type::${ftype}`,
        affected_system: ftype,
        root_cause: `Recurring ${ftype} failures (${count} instances)`,
        recurrence_count: count,
        severity: count >= 4 ? "critical" : "high",
      });
    }
  }

  return { patterns, highRiskAreas, systemicIssues };
}

// ── Helper: Build targeted re-scan steps based on patterns ──
function buildTargetedSteps(patterns: any[], highRiskAreas: any[], iteration: number): typeof STEPS {
  const targeted: typeof STEPS = [];
  const addedTypes = new Set<string>();

  // Focus on high-risk areas
  for (const area of highRiskAreas) {
    const comp = area.component?.toLowerCase() || "";
    // Map component types to relevant scan steps
    if ((comp.includes("modal") || comp.includes("dialog") || comp.includes("drawer") || comp.includes("scroll")) && !addedTypes.has("interaction_qa")) {
      targeted.push({ id: `rescan_interaction_${iteration}`, scanType: "interaction_qa", label: `Djupskannar interaktioner (iteration ${iteration})...` });
      addedTypes.add("interaction_qa");
    }
    if ((comp.includes("form") || comp.includes("input") || comp.includes("checkout")) && !addedTypes.has("sync_scan")) {
      targeted.push({ id: `rescan_sync_${iteration}`, scanType: "sync_scan", label: `Djupskannar databindning (iteration ${iteration})...` });
      addedTypes.add("sync_scan");
    }
    if ((comp.includes("nav") || comp.includes("route") || comp.includes("link") || comp.includes("page")) && !addedTypes.has("nav_scan")) {
      targeted.push({ id: `rescan_nav_${iteration}`, scanType: "nav_scan", label: `Djupskannar navigering (iteration ${iteration})...` });
      addedTypes.add("nav_scan");
    }
    if ((comp.includes("button") || comp.includes("click") || comp.includes("action")) && !addedTypes.has("human_test")) {
      targeted.push({ id: `rescan_human_${iteration}`, scanType: "human_test", label: `Djupskannar användarbeteende (iteration ${iteration})...` });
      addedTypes.add("human_test");
    }
  }

  // Focus on recurring patterns
  for (const pattern of patterns) {
    const sys = pattern.affected_system?.toLowerCase() || "";
    if ((sys.includes("data") || sys.includes("sync") || sys.includes("binding")) && !addedTypes.has("data_integrity")) {
      targeted.push({ id: `rescan_data_${iteration}`, scanType: "data_integrity", label: `Djupskannar dataflöden (iteration ${iteration})...` });
      addedTypes.add("data_integrity");
    }
    if ((sys.includes("feature") || sys.includes("fake") || sys.includes("ui")) && !addedTypes.has("feature_detection")) {
      targeted.push({ id: `rescan_features_${iteration}`, scanType: "feature_detection", label: `Djupskannar funktioner (iteration ${iteration})...` });
      addedTypes.add("feature_detection");
    }
    if ((sys.includes("regression") || sys.includes("system")) && !addedTypes.has("system_scan")) {
      targeted.push({ id: `rescan_system_${iteration}`, scanType: "system_scan", label: `Djupskannar regressioner (iteration ${iteration})...` });
      addedTypes.add("system_scan");
    }
  }

  // If we have issues but no targeted steps, do a broad re-scan of critical scanners
  if (targeted.length === 0 && (highRiskAreas.length > 0 || patterns.length > 0)) {
    targeted.push({ id: `rescan_broad_interaction_${iteration}`, scanType: "interaction_qa", label: `Bred djupskanning (iteration ${iteration})...` });
    targeted.push({ id: `rescan_broad_system_${iteration}`, scanType: "system_scan", label: `Systemverifiering (iteration ${iteration})...` });
  }

  return targeted;
}

// ── Helper: Count new issues not seen in previous iterations ──
function countNewIssues(currentUnified: any, previousIssueKeys: Set<string>): { newCount: number; newKeys: Set<string> } {
  const allIssues = [
    ...(currentUnified.broken_flows || []),
    ...(currentUnified.fake_features || []),
    ...(currentUnified.interaction_failures || []),
    ...(currentUnified.data_issues || []),
  ];

  const newKeys = new Set<string>();
  let newCount = 0;

  for (const issue of allIssues) {
    const key = (issue.title || issue.description || issue.element || issue.component || issue.route || JSON.stringify(issue)).substring(0, 80).toLowerCase();
    if (!previousIssueKeys.has(key)) {
      newCount++;
      newKeys.add(key);
    }
  }

  return { newCount, newKeys };
}

// ── Helper: Create work items from unified findings ──
async function createWorkItems(supabase: any, unified: any, startedBy: string): Promise<number> {
  let workItemsCreated = 0;
  const allWorkIssues: { title: string; priority: string; item_type: string; description?: string }[] = [];

  if (unified.blocker) {
    allWorkIssues.push({
      title: `BLOCKER: ${unified.blocker.description || unified.blocker.title || "Critical blocker detected"}`.slice(0, 120),
      priority: "critical",
      item_type: "bug",
    });
  }

  for (const flow of (unified.broken_flows || []).slice(0, 8)) {
    allWorkIssues.push({
      title: `Broken flow: ${flow.description || flow.route || flow.issue || "unknown"}`.slice(0, 120),
      priority: "high",
      item_type: "bug",
      description: flow.fix_suggestion || flow.detail || "",
    });
  }

  for (const fake of (unified.fake_features || []).slice(0, 8)) {
    allWorkIssues.push({
      title: `Fake feature: ${fake.name || fake.component || fake.description || "unknown"}`.slice(0, 120),
      priority: "high",
      item_type: "improvement",
      description: fake.reason || fake.detail || "",
    });
  }

  for (const fail of (unified.interaction_failures || []).slice(0, 8)) {
    allWorkIssues.push({
      title: `Interaction fail: ${fail.title || fail.element || fail.description || "unknown"}`.slice(0, 120),
      priority: fail.severity === "critical" ? "critical" : "high",
      item_type: "bug",
      description: fail.fix_suggestion || fail.detail || fail.issue || "",
    });
  }

  for (const issue of (unified.data_issues || []).slice(0, 8)) {
    allWorkIssues.push({
      title: `Data issue: ${issue.title || issue.field || issue.description || "unknown"}`.slice(0, 120),
      priority: issue.severity === "critical" ? "critical" : "medium",
      item_type: "bug",
      description: issue.fix_suggestion || issue.detail || "",
    });
  }

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
      description: issue.description || "Auto-generated from adaptive recursive scan",
      status: "open",
      priority: issue.priority,
      item_type: issue.item_type,
      source_type: "ai_scan",
      ai_detected: true,
    });
    if (!error) workItemsCreated++;
  }

  return workItemsCreated;
}

// ── Helper: Persist per-step scan results ──
async function persistStepResults(supabase: any, steps: typeof STEPS, results: Record<string, any>, startedBy: string) {
  for (const stepDef of steps) {
    const stepRes = results[stepDef.id];
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
      scanned_by: startedBy,
    });
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    const { action, scan_run_id, step_index, iteration } = body;

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

      // Check for running scan (global lock)
      const { data: running } = await supabase
        .from("scan_runs")
        .select("id, started_by, current_step_label, started_at")
        .eq("status", "running")
        .limit(1);

      if (running?.length) {
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

      // Create scan run
      const { data: scanRun, error: insertError } = await supabase.from("scan_runs").insert({
        status: "running",
        started_by: userId,
        current_step: 0,
        total_steps: STEPS.length,
        current_step_label: STEPS[0].label,
        steps_results: {},
        iteration: 1,
        max_iterations: MAX_ITERATIONS,
        iteration_results: [],
        pattern_discoveries: [],
        high_risk_areas: [],
        coverage_score: 0,
        total_new_issues: 0,
      }).select("id").single();

      if (insertError || !scanRun) {
        return new Response(JSON.stringify({ error: "Failed to create scan run" }), { status: 500, headers: corsHeaders });
      }

      // Chain first step
      fetch(`${supabaseUrl}/functions/v1/run-full-scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
        body: JSON.stringify({ action: "process_step", scan_run_id: scanRun.id, step_index: 0, iteration: 1 }),
      }).catch((e) => console.error("Failed to chain first step:", e));

      return new Response(JSON.stringify({ scan_run_id: scanRun.id, status: "started" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── PROCESS_STEP: Execute one scan step then chain to next ──
    if (action === "process_step" && scan_run_id && step_index !== undefined) {
      const currentIteration = iteration || 1;

      const { data: scanRun } = await supabase.from("scan_runs").select("*").eq("id", scan_run_id).single();
      if (!scanRun || scanRun.status !== "running") {
        return new Response(JSON.stringify({ error: "Scan not running" }), { status: 400, headers: corsHeaders });
      }

      // Determine which steps to use for this iteration
      let currentSteps = STEPS;
      if (currentIteration > 1 && scanRun._targeted_steps) {
        currentSteps = scanRun._targeted_steps;
      }

      const step = currentIteration === 1 ? STEPS[step_index] : (scanRun._targeted_steps || STEPS)[step_index];
      if (!step) {
        return new Response(JSON.stringify({ error: "Invalid step index" }), { status: 400, headers: corsHeaders });
      }

      // Update progress label
      const totalStepsAll = STEPS.length * currentIteration; // rough estimate
      await supabase.from("scan_runs").update({
        current_step: step_index,
        current_step_label: `[Iteration ${currentIteration}/${MAX_ITERATIONS}] ${step.label}`,
        iteration: currentIteration,
      }).eq("id", scan_run_id);

      // Call ai-assistant
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

        // For re-scans, include previous findings as context
        let deepScanContext: any = undefined;
        if (currentIteration > 1) {
          deepScanContext = {
            iteration: currentIteration,
            previous_patterns: scanRun.pattern_discoveries || [],
            high_risk_areas: scanRun.high_risk_areas || [],
            instruction: "This is a DEEP RE-SCAN iteration. Focus specifically on the high_risk_areas and patterns provided. Look for issues that were MISSED in previous scans. Check related components, similar UI patterns, and adjacent flows. Be more thorough than a standard scan.",
          };
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
            deep_scan_context: deepScanContext,
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
      stepResult._iteration = currentIteration;

      // Save step result
      const updatedResults = { ...(scanRun.steps_results || {}), [step.id]: stepResult };

      // Get the step list for this iteration
      const stepsForIteration = currentIteration === 1 ? STEPS : (scanRun._targeted_steps || STEPS);
      const isLastStep = step_index + 1 >= stepsForIteration.length;

      if (!isLastStep) {
        const nextStep = stepsForIteration[step_index + 1];
        await supabase.from("scan_runs").update({
          steps_results: updatedResults,
          current_step: step_index + 1,
          current_step_label: `[Iteration ${currentIteration}/${MAX_ITERATIONS}] ${nextStep.label}`,
        }).eq("id", scan_run_id);

        fetch(`${supabaseUrl}/functions/v1/run-full-scan`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
          body: JSON.stringify({ action: "process_step", scan_run_id, step_index: step_index + 1, iteration: currentIteration }),
        }).catch((e) => console.error("Failed to chain next step:", e));
      } else {
        // ── ITERATION COMPLETE — Decide: recurse or finalize ──
        await supabase.from("scan_runs").update({ steps_results: updatedResults }).eq("id", scan_run_id);

        fetch(`${supabaseUrl}/functions/v1/run-full-scan`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
          body: JSON.stringify({ action: "evaluate_iteration", scan_run_id, iteration: currentIteration }),
        }).catch((e) => console.error("Failed to chain evaluation:", e));
      }

      return new Response(JSON.stringify({ ok: true, step: step.id, step_index, iteration: currentIteration }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── EVALUATE_ITERATION: Analyze results, decide if re-scan needed ──
    if (action === "evaluate_iteration" && scan_run_id) {
      const currentIteration = iteration || 1;

      const { data: scanRun } = await supabase.from("scan_runs").select("*").eq("id", scan_run_id).single();
      if (!scanRun || scanRun.status !== "running") {
        return new Response(JSON.stringify({ error: "Scan not running" }), { status: 400, headers: corsHeaders });
      }

      await supabase.from("scan_runs").update({
        current_step_label: `[Iteration ${currentIteration}/${MAX_ITERATIONS}] Analyserar mönster...`,
      }).eq("id", scan_run_id);

      const updatedResults = scanRun.steps_results || {};
      const totalDuration = Object.values(updatedResults).reduce(
        (sum: number, r: any) => sum + (r?._duration_ms || 0), 0
      );
      const unified = buildUnifiedResult(updatedResults, totalDuration);

      // Fetch root cause memory for pattern learning
      const { data: rootCauseData } = await supabase
        .from("root_cause_memory")
        .select("pattern_key, affected_system, root_cause, recurrence_count, severity")
        .order("recurrence_count", { ascending: false })
        .limit(50);

      const { patterns, highRiskAreas, systemicIssues } = extractPatterns(unified, rootCauseData || []);

      // Build previous issue keys from all iterations
      const previousIssueKeys = new Set<string>();
      const prevIterResults = scanRun.iteration_results || [];
      for (const prevIter of prevIterResults) {
        for (const key of (prevIter.issue_keys || [])) {
          previousIssueKeys.add(key);
        }
      }

      const { newCount, newKeys } = countNewIssues(unified, previousIssueKeys);

      // Calculate coverage score
      const scannedScanTypes = new Set(Object.keys(updatedResults).map(k => {
        const step = STEPS.find(s => s.id === k);
        return step?.scanType || k;
      }));
      const baseCoverage = Math.round((scannedScanTypes.size / STEPS.length) * 100);
      const iterationBonus = Math.min(20, (currentIteration - 1) * 10);
      const coverageScore = Math.min(100, baseCoverage + iterationBonus);

      // Save iteration result
      const iterationResult = {
        iteration: currentIteration,
        new_issues_found: newCount,
        total_issues: unified.broken_flows.length + unified.fake_features.length + unified.interaction_failures.length + unified.data_issues.length,
        patterns_discovered: patterns.length,
        high_risk_areas: highRiskAreas.length,
        systemic_issues: systemicIssues.length,
        health_score: unified.system_health_score,
        issue_keys: [...newKeys],
        completed_at: new Date().toISOString(),
      };

      const allIterResults = [...prevIterResults, iterationResult];
      const allPatterns = [...(scanRun.pattern_discoveries || []), ...patterns];
      const allHighRisk = [...(scanRun.high_risk_areas || []), ...highRiskAreas];
      const totalNewIssues = (scanRun.total_new_issues || 0) + newCount;

      await supabase.from("scan_runs").update({
        iteration_results: allIterResults,
        pattern_discoveries: allPatterns,
        high_risk_areas: allHighRisk,
        coverage_score: coverageScore,
        total_new_issues: totalNewIssues,
      }).eq("id", scan_run_id);

      // ── Decide: recurse or finalize ──
      const shouldRecurse =
        currentIteration < MAX_ITERATIONS &&
        newCount > 0 &&
        (highRiskAreas.length > 0 || patterns.length > 0);

      if (shouldRecurse) {
        // Build targeted steps for next iteration
        const targetedSteps = buildTargetedSteps(patterns, highRiskAreas, currentIteration + 1);

        if (targetedSteps.length > 0) {
          // Store targeted steps in scan run (as JSON since _targeted_steps isn't a column)
          const totalStepsNow = STEPS.length + targetedSteps.length * (currentIteration);
          await supabase.from("scan_runs").update({
            current_step_label: `[Iteration ${currentIteration + 1}/${MAX_ITERATIONS}] ${targetedSteps[0].label}`,
            current_step: 0,
            total_steps: totalStepsNow,
            _targeted_steps: targetedSteps,
          }).eq("id", scan_run_id);

          // Chain to first step of next iteration
          fetch(`${supabaseUrl}/functions/v1/run-full-scan`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
            body: JSON.stringify({ action: "process_step", scan_run_id, step_index: 0, iteration: currentIteration + 1 }),
          }).catch((e) => console.error("Failed to chain re-scan:", e));

          return new Response(JSON.stringify({ ok: true, action: "recursing", iteration: currentIteration + 1, targeted_steps: targetedSteps.length }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      // ── FINALIZE: No more iterations needed ──
      fetch(`${supabaseUrl}/functions/v1/run-full-scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
        body: JSON.stringify({ action: "finalize", scan_run_id }),
      }).catch((e) => console.error("Failed to chain finalize:", e));

      return new Response(JSON.stringify({ ok: true, action: "finalizing", iterations_completed: currentIteration }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── FINALIZE: Persist all results and create work items ──
    if (action === "finalize" && scan_run_id) {
      const { data: scanRun } = await supabase.from("scan_runs").select("*").eq("id", scan_run_id).single();
      if (!scanRun || scanRun.status !== "running") {
        return new Response(JSON.stringify({ error: "Scan not running" }), { status: 400, headers: corsHeaders });
      }

      await supabase.from("scan_runs").update({
        current_step_label: "Sammanställer resultat...",
      }).eq("id", scan_run_id);

      const updatedResults = scanRun.steps_results || {};
      const totalDuration = Object.values(updatedResults).reduce(
        (sum: number, r: any) => sum + (r?._duration_ms || 0), 0
      );
      const unified = buildUnifiedResult(updatedResults, totalDuration);
      const issuesCount = unified.broken_flows.length + unified.fake_features.length +
        unified.interaction_failures.length + unified.data_issues.length;

      const iterationsCompleted = scanRun.iteration || 1;
      const patternDiscoveries = scanRun.pattern_discoveries || [];
      const highRiskAreas = scanRun.high_risk_areas || [];
      const coverageScore = scanRun.coverage_score || 0;

      // Run cross-pattern detection on final results
      const { data: finalRootCause } = await supabase
        .from("root_cause_memory")
        .select("pattern_key, affected_system, root_cause, recurrence_count, severity")
        .order("recurrence_count", { ascending: false })
        .limit(50);
      const { systemicIssues } = extractPatterns(unified, finalRootCause || []);

      // Enrich unified result with adaptive scan metadata
      const adaptiveResult = {
        ...unified,
        adaptive_scan: {
          iterations: iterationsCompleted,
          new_issues_found: scanRun.total_new_issues || 0,
          pattern_discoveries: patternDiscoveries,
          high_risk_areas: highRiskAreas,
          systemic_issues: systemicIssues,
          coverage_score: coverageScore,
          iteration_results: scanRun.iteration_results || [],
        },
      };

      // Persist unified result
      await supabase.from("ai_scan_results").insert({
        scan_type: "full_orchestrated",
        results: adaptiveResult,
        overall_score: unified.system_health_score,
        overall_status: unified.system_health_score >= 75 ? "healthy" : unified.system_health_score >= 50 ? "warning" : "critical",
        executive_summary: `Adaptive scan (${iterationsCompleted} iter): ${unified.system_health_score}/100 | ${issuesCount} issues | ${systemicIssues.length} systemic | ${patternDiscoveries.length} patterns | ${coverageScore}%`,
        issues_count: issuesCount,
        scanned_by: scanRun.started_by,
      });

      // Persist per-step results
      await persistStepResults(supabase, STEPS, updatedResults, scanRun.started_by);

      // Create work items from findings + systemic issues
      let workItemsCreated = await createWorkItems(supabase, unified, scanRun.started_by);

      // Create work items from systemic issues
      for (const si of systemicIssues) {
        const searchTitle = si.label.substring(0, 40);
        const { data: existing } = await supabase
          .from("work_items")
          .select("id")
          .ilike("title", `%${searchTitle}%`)
          .in("status", ["open", "claimed", "in_progress", "escalated"])
          .limit(1);
        if (existing?.length) continue;

        const { error } = await supabase.from("work_items").insert({
          title: `🔗 ${si.label}`.slice(0, 120),
          description: `${si.description}\n\nExempel: ${si.examples?.join(", ") || "N/A"}\nPåverkade: ${si.affected_components?.join(", ") || "N/A"}`,
          status: "open",
          priority: si.severity === "critical" ? "critical" : "high",
          item_type: "bug",
          source_type: "ai_scan",
          ai_detected: true,
        });
        if (!error) workItemsCreated++;
      }

      // Finalize scan run
      const execSummary = `${unified.system_health_score}/100 — ${issuesCount} issues — ${iterationsCompleted} iterationer — ${patternDiscoveries.length} mönster — ${coverageScore}% täckning — ${workItemsCreated} uppgifter`;
      await supabase.from("scan_runs").update({
        status: "done",
        completed_at: new Date().toISOString(),
        steps_results: updatedResults,
        unified_result: adaptiveResult,
        system_health_score: unified.system_health_score,
        executive_summary: execSummary,
        work_items_created: workItemsCreated,
        current_step: STEPS.length,
        current_step_label: `Klar ✓ (${iterationsCompleted} iterationer)`,
      }).eq("id", scan_run_id);

      return new Response(JSON.stringify({ ok: true, action: "finalized", iterations: iterationsCompleted, work_items_created: workItemsCreated }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── STATUS: Check current scan status ──
    if (action === "status") {
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
