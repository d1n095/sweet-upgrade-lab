import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

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
  { id: "ui_flow_integrity", scanType: "ui_flow_integrity", label: "Verifierar UI-flödesintegritet..." },
];

const MAX_ITERATIONS = 3;

// ── SYSTEM STAGE: Context awareness ──
type SystemStage = "development" | "staging" | "production";

async function getSystemStage(supabase: any): Promise<SystemStage> {
  try {
    const { data } = await supabase
      .from("store_settings")
      .select("key, value, text_value")
      .eq("key", "system_stage")
      .maybeSingle();
    const textVal = data?.text_value;
    if (textVal === "production" || textVal === "staging") return textVal;
    if (data?.value === true || data?.value === "production") return "production";
    return "development";
  } catch {
    return "development";
  }
}

// ── Issue Fingerprint: deterministic identity key ──
// Combines component, type, location, and description pattern for persistent identity across scans.
function generateFingerprint(issue: any): string {
  const component = (issue.component || issue.element || issue.table || issue.entity || issue.chain || "unknown").toLowerCase().replace(/[^a-z0-9]/g, "_").slice(0, 30);
  const type = (issue.type || issue.failure_type || issue.category || issue.item_type || issue._source || "general").toLowerCase().replace(/[^a-z0-9]/g, "_").slice(0, 20);
  const location = (issue.route || issue.page || issue.field || issue.step || "global").toLowerCase().replace(/[^a-z0-9]/g, "_").slice(0, 30);
  // Extract a stable description pattern: first 40 chars of normalized description/title
  const descRaw = (issue.description || issue.title || issue.fix_suggestion || "").toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
  const descPattern = descRaw.split(/\s+/).slice(0, 5).join("_").slice(0, 30);
  return `${component}::${type}::${location}::${descPattern}`;
}

// ── Group similar issues by fingerprint prefix ──
function groupSimilarIssues(issues: any[]): any[] {
  const groups: Map<string, any[]> = new Map();
  
  for (const issue of issues) {
    const fp = generateFingerprint(issue);
    // Group by component::type (first 2 segments of 4-part fingerprint)
    const groupKey = fp.split("::").slice(0, 2).join("::");
    if (!groups.has(groupKey)) groups.set(groupKey, []);
    groups.get(groupKey)!.push({ ...issue, _fingerprint: fp });
  }
  
  const result: any[] = [];
  for (const [groupKey, items] of groups) {
    if (items.length === 1) {
      result.push(items[0]);
    } else {
      // Use the highest-severity issue as the representative
      const sorted = items.sort((a, b) => {
        const sevOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
        return (sevOrder[a.severity] ?? 2) - (sevOrder[b.severity] ?? 2);
      });
      const representative = { ...sorted[0] };
      representative._similar_count = items.length - 1;
      representative._similar_issues = items.slice(1).map(i => i.title || i.description || "").filter(Boolean).slice(0, 5);
      representative._group_key = groupKey;
      result.push(representative);
    }
  }
  
  return result;
}

// ── Context-aware filtering: suppress false positives based on stage ──
// DEBUG MODE: Relaxed — only suppress clearly invalid/placeholder patterns
function filterDevFalsePositives(issues: any[], stage: SystemStage): any[] {
  if (stage === "production") {
    return issues.map(issue => ({ ...issue, _filter_decision: "passed" }));
  }
  
  // DEBUG: Only suppress obviously invalid patterns (placeholder/dummy data)
  const debugIgnorePatterns = [
    /dummy|placeholder|lorem/i,
    /saknar\s*test\s*data/i,
  ];
  
  return issues.map(issue => {
    const text = `${issue.title || ""} ${issue.description || ""}`;
    const isDevExpected = debugIgnorePatterns.some(p => p.test(text));
    if (isDevExpected) {
      return { ...issue, _dev_expected: true, severity: "info", _original_severity: issue.severity, _filter_decision: "filtered_out", _filter_reason: "dev_placeholder" };
    }
    return { ...issue, _filter_decision: "passed" };
  });
}

// ── SYSTEM OVERVIEW: Build structured status per domain ──
interface SystemOverview {
  ui_layout: { status: "healthy" | "warning" | "critical"; score: number; issues: number; summary: string };
  interaction: { status: "healthy" | "warning" | "critical"; score: number; issues: number; summary: string };
  data_sync: { status: "healthy" | "warning" | "critical"; score: number; issues: number; summary: string };
  pipeline: { status: "healthy" | "warning" | "critical"; score: number; issues: number; summary: string };
  integration: { status: "healthy" | "warning" | "critical"; score: number; issues: number; summary: string };
  system_stage: SystemStage;
}

function buildSystemOverview(stepResults: Record<string, any>, unified: any, stage: SystemStage): SystemOverview {
  const statusFromScore = (s: number): "healthy" | "warning" | "critical" => s >= 75 ? "healthy" : s >= 50 ? "warning" : "critical";
  
  // UI/Layout
  const uiIssues = (unified.broken_flows || []).filter((f: any) => 
    /layout|overflow|scroll|z-index|position|css|style|responsive|mobile/i.test(JSON.stringify(f))
  ).length + (unified.fake_features || []).length;
  const uiScore = Math.max(0, 100 - uiIssues * 10);
  
  // Interaction
  const interactionIssues = (unified.interaction_failures || []).length;
  const interactionScore = stepResults.interaction_qa?.overall_score ?? stepResults.human_test?.overall_score ?? Math.max(0, 100 - interactionIssues * 8);
  
  // Data/Sync
  const dataIssues = (unified.data_issues || []).filter((d: any) => !d._dev_expected).length;
  const dataScore = stepResults.ui_data_binding?.overall_score ?? stepResults.data_flow_validation?.overall_score ?? Math.max(0, 100 - dataIssues * 5);
  
  // Pipeline (work items, triggers, automation)
  const behaviorIssues = (unified.behavior_failures || []).length;
  const integrityIssues = (unified.integrity_issues || []).length;
  const pipelineScore = Math.max(0, 100 - (behaviorIssues + integrityIssues) * 6);
  
  // Integration (affiliates, email, payments)
  const integrationIssues = (unified.data_issues || []).filter((d: any) => 
    /affiliate|influencer|email|payment|stripe|webhook/i.test(JSON.stringify(d))
  ).length;
  const integrationScore = Math.max(0, 100 - integrationIssues * 8);
  
  return {
    ui_layout: { status: statusFromScore(uiScore), score: uiScore, issues: uiIssues, summary: uiIssues === 0 ? "Inga layout-problem" : `${uiIssues} UI/layout-problem` },
    interaction: { status: statusFromScore(interactionScore), score: interactionScore, issues: interactionIssues, summary: interactionIssues === 0 ? "Alla interaktioner OK" : `${interactionIssues} interaktionsproblem` },
    data_sync: { status: statusFromScore(dataScore), score: dataScore, issues: dataIssues, summary: dataIssues === 0 ? "Data konsistent" : `${dataIssues} synk-/dataproblem` },
    pipeline: { status: statusFromScore(pipelineScore), score: pipelineScore, issues: behaviorIssues + integrityIssues, summary: behaviorIssues + integrityIssues === 0 ? "Pipeline fungerar" : `${behaviorIssues + integrityIssues} pipeline-problem` },
    integration: { status: statusFromScore(integrationScore), score: integrationScore, issues: integrationIssues, summary: integrationIssues === 0 ? "Integrationer OK" : `${integrationIssues} integrationsproblem` },
    system_stage: stage,
  };
}

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

  for (const area of highRiskAreas) {
    const key = `component::${(area.component || "unknown").toLowerCase()}`;
    if (!hotspots[key]) hotspots[key] = { focus_type: "component", label: area.component || "unknown", issues: 0, severity: "medium", scan_types: new Set() };
    hotspots[key].issues += area.issue_count || 1;
    if (area.risk_level === "critical") hotspots[key].severity = "critical";
    else if (area.risk_level === "high" && hotspots[key].severity !== "critical") hotspots[key].severity = "high";
  }

  for (const flow of (unified.broken_flows || [])) {
    const route = flow.route || flow.page || flow.path || "";
    if (!route) continue;
    const key = `page::${route.toLowerCase()}`;
    if (!hotspots[key]) hotspots[key] = { focus_type: "page", label: route, issues: 0, severity: "medium", scan_types: new Set() };
    hotspots[key].issues += 1;
    hotspots[key].scan_types.add("data_integrity");
  }

  for (const fail of (unified.interaction_failures || [])) {
    const comp = fail.component || fail.element || fail.page || "";
    if (!comp) continue;
    const key = `flow::${comp.toLowerCase()}`;
    if (!hotspots[key]) hotspots[key] = { focus_type: "flow", label: comp, issues: 0, severity: "medium", scan_types: new Set() };
    hotspots[key].issues += 1;
    hotspots[key].scan_types.add("interaction_qa");
    if (fail.severity === "critical") hotspots[key].severity = "critical";
  }

  for (const issue of (unified.data_issues || [])) {
    const comp = issue.component || issue.table || issue.field || "";
    if (!comp) continue;
    const key = `component::${comp.toLowerCase()}`;
    if (!hotspots[key]) hotspots[key] = { focus_type: "component", label: comp, issues: 0, severity: "medium", scan_types: new Set() };
    hotspots[key].issues += 1;
    hotspots[key].scan_types.add("sync_scan");
  }

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
  const scanTypeScores: Record<string, number> = {};
  for (const mem of focusMemory) {
    for (const st of (mem.related_scan_types || [])) {
      scanTypeScores[st] = (scanTypeScores[st] || 0) + mem.issue_count;
    }
  }
  const scored = steps.map((s, i) => ({ step: s, score: scanTypeScores[s.scanType] || 0, originalIndex: i }));
  scored.sort((a, b) => b.score - a.score || a.originalIndex - b.originalIndex);
  return scored.map(s => s.step);
}

// ── Prediction rules ──
const PREDICTION_RULES: {
  trigger: (ctx: PredictionContext) => boolean;
  predict: (ctx: PredictionContext) => { problem: string; area: string; reason: string; preventive_fixes: string[] };
}[] = [
  {
    trigger: (ctx) => countByCategory(ctx.issues, "scroll") >= 2,
    predict: () => ({
      problem: "Fler layout-/overflow-problem",
      area: "Scroll-containers, modaler, listor",
      reason: "Flera scroll-buggar tyder på globalt overflow-problem",
      preventive_fixes: [
        "Standardisera modallayout med overflow-y:auto och min-height:0",
        "Granska alla flex-containers — säkerställ overflow-hidden på föräldrar",
        "Lägg till globalt ScrollArea-wrapper för långa listor",
      ],
    }),
  },
  {
    trigger: (ctx) => countByCategory(ctx.issues, "modal") >= 2 || countByCategory(ctx.issues, "dialog") >= 2,
    predict: () => ({
      problem: "Interaktionsfel i overlay-komponenter",
      area: "Modaler, drawers, popovers",
      reason: "Upprepade modal-problem tyder på z-index eller fokushanteringsfel",
      preventive_fixes: [
        "Centralisera z-index-skalan i design tokens",
        "Säkerställ att alla modaler använder Radix Dialog med fokuslåsning",
        "Testa overlay-stacking: modal-i-modal, popover-i-drawer",
      ],
    }),
  },
  {
    trigger: (ctx) => countByCategory(ctx.issues, "form") >= 2 || countByCategory(ctx.issues, "input") >= 2,
    predict: () => ({
      problem: "Formulärvalidering misslyckas",
      area: "Formulär, checkout, profilinställningar",
      reason: "Upprepade formulärproblem pekar på bristande valideringslogik",
      preventive_fixes: [
        "Standardisera formulärvalidering med react-hook-form + zod-schemas",
        "Lägg till visuell felindikering på alla obligatoriska fält",
        "Testa edge cases: tomma fält, specialtecken, extremt långa värden",
      ],
    }),
  },
  {
    trigger: (ctx) => ctx.unified.data_issues.length >= 3,
    predict: () => ({
      problem: "Synkroniseringsfel mellan UI och databas",
      area: "Datatabeller, realtidsuppdateringar",
      reason: "Flera dataproblem tyder på inkonsistent state-hantering",
      preventive_fixes: [
        "Använd React Query invalidation konsekvent efter alla mutationer",
        "Lägg till optimistic updates med rollback vid fel",
        "Verifiera att RLS-policys inte blockerar förväntad data",
      ],
    }),
  },
  {
    trigger: (ctx) => ctx.focusMemory.filter(m => m.scan_count >= 3).length >= 2,
    predict: (ctx) => {
      const chronic = ctx.focusMemory.filter(m => m.scan_count >= 3).map(m => m.label).slice(0, 3);
      return {
        problem: "Kroniska problemområden som inte åtgärdats",
        area: chronic.join(", "),
        reason: `${chronic.length} komponenter har haft problem i 3+ skanningar`,
        preventive_fixes: [
          `Prioritera refaktorering av: ${chronic.join(", ")}`,
          "Bryt ner stora komponenter till mindre, testbara enheter",
          "Lägg till unit tests för de mest problemdrabbade komponenterna",
        ],
      };
    },
  },
  {
    trigger: (ctx) => ctx.rootCause.filter(r => r.recurrence_count >= 3).length >= 1,
    predict: (ctx) => {
      const recurring = ctx.rootCause.filter(r => r.recurrence_count >= 3)[0];
      return {
        problem: `Återkommande grundorsak: ${recurring.root_cause}`,
        area: recurring.affected_system || "Systemövergripande",
        reason: `Mönstret "${recurring.pattern_key}" har upprepats ${recurring.recurrence_count} gånger`,
        preventive_fixes: [
          `Åtgärda grundorsaken permanent i ${recurring.affected_system || "berört system"}`,
          "Lägg till regression-test som fångar detta mönster",
          "Dokumentera root cause och fix i change_log",
        ],
      };
    },
  },
  {
    trigger: (ctx) => ctx.unified.fake_features.length >= 3,
    predict: () => ({
      problem: "Fler icke-funktionella UI-element",
      area: "Knappar, formulär, interaktiva element",
      reason: "Många fake features tyder på inkomplett implementation i flera områden",
      preventive_fixes: [
        "Granska alla onClick/onSubmit-handlers — ta bort tomma/placeholder-handlers",
        "Dölj icke-implementerade funktioner bakom feature flags",
        "Markera WIP-funktioner visuellt med 'Kommer snart'-badges",
      ],
    }),
  },
  {
    trigger: (ctx) => ctx.unified.interaction_failures.length >= 4,
    predict: () => ({
      problem: "Event-hanteringsfel i komplexa vyer",
      area: "Interaktiva komponenter, admin-paneler",
      reason: "Hög frekvens interaktionsfel indikerar djupare event-bindningsproblem",
      preventive_fixes: [
        "Standardisera event-hantering med useCallback och korrekta dependencies",
        "Granska event.stopPropagation()-användning i nästlade interaktioner",
        "Testa alla klickbara element med disabled/loading-states",
      ],
    }),
  },
];

interface PredictionContext {
  unified: any;
  patterns: any[];
  systemicIssues: any[];
  focusMemory: any[];
  rootCause: any[];
  issues: string[];
}

function countByCategory(issues: string[], keyword: string): number {
  return issues.filter(i => i.includes(keyword)).length;
}

function generatePredictions(unified: any, patterns: any[], systemicIssues: any[], focusMemory: any[], rootCause: any[]): any[] {
  const allIssueTexts: string[] = [
    ...(unified.broken_flows || []).map((f: any) => `${f.description || ""} ${f.route || ""} ${f.component || ""} ${f.element || ""}`.toLowerCase()),
    ...(unified.interaction_failures || []).map((f: any) => `${f.title || ""} ${f.element || ""} ${f.component || ""} ${f.description || ""}`.toLowerCase()),
    ...(unified.data_issues || []).map((f: any) => `${f.title || ""} ${f.field || ""} ${f.component || ""} ${f.description || ""}`.toLowerCase()),
    ...(unified.fake_features || []).map((f: any) => `${f.name || ""} ${f.component || ""} ${f.description || ""}`.toLowerCase()),
    ...focusMemory.map((m: any) => `${m.label || ""} ${m.focus_key || ""}`.toLowerCase()),
  ];

  const ctx: PredictionContext = { unified, patterns, systemicIssues, focusMemory, rootCause, issues: allIssueTexts };
  const predictions: any[] = [];

  for (const rule of PREDICTION_RULES) {
    try {
      if (rule.trigger(ctx)) {
        const pred = rule.predict(ctx);
        const issueCount = allIssueTexts.length;
        const focusHits = focusMemory.filter(m => m.scan_count >= 2).length;
        const baseConfidence = 0.55;
        const issueBoost = Math.min(0.2, issueCount * 0.02);
        const focusBoost = Math.min(0.15, focusHits * 0.05);
        const confidence = Math.min(0.95, baseConfidence + issueBoost + focusBoost);

        if (confidence >= 0.6) {
          predictions.push({ ...pred, confidence: Math.round(confidence * 100), type: "prediction" });
        }
      }
    } catch (_) { /* skip broken rules */ }
  }

  const seen = new Set<string>();
  return predictions.filter(p => {
    const key = p.problem.substring(0, 40).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 8);
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

  const componentTypeBucket: Record<string, any[]> = {};
  const interactionTypeBucket: Record<string, any[]> = {};
  const layoutPatternBucket: Record<string, any[]> = {};

  const COMPONENT_KEYWORDS = ["modal", "dialog", "drawer", "dropdown", "popover", "tooltip", "accordion", "tab", "form", "input", "select", "card", "table", "sidebar", "header", "footer", "nav", "menu", "carousel", "sheet"];
  const INTERACTION_KEYWORDS = ["scroll", "click", "hover", "focus", "drag", "swipe", "submit", "toggle", "expand", "collapse", "close", "open", "resize"];
  const LAYOUT_KEYWORDS = ["overflow", "z-index", "position", "sticky", "fixed", "absolute", "flex", "grid", "responsive", "mobile", "truncat", "clip", "hidden"];

  function classifyIssue(issue: any) {
    const text = JSON.stringify(issue).toLowerCase();
    for (const kw of COMPONENT_KEYWORDS) {
      if (text.includes(kw)) {
        if (!componentTypeBucket[kw]) componentTypeBucket[kw] = [];
        componentTypeBucket[kw].push(issue);
      }
    }
    for (const kw of INTERACTION_KEYWORDS) {
      if (text.includes(kw)) {
        if (!interactionTypeBucket[kw]) interactionTypeBucket[kw] = [];
        interactionTypeBucket[kw].push(issue);
      }
    }
    for (const kw of LAYOUT_KEYWORDS) {
      if (text.includes(kw)) {
        if (!layoutPatternBucket[kw]) layoutPatternBucket[kw] = [];
        layoutPatternBucket[kw].push(issue);
      }
    }
  }

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

  const systemicIssues: any[] = [];

  for (const [compType, issues] of Object.entries(componentTypeBucket)) {
    if (issues.length >= 2) {
      const sources = new Set(issues.map((i: any) => i._source));
      const uniqueComponents = new Set(issues.map((i: any) => i.component || i.element || i.title || "").filter(Boolean));
      if (sources.size >= 2 || uniqueComponents.size >= 2) {
        systemicIssues.push({
          type: "component_type", pattern: compType,
          label: `Systemiskt problem: ${compType}-komponenter`,
          description: `${issues.length} problem hittade i ${compType}-komponenter (${[...sources].join(", ")}).`,
          affected_count: issues.length, sources: [...sources],
          affected_components: [...uniqueComponents].slice(0, 8),
          severity: issues.length >= 4 ? "critical" : "high",
          examples: issues.slice(0, 3).map((i: any) => i.title || i.description || i.element || "unknown"),
        });
      }
    }
  }

  for (const [interType, issues] of Object.entries(interactionTypeBucket)) {
    if (issues.length >= 2) {
      const uniqueComponents = new Set(issues.map((i: any) => i.component || i.element || i.title || "").filter(Boolean));
      if (uniqueComponents.size >= 2) {
        systemicIssues.push({
          type: "interaction_type", pattern: interType,
          label: `Systemiskt problem: ${interType}-interaktion`,
          description: `${issues.length} ${interType}-relaterade problem i ${uniqueComponents.size} olika komponenter.`,
          affected_count: issues.length,
          affected_components: [...uniqueComponents].slice(0, 8),
          severity: issues.length >= 4 ? "critical" : "high",
          examples: issues.slice(0, 3).map((i: any) => i.title || i.description || i.element || "unknown"),
        });
      }
    }
  }

  for (const [layoutType, issues] of Object.entries(layoutPatternBucket)) {
    if (issues.length >= 2) {
      const uniqueComponents = new Set(issues.map((i: any) => i.component || i.element || i.title || "").filter(Boolean));
      if (uniqueComponents.size >= 2) {
        systemicIssues.push({
          type: "layout_pattern", pattern: layoutType,
          label: `Systemiskt problem: ${layoutType}-layout`,
          description: `${issues.length} ${layoutType}-relaterade layoutproblem i ${uniqueComponents.size} komponenter.`,
          affected_count: issues.length,
          affected_components: [...uniqueComponents].slice(0, 8),
          severity: issues.length >= 3 ? "critical" : "high",
          examples: issues.slice(0, 3).map((i: any) => i.title || i.description || i.element || "unknown"),
        });
      }
    }
  }

  // Cross-bucket detection
  for (const [compType, compIssues] of Object.entries(componentTypeBucket)) {
    for (const [interType, interIssues] of Object.entries(interactionTypeBucket)) {
      const overlap = compIssues.filter((ci: any) => interIssues.some((ii: any) => ci === ii));
      if (overlap.length >= 2) {
        const alreadyDetected = systemicIssues.some(s => s.pattern === `${compType}+${interType}`);
        if (!alreadyDetected) {
          systemicIssues.push({
            type: "cross_pattern", pattern: `${compType}+${interType}`,
            label: `Korsmönster: ${compType} × ${interType}`,
            description: `${overlap.length} problem där ${interType}-interaktion i ${compType}-komponenter misslyckas.`,
            affected_count: overlap.length, severity: "critical",
            examples: overlap.slice(0, 3).map((i: any) => i.title || i.description || i.element || "unknown"),
          });
        }
      }
    }
  }

  for (const [comp, count] of Object.entries(componentCounts)) {
    if (count >= 2) {
      highRiskAreas.push({ component: comp, issue_count: count, risk_level: count >= 4 ? "critical" : "high" });
    }
  }

  for (const rc of rootCauseData) {
    if (rc.recurrence_count >= 2) {
      patterns.push({
        pattern_key: rc.pattern_key, affected_system: rc.affected_system,
        root_cause: rc.root_cause, recurrence_count: rc.recurrence_count, severity: rc.severity,
      });
    }
  }

  for (const [ftype, count] of Object.entries(failureTypes)) {
    if (count >= 2) {
      patterns.push({
        pattern_key: `failure_type::${ftype}`, affected_system: ftype,
        root_cause: `Recurring ${ftype} failures (${count} instances)`,
        recurrence_count: count, severity: count >= 4 ? "critical" : "high",
      });
    }
  }

  return { patterns, highRiskAreas, systemicIssues };
}

// ── Helper: Build targeted re-scan steps based on patterns ──
function buildTargetedSteps(patterns: any[], highRiskAreas: any[], iteration: number): typeof STEPS {
  const targeted: typeof STEPS = [];
  const addedTypes = new Set<string>();

  for (const area of highRiskAreas) {
    const comp = area.component?.toLowerCase() || "";
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
    if (!previousIssueKeys.has(key)) { newCount++; newKeys.add(key); }
  }
  return { newCount, newKeys };
}

// ── DATA INTEGRITY SCAN ──
async function runDataIntegrityScan(supabase: any, scanRunId: string): Promise<any> {
  const issues: any[] = [];
  const traceId = `integrity-${scanRunId.slice(0, 8)}`;
  const startMs = Date.now();

  try {
    // 1. Work items created but missing source
    const { data: sourceless } = await supabase
      .from("work_items").select("id, title, item_type, source_type, source_id, created_at")
      .in("status", ["open", "claimed", "in_progress", "escalated"])
      .is("source_id", null)
      .not("item_type", "in", '("manual","manual_task","general")')
      .limit(100);

    for (const wi of sourceless || []) {
      issues.push({ type: "failed_insert", severity: "high", entity: "work_item", entity_id: wi.id, title: `Work item utan källa: "${wi.title}"`, description: `item_type=${wi.item_type} men source_id saknas`, step: "create → database", root_cause: "source_id ej satt vid INSERT", component: "work_items" });
    }

    // 2. Orphan work items — source references non-existent rows
    const { data: bugSourced } = await supabase
      .from("work_items").select("id, title, source_id")
      .eq("source_type", "bug_report").not("source_id", "is", null)
      .in("status", ["open", "claimed", "in_progress", "escalated"]).limit(200);

    for (const wi of bugSourced || []) {
      const { data: bug } = await supabase.from("bug_reports").select("id").eq("id", wi.source_id).maybeSingle();
      if (!bug) {
        issues.push({ type: "data_loss", severity: "critical", entity: "work_item", entity_id: wi.id, title: `Orphan: "${wi.title}" → bug ${wi.source_id} finns ej`, step: "database → fetch", root_cause: "Källa raderad utan cleanup", component: "work_items" });
      }
    }

    const { data: incidentSourced } = await supabase
      .from("work_items").select("id, title, source_id")
      .eq("source_type", "order_incident").not("source_id", "is", null)
      .in("status", ["open", "claimed", "in_progress", "escalated"]).limit(200);

    for (const wi of incidentSourced || []) {
      const { data: inc } = await supabase.from("order_incidents").select("id").eq("id", wi.source_id).maybeSingle();
      if (!inc) {
        issues.push({ type: "data_loss", severity: "critical", entity: "work_item", entity_id: wi.id, title: `Orphan: "${wi.title}" → incident ${wi.source_id} finns ej`, step: "database → fetch", root_cause: "Källa raderad utan cleanup", component: "work_items" });
      }
    }

    // 3. Duplicate active work items
    const { data: activeItems } = await supabase
      .from("work_items").select("id, source_type, source_id, title, created_at")
      .in("status", ["open", "claimed", "in_progress", "escalated"])
      .not("source_id", "is", null).limit(500);

    const sourceMap = new Map<string, any[]>();
    for (const wi of activeItems || []) {
      const key = `${wi.source_type}:${wi.source_id}`;
      if (!sourceMap.has(key)) sourceMap.set(key, []);
      sourceMap.get(key)!.push(wi);
    }
    for (const [key, items] of sourceMap) {
      if (items.length > 1) {
        issues.push({ type: "stale_state", severity: "high", entity: "work_item", entity_id: items.map((i: any) => i.id).join(", "), title: `${items.length} duplicerade work items för ${key}`, step: "create → database", root_cause: "Dedup-logik missade", component: "work_items" });
      }
    }

    // 4. Work items linked to deleted/cancelled orders
    const { data: orderLinked } = await supabase
      .from("work_items").select("id, title, related_order_id, status")
      .not("related_order_id", "is", null).in("status", ["open", "claimed", "in_progress"]).limit(200);

    for (const wi of orderLinked || []) {
      const { data: order } = await supabase.from("orders").select("id, status, deleted_at").eq("id", wi.related_order_id).maybeSingle();
      if (!order) {
        issues.push({ type: "data_loss", severity: "high", entity: "work_item", entity_id: wi.id, title: `"${wi.title}" → order finns ej`, step: "database → fetch", root_cause: "Order raderad utan cleanup", component: "work_items" });
      } else if (order.deleted_at) {
        issues.push({ type: "incorrect_filtering", severity: "high", entity: "work_item", entity_id: wi.id, title: `"${wi.title}" → order soft-deleted`, step: "database → UI", root_cause: "Cleanup missade denna work_item", component: "work_items" });
      } else if (["cancelled", "delivered", "completed"].includes(order.status)) {
        issues.push({ type: "stale_state", severity: "medium", entity: "work_item", entity_id: wi.id, title: `"${wi.title}" → order redan ${order.status}`, step: "database → UI", root_cause: "Status-synk bruten", component: "work_items" });
      }
    }

    // 5. Status mismatch: bug resolved but work_item still open
    const { data: resolvedBugs } = await supabase.from("bug_reports").select("id").eq("status", "resolved").limit(100);
    for (const bug of resolvedBugs || []) {
      const { data: activeWi } = await supabase.from("work_items").select("id, title").eq("source_type", "bug_report").eq("source_id", bug.id).in("status", ["open", "claimed", "in_progress", "escalated"]).limit(1);
      if (activeWi?.length) {
        issues.push({ type: "stale_state", severity: "high", entity: "work_item", entity_id: activeWi[0].id, title: `"${activeWi[0].title}" aktiv trots löst bug`, step: "database → UI", root_cause: "Statussynk misslyckades", component: "work_items" });
      }
    }

    // 6. Stale claimed items
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data: staleClaimed } = await supabase
      .from("work_items").select("id, title, claimed_by, claimed_at")
      .eq("status", "claimed").not("claimed_at", "is", null).lt("claimed_at", thirtyMinAgo).limit(50);

    for (const wi of staleClaimed || []) {
      issues.push({ type: "stale_state", severity: "medium", entity: "work_item", entity_id: wi.id, title: `"${wi.title}" claimad >30min utan progress`, step: "UI → database", root_cause: "Uppgift övergiven", component: "work_items" });
    }

    // 7. Entity validation: check required fields on key entities
    const ENTITY_VALIDATIONS: { table: string; entity: string; required: string[]; limit: number }[] = [
      { table: "orders", entity: "order", required: ["id", "user_id", "order_email", "status", "payment_status", "total_amount"], limit: 200 },
      { table: "profiles", entity: "user", required: ["id", "user_id"], limit: 200 },
      { table: "products", entity: "product", required: ["id", "title_sv", "price", "status"], limit: 200 },
    ];

    for (const ev of ENTITY_VALIDATIONS) {
      try {
        const { data: rows } = await supabase.from(ev.table).select(ev.required.join(", ")).limit(ev.limit);
        for (const row of rows || []) {
          const missingFields: string[] = [];
          const nullFields: string[] = [];
          for (const field of ev.required) {
            if (!(field in row)) missingFields.push(field);
            else if (row[field] === null || row[field] === undefined) nullFields.push(field);
          }
          if (missingFields.length > 0 || nullFields.length > 0) {
            issues.push({
              type: "data_validation",
              severity: missingFields.includes("id") ? "critical" : nullFields.length > 2 ? "high" : "medium",
              entity: ev.entity,
              entity_id: row.id || "unknown",
              title: `${ev.entity} ${(row.id || "?").toString().slice(0, 8)}: ${missingFields.length > 0 ? `missing [${missingFields.join(",")}]` : ""} ${nullFields.length > 0 ? `null [${nullFields.join(",")}]` : ""}`.trim(),
              step: "database → validation",
              root_cause: "Required field missing or null",
              component: ev.table,
              validation_fields: {
                id: row.id ? "present" : "missing",
                required_fields_missing: missingFields,
                null_fields: nullFields,
              },
            });
          }
        }
      } catch (_) {}
    }

    // 8. ID Trace: verify IDs are generated, persisted, and returned for key entities
    const ID_TRACE_ENTITIES = [
      { table: "orders", entity: "order", id_field: "id", return_fields: ["id", "order_number", "payment_intent_id"], limit: 100 },
      { table: "profiles", entity: "user", id_field: "user_id", return_fields: ["user_id", "username"], limit: 100 },
      { table: "products", entity: "product", id_field: "id", return_fields: ["id", "handle"], limit: 100 },
      { table: "work_items", entity: "work_item", id_field: "id", return_fields: ["id", "source_id"], limit: 100 },
    ];

    for (const ent of ID_TRACE_ENTITIES) {
      try {
        const { data: rows } = await supabase.from(ent.table).select(ent.return_fields.join(", ")).order("created_at", { ascending: false }).limit(ent.limit);
        for (const row of rows || []) {
          const generated = row[ent.id_field] !== null && row[ent.id_field] !== undefined && row[ent.id_field] !== "";
          const persisted = generated; // if we fetched it from DB, it's persisted
          // returned = all return_fields have values (ID made it through the full chain)
          const missingReturns = ent.return_fields.filter(f => row[f] === null || row[f] === undefined || row[f] === "");
          const returned = missingReturns.length === 0;

          const id_trace = { generated, persisted, returned };

          if (!generated) {
            issues.push({
              type: "id_trace",
              severity: "critical",
              entity: ent.entity,
              entity_id: row[ent.id_field] || "unknown",
              title: `ID lost at: generated in "${ent.entity}"`,
              step: "create → ID generation",
              root_cause: `${ent.id_field} is null/empty`,
              component: ent.table,
              id_trace,
            });
          } else if (!returned) {
            // ID exists but downstream fields are missing
            const lostAt = missingReturns.join(", ");
            issues.push({
              type: "id_trace",
              severity: "high",
              entity: ent.entity,
              entity_id: (row[ent.id_field] || "").toString().slice(0, 8),
              title: `ID lost at: returned in "${ent.entity}" (missing: ${lostAt})`,
              step: "database → UI return",
              root_cause: `Fields [${lostAt}] null/empty despite ID present`,
              component: ent.table,
              id_trace,
            });
          }
        }
      } catch (_) {}
    }

    // 9. Frontend vs Backend data mismatch: check fields frontend expects but backend may not have
    const FRONTEND_EXPECTS: { table: string; entity: string; fields: { name: string; label: string }[]; limit: number }[] = [
      { table: "orders", entity: "order", fields: [
        { name: "id", label: "order.id" },
        { name: "user_id", label: "order.user_id" },
        { name: "total_amount", label: "order.total" },
        { name: "status", label: "order.status" },
        { name: "payment_status", label: "order.payment_status" },
        { name: "order_email", label: "order.email" },
        { name: "items", label: "order.items" },
        { name: "shipping_address", label: "order.shipping_address" },
        { name: "payment_intent_id", label: "order.payment_intent_id" },
      ], limit: 100 },
      { table: "profiles", entity: "user", fields: [
        { name: "user_id", label: "user.user_id" },
        { name: "username", label: "user.username" },
        { name: "is_member", label: "user.is_member" },
        { name: "level", label: "user.level" },
        { name: "xp", label: "user.xp" },
      ], limit: 100 },
      { table: "products", entity: "product", fields: [
        { name: "id", label: "product.id" },
        { name: "title_sv", label: "product.title" },
        { name: "price", label: "product.price" },
        { name: "status", label: "product.status" },
        { name: "handle", label: "product.handle" },
        { name: "image_url", label: "product.image_url" },
      ], limit: 100 },
      { table: "work_items", entity: "work_item", fields: [
        { name: "id", label: "work_item.id" },
        { name: "title", label: "work_item.title" },
        { name: "status", label: "work_item.status" },
        { name: "priority", label: "work_item.priority" },
        { name: "item_type", label: "work_item.item_type" },
      ], limit: 50 },
    ];

    for (const fe of FRONTEND_EXPECTS) {
      try {
        const selectFields = fe.fields.map(f => f.name).join(", ");
        const { data: rows } = await supabase.from(fe.table).select(selectFields).order("created_at", { ascending: false }).limit(fe.limit);
        for (const row of rows || []) {
          for (const field of fe.fields) {
            const val = row[field.name];
            if (val === null || val === undefined) {
              issues.push({
                type: "data_mismatch",
                severity: ["user_id", "id", "total_amount", "price", "status"].includes(field.name) ? "critical" : "high",
                entity: fe.entity,
                entity_id: (row.id || row.user_id || "unknown").toString().slice(0, 8),
                title: `Data mismatch: frontend vs backend — ${field.label} expected → ${val === null ? "null" : "undefined"}`,
                step: "backend → frontend",
                root_cause: `Frontend expects ${field.label} but backend returns ${val === null ? "null" : "undefined"}`,
                component: fe.table,
                _issue_type: "bug",
                _impact_score: 4,
                _impact_label: ["user_id", "id", "total_amount", "price"].includes(field.name) ? "critical" : "high",
              });
            }
          }
        }
      } catch (_) {}
    }

    // 10. Empty table detection: tables system expects to have data
    const EXPECTED_DATA_TABLES = [
      { table: "profiles", label: "users", severity: "critical" as const },
      { table: "orders", label: "orders", severity: "high" as const },
      { table: "products", label: "products", severity: "critical" as const },
      { table: "categories", label: "categories", severity: "high" as const },
      { table: "user_roles", label: "user_roles", severity: "critical" as const },
      { table: "work_items", label: "work_items", severity: "medium" as const },
      { table: "legal_documents", label: "legal_documents", severity: "high" as const },
      { table: "email_templates", label: "email_templates", severity: "medium" as const },
      { table: "store_settings", label: "store_settings", severity: "high" as const },
      { table: "role_module_permissions", label: "role_permissions", severity: "critical" as const },
    ];

    for (const et of EXPECTED_DATA_TABLES) {
      try {
        const { count } = await supabase.from(et.table).select("id", { count: "exact", head: true });
        if (count === 0 || count === null) {
          issues.push({
            type: "empty_table",
            severity: et.severity,
            entity: et.label,
            entity_id: et.table,
            title: `No data found where expected: ${et.label} = 0`,
            step: "database → pipeline",
            root_cause: "Table empty — broken pipeline or failed creation",
            component: et.table,
            _issue_type: "bug",
            _impact_score: et.severity === "critical" ? 5 : 4,
            _impact_label: et.severity,
          });
        }
      } catch (_) {}
    }

  } catch (e: any) {
    console.error("Data integrity scan error:", e);
    issues.push({ type: "scan_error", severity: "critical", entity: "integrity_scan", title: `Integrity scan fel: ${e.message}`, step: "scan", root_cause: e.message, component: "integrity_scan" });
  }

  const durationMs = Date.now() - startMs;
  await supabase.from("system_observability_log").insert({
    event_type: "scan_step", severity: issues.filter(i => i.severity === "critical").length > 0 ? "warning" : "info",
    source: "scanner", message: `Data integrity scan: ${issues.length} problem`,
    details: { total_issues: issues.length, by_type: { data_loss: issues.filter(i => i.type === "data_loss").length, failed_insert: issues.filter(i => i.type === "failed_insert").length, stale_state: issues.filter(i => i.type === "stale_state").length, incorrect_filtering: issues.filter(i => i.type === "incorrect_filtering").length, data_validation: issues.filter(i => i.type === "data_validation").length, id_trace: issues.filter(i => i.type === "id_trace").length, data_mismatch: issues.filter(i => i.type === "data_mismatch").length, empty_table: issues.filter(i => i.type === "empty_table").length } },
    scan_id: scanRunId, trace_id: traceId, component: "data_integrity_scan", duration_ms: durationMs,
  }).catch(() => {});

  return {
    issues, total_issues: issues.length,
    by_type: { data_loss: issues.filter(i => i.type === "data_loss").length, failed_insert: issues.filter(i => i.type === "failed_insert").length, stale_state: issues.filter(i => i.type === "stale_state").length, incorrect_filtering: issues.filter(i => i.type === "incorrect_filtering").length, data_validation: issues.filter(i => i.type === "data_validation").length, id_trace: issues.filter(i => i.type === "id_trace").length, data_mismatch: issues.filter(i => i.type === "data_mismatch").length, empty_table: issues.filter(i => i.type === "empty_table").length },
    duration_ms: durationMs, scanned_at: new Date().toISOString(),
  };
}

// ── FUNCTIONAL BEHAVIOR SCAN ──
async function runFunctionalBehaviorScan(supabase: any, scanRunId: string): Promise<any> {
  const failures: any[] = [];
  const startMs = Date.now();
  const traceId = `behavior-${scanRunId.slice(0, 8)}`;

  try {
    // ACTION CHAIN 1: Create work item → verify
    const probeTitle = `__behavior_probe_${Date.now()}`;
    const { data: probeInsert, error: insertErr } = await supabase.from("work_items").insert({ title: probeTitle, status: "cancelled", priority: "low", item_type: "general", source_type: "behavior_scan", description: "Temporary probe — auto-deleted" }).select("id, title, status").single();

    if (insertErr || !probeInsert) {
      failures.push({ chain: "create_work_item", action: "INSERT work_item", expected: "Row created", actual: insertErr ? `Error: ${insertErr.message}` : "No data returned", failure_type: "action_failed", step: "action → backend → database", severity: "critical" });
    } else {
      const { data: fetched } = await supabase.from("work_items").select("id, title").eq("id", probeInsert.id).maybeSingle();
      if (!fetched) {
        failures.push({ chain: "create_work_item", action: "VERIFY work_item", expected: `Row ${probeInsert.id} retrievable`, actual: "Row not found", failure_type: "lost_state", step: "database → fetch", severity: "critical", entity_id: probeInsert.id });
      } else if (fetched.title !== probeTitle) {
        failures.push({ chain: "create_work_item", action: "COMPARE title", expected: probeTitle, actual: fetched.title, failure_type: "silent_failure", step: "database → compare", severity: "high", entity_id: probeInsert.id });
      }
      await supabase.from("work_items").delete().eq("id", probeInsert.id);
    }

    // ACTION CHAIN 2: Bug → work_item trigger
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: recentBugs } = await supabase.from("bug_reports").select("id, description, created_at").gte("created_at", fiveMinAgo).order("created_at", { ascending: false }).limit(10);
    for (const bug of recentBugs || []) {
      const { data: linkedWi } = await supabase.from("work_items").select("id").eq("source_type", "bug_report").eq("source_id", bug.id).limit(1);
      if (!linkedWi?.length) {
        failures.push({ chain: "bug_to_work_item", action: "Bug trigger → create work_item", expected: `Work item for bug ${bug.id.slice(0, 8)}`, actual: "No work_item found", failure_type: "action_failed", step: "database trigger → work_items", severity: "high", entity_id: bug.id });
      }
    }

    // ACTION CHAIN 3: Incident → work_item
    const { data: recentIncidents } = await supabase.from("order_incidents").select("id, title, created_at").gte("created_at", fiveMinAgo).order("created_at", { ascending: false }).limit(10);
    for (const inc of recentIncidents || []) {
      const { data: linkedWi } = await supabase.from("work_items").select("id").eq("source_type", "order_incident").eq("source_id", inc.id).limit(1);
      if (!linkedWi?.length) {
        failures.push({ chain: "incident_to_work_item", action: "Incident trigger → create work_item", expected: `Work item for incident ${inc.id.slice(0, 8)}`, actual: "No work_item found", failure_type: "action_failed", step: "database trigger → work_items", severity: "high", entity_id: inc.id });
      }
    }

    // ACTION CHAIN 4: Status sync
    const { data: doneWiFromBugs } = await supabase.from("work_items").select("id, title, source_id").eq("status", "done").eq("source_type", "bug_report").not("source_id", "is", null).order("completed_at", { ascending: false }).limit(20);
    for (const wi of doneWiFromBugs || []) {
      const { data: bug } = await supabase.from("bug_reports").select("id, status").eq("id", wi.source_id).maybeSingle();
      if (bug && bug.status !== "resolved") {
        failures.push({ chain: "status_sync", action: "Work item done → bug resolved", expected: `Bug status = resolved`, actual: `Bug status = ${bug.status}`, failure_type: "partial_execution", step: "work_item → sync → bug_reports", severity: "high", entity_id: wi.id });
      }
    }

    // ACTION CHAIN 5: Dismiss → no reappear
    const { data: dismissals } = await supabase.from("scan_dismissals").select("issue_key, scan_type, dismissed_at").order("dismissed_at", { ascending: false }).limit(50);
    const { data: activeWorkItems } = await supabase.from("work_items").select("id, title, source_type").in("status", ["open", "claimed", "in_progress"]).eq("source_type", "scan").limit(200);
    for (const d of dismissals || []) {
      const reappeared = (activeWorkItems || []).find((wi: any) => wi.title?.includes(d.issue_key));
      if (reappeared) {
        failures.push({ chain: "dismiss_reappear", action: "Dismiss → should not reappear", expected: `"${d.issue_key}" stays dismissed`, actual: `Reappeared as ${reappeared.id.slice(0, 8)}`, failure_type: "silent_failure", step: "scan_dismissals → work_items", severity: "medium", entity_id: reappeared.id });
      }
    }

    // ACTION CHAIN 6: Order → lifecycle
    const { data: paidOrders } = await supabase.from("orders").select("id, status, payment_status, fulfillment_status").eq("payment_status", "paid").in("fulfillment_status", ["shipped", "delivered"]).is("deleted_at", null).limit(50);
    for (const order of paidOrders || []) {
      const { data: activeWi } = await supabase.from("work_items").select("id, title, item_type").eq("related_order_id", order.id).in("status", ["open", "claimed", "in_progress"]).in("item_type", ["pack_order", "packing", "shipping"]).limit(1);
      if (activeWi?.length) {
        failures.push({ chain: "order_lifecycle", action: "Order shipped → close tasks", expected: "No active packing tasks", actual: `Active: "${activeWi[0].title}"`, failure_type: "stale_state", step: "order status → work_items", severity: "medium", entity_id: activeWi[0].id });
      }
    }

    // ACTION CHAIN 7: Notification on incident
    const { data: recentNotifIncidents } = await supabase.from("order_incidents").select("id, title, created_at").gte("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString()).order("created_at", { ascending: false }).limit(10);
    for (const inc of recentNotifIncidents || []) {
      const { data: notifs } = await supabase.from("notifications").select("id").eq("related_id", inc.id).eq("related_type", "incident").limit(1);
      if (!notifs?.length) {
        failures.push({ chain: "incident_notification", action: "Incident → notification", expected: `Notification for ${inc.id.slice(0, 8)}`, actual: "No notification found", failure_type: "action_failed", step: "incident trigger → notifications", severity: "medium", entity_id: inc.id });
      }
    }

  } catch (e: any) {
    console.error("Functional behavior scan error:", e);
    failures.push({ chain: "scan_error", action: "Run behavior scan", expected: "Scan completes", actual: `Error: ${e.message}`, failure_type: "action_failed", step: "scan execution", severity: "critical" });
  }

  const durationMs = Date.now() - startMs;
  const byType = {
    action_failed: failures.filter(f => f.failure_type === "action_failed").length,
    partial_execution: failures.filter(f => f.failure_type === "partial_execution").length,
    silent_failure: failures.filter(f => f.failure_type === "silent_failure").length,
    lost_state: failures.filter(f => f.failure_type === "lost_state").length,
    stale_state: failures.filter(f => f.failure_type === "stale_state").length,
  };

  // Failure memory
  const retestResults: any[] = [];
  try {
    for (const f of failures) {
      const patternKey = `${(f.chain || "").toLowerCase()}::${(f.action || "").toLowerCase().replace(/[^a-z0-9]/g, "_").slice(0, 60)}::${(f.step || "").toLowerCase().replace(/[^a-z0-9]/g, "_").slice(0, 60)}`;
      const { data: existing } = await supabase.from("functional_failure_memory").select("id, occurrence_count").eq("pattern_key", patternKey).limit(1);
      if (existing?.length) {
        await supabase.from("functional_failure_memory").update({ occurrence_count: (existing[0].occurrence_count || 1) + 1, last_seen_at: new Date().toISOString(), fail_reason: f.actual?.slice(0, 500), is_resolved: false, resolved_at: null, last_scan_retest_at: new Date().toISOString(), last_retest_passed: false }).eq("id", existing[0].id);
      } else {
        await supabase.from("functional_failure_memory").insert({ action_type: f.chain || "unknown", component: f.chain || "behavior_scan", entity_type: f.chain || "system", failed_step: f.step || "unknown", fail_reason: f.actual?.slice(0, 500), pattern_key: patternKey, severity: f.severity || "medium", occurrence_count: 1, last_scan_retest_at: new Date().toISOString(), last_retest_passed: false });
      }
    }

    const { data: knownFailures } = await supabase.from("functional_failure_memory").select("id, pattern_key, action_type, failed_step, occurrence_count").eq("is_resolved", false).order("occurrence_count", { ascending: false }).limit(100);
    const failureKeys = new Set(failures.map(f => `${(f.chain || "").toLowerCase()}::${(f.action || "").toLowerCase().replace(/[^a-z0-9]/g, "_").slice(0, 60)}::${(f.step || "").toLowerCase().replace(/[^a-z0-9]/g, "_").slice(0, 60)}`));
    for (const kf of knownFailures || []) {
      if (!failureKeys.has(kf.pattern_key)) {
        await supabase.from("functional_failure_memory").update({ last_scan_retest_at: new Date().toISOString(), last_retest_passed: true, is_resolved: true, resolved_at: new Date().toISOString() }).eq("id", kf.id);
        retestResults.push({ pattern_key: kf.pattern_key, action_type: kf.action_type, result: "passed", was_occurrence_count: kf.occurrence_count });
      }
    }
  } catch (memErr: any) { console.warn("Failure memory error:", memErr.message); }

  await supabase.from("system_observability_log").insert({
    event_type: "scan_step", severity: failures.filter(f => f.severity === "critical").length > 0 ? "warning" : "info",
    source: "scanner", message: `Functional behavior scan: ${failures.length} failures, ${retestResults.length} retests passed`,
    details: { total_failures: failures.length, by_type: byType, retests_passed: retestResults.length },
    scan_id: scanRunId, trace_id: traceId, component: "functional_behavior_scan", duration_ms: durationMs,
  }).catch(() => {});

  return { failures, total_failures: failures.length, by_type: byType, retests_passed: retestResults, duration_ms: durationMs, scanned_at: new Date().toISOString() };
}

// ── REAL DB SCAN: Sync Scanner ──
async function runRealSyncScan(supabase: any, scanRunId: string): Promise<any> {
  const issues: any[] = [];
  const startMs = Date.now();

  try {
    const { data: products } = await supabase.from("products").select("id, title_sv, price, status, image_urls, handle, category").limit(500);
    for (const p of products || []) {
      if (!p.title_sv || p.title_sv.trim() === "") issues.push({ title: `Produkt utan titel (id: ${p.id?.slice(0, 8)})`, severity: "high", field: "title_sv", component: "products" });
      if (p.price == null || p.price <= 0) issues.push({ title: `Produkt utan giltigt pris: "${p.title_sv}" (${p.price})`, severity: "high", field: "price", component: "products" });
      if (p.status === "active" && (!p.image_urls || p.image_urls.length === 0)) issues.push({ title: `Aktiv produkt utan bild: "${p.title_sv}"`, severity: "medium", field: "image_urls", component: "products" });
      if (p.status === "active" && !p.handle) issues.push({ title: `Aktiv produkt utan handle: "${p.title_sv}"`, severity: "high", field: "handle", component: "products" });
    }

    // Orders: status consistency
    const { data: orders } = await supabase.from("orders").select("id, status, payment_status, fulfillment_status, shipped_at, delivered_at, packed_at").is("deleted_at", null).order("created_at", { ascending: false }).limit(200);
    for (const o of orders || []) {
      if (o.fulfillment_status === "shipped" && !o.shipped_at) issues.push({ title: `Order ${o.id.slice(0, 8)} status=shipped utan shipped_at`, severity: "high", field: "shipped_at", component: "orders" });
      if (o.fulfillment_status === "delivered" && !o.delivered_at) issues.push({ title: `Order ${o.id.slice(0, 8)} status=delivered utan delivered_at`, severity: "high", field: "delivered_at", component: "orders" });
      if (o.payment_status === "paid" && o.status === "cancelled") issues.push({ title: `Order ${o.id.slice(0, 8)} betalad men avbruten`, severity: "critical", field: "status", component: "orders" });
    }

    // Affiliates
    const { data: affiliates } = await supabase.from("affiliates").select("id, name, code, is_active, email").eq("is_active", true).limit(100);
    for (const a of affiliates || []) {
      if (!a.code || a.code.trim() === "") issues.push({ title: `Aktiv affiliate utan kod: "${a.name}"`, severity: "high", field: "code", component: "affiliates" });
    }

    // Duplicate codes
    const { data: allCodes } = await supabase.from("affiliates").select("code").eq("is_active", true);
    const { data: influencerCodes } = await supabase.from("influencers").select("code").eq("is_active", true);
    const codeMap = new Map<string, number>();
    for (const a of [...(allCodes || []), ...(influencerCodes || [])]) {
      const c = (a.code || "").toLowerCase();
      if (c) codeMap.set(c, (codeMap.get(c) || 0) + 1);
    }
    for (const [code, count] of codeMap) {
      if (count > 1) issues.push({ title: `Duplikat rabattkod: "${code}" (${count} st)`, severity: "critical", field: "code", component: "affiliates" });
    }

  } catch (e: any) { issues.push({ title: `Sync scan error: ${e.message}`, severity: "critical", component: "sync_scan" }); }

  const durationMs = Date.now() - startMs;
  const score = Math.max(0, 100 - issues.length * 5);
  return { issues, mismatches: issues, total_issues: issues.length, sync_score: score, overall_score: score, issues_found: issues.length, duration_ms: durationMs, scanned_at: new Date().toISOString(), real_db_scan: true };
}

// ── REAL DB SCAN: System scan ──
async function runRealSystemScan(supabase: any, scanRunId: string): Promise<any> {
  const issues: any[] = [];
  const metrics: Record<string, number> = {};
  const startMs = Date.now();

  try {
    const tables = [
      { table: "orders", filter: { deleted_at: null }, key: "total_orders" },
      { table: "products", filter: {}, key: "total_products" },
      { table: "bug_reports", filter: { status: "open" }, key: "open_bugs" },
      { table: "work_items", filter: {}, key: "total_work_items" },
      { table: "affiliates", filter: { is_active: true }, key: "active_affiliates" },
      { table: "reviews", filter: {}, key: "total_reviews" },
      { table: "notifications", filter: { read: false }, key: "unread_notifications" },
    ];

    for (const t of tables) {
      let query = supabase.from(t.table).select("*", { count: "exact", head: true });
      for (const [k, v] of Object.entries(t.filter)) {
        if (v === null) query = query.is(k, null);
        else query = query.eq(k, v);
      }
      const { count } = await query;
      metrics[t.key] = count || 0;
    }

    for (const status of ["open", "claimed", "in_progress", "escalated", "done"]) {
      const { count } = await supabase.from("work_items").select("*", { count: "exact", head: true }).eq("status", status);
      metrics[`work_items_${status}`] = count || 0;
    }

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: recentOrders } = await supabase.from("orders").select("*", { count: "exact", head: true }).gte("created_at", oneDayAgo).is("deleted_at", null);
    metrics.orders_last_24h = recentOrders || 0;

    const { count: recentErrors } = await supabase.from("activity_logs").select("*", { count: "exact", head: true }).eq("log_type", "error").gte("created_at", oneDayAgo);
    metrics.errors_last_24h = recentErrors || 0;

    // Only flag these in production or when thresholds are genuinely concerning
    if (metrics.open_bugs > 20) issues.push({ title: `${metrics.open_bugs} öppna buggar`, severity: "high", component: "bug_reports" });
    if (metrics.work_items_escalated > 5) issues.push({ title: `${metrics.work_items_escalated} eskalerade ärenden`, severity: "critical", component: "work_items" });
    if (metrics.errors_last_24h > 50) issues.push({ title: `${metrics.errors_last_24h} fel senaste 24h`, severity: "high", component: "activity_logs" });
    if (metrics.unread_notifications > 100) issues.push({ title: `${metrics.unread_notifications} olästa notiser`, severity: "medium", component: "notifications" });

    // Stale escalated items
    const { data: staleEscalated } = await supabase.from("work_items").select("id, title, updated_at").eq("status", "escalated").lt("updated_at", oneDayAgo).limit(20);
    for (const wi of staleEscalated || []) {
      issues.push({ title: `Eskalerat ärende >24h: "${wi.title}"`, severity: "high", component: "work_items", entity_id: wi.id });
    }

    // Score trend
    const { data: recentScans } = await supabase.from("ai_scan_results").select("overall_score, created_at, scan_type").eq("scan_type", "full_orchestrated").order("created_at", { ascending: false }).limit(3);
    if (recentScans?.length >= 2) {
      const current = recentScans[0].overall_score || 0;
      const previous = recentScans[1].overall_score || 0;
      if (current < previous - 10) issues.push({ title: `Systempoäng sjunkit: ${previous} → ${current}`, severity: "high", component: "system_health" });
      metrics.previous_score = previous;
      metrics.score_delta = current - previous;
    }

  } catch (e: any) { issues.push({ title: `System scan error: ${e.message}`, severity: "critical", component: "system_scan" }); }

  const durationMs = Date.now() - startMs;
  const score = Math.max(0, 100 - issues.length * 8);
  return { issues, issues_found: issues.length, metrics, system_score: score, overall_score: score, duration_ms: durationMs, scanned_at: new Date().toISOString(), real_db_scan: true };
}

// ── REAL DB SCAN: Feature Detection ──
async function runRealFeatureDetection(supabase: any, scanRunId: string): Promise<any> {
  const features: any[] = [];
  const startMs = Date.now();

  const featureTests = [
    { name: "Produkter", table: "products", query: "id, title_sv, status" },
    { name: "Ordrar", table: "orders", query: "id, status, created_at" },
    { name: "Kategorier", table: "categories", query: "id, name_sv, slug" },
    { name: "Recensioner", table: "reviews", query: "id, rating, product_id" },
    { name: "Affiliates", table: "affiliates", query: "id, name, code" },
    { name: "Influencers", table: "influencers", query: "id, name, code" },
    { name: "Bugrapporter", table: "bug_reports", query: "id, description, status" },
    { name: "Work Items", table: "work_items", query: "id, title, status" },
    { name: "Donationer", table: "donations", query: "id, amount, source" },
    { name: "E-postmallar", table: "email_templates", query: "id, template_type, is_active" },
    { name: "Bundles", table: "bundles", query: "id, name, is_active" },
    { name: "Aktivitetsloggar", table: "activity_logs", query: "id, log_type, message" },
    { name: "Notiser", table: "notifications", query: "id, type, read" },
  ];

  for (const ft of featureTests) {
    try {
      const { error, count } = await supabase.from(ft.table).select(ft.query, { count: "exact" }).limit(1);
      if (error) features.push({ name: ft.name, status: "broken", classification: "broken", reason: error.message, component: ft.table });
      else features.push({ name: ft.name, status: "working", classification: "real", row_count: count || 0, component: ft.table });
    } catch (e: any) { features.push({ name: ft.name, status: "error", classification: "broken", reason: e.message, component: ft.table }); }
  }

  // Test write
  try {
    const probeId = `__feature_probe_${Date.now()}`;
    const { data: inserted, error: insertErr } = await supabase.from("activity_logs").insert({ message: probeId, log_type: "probe", category: "feature_detection" }).select("id").single();
    if (insertErr) { features.push({ name: "Skrivåtkomst", status: "broken", classification: "broken", reason: insertErr.message }); }
    else {
      const { data: fetched } = await supabase.from("activity_logs").select("id").eq("id", inserted.id).maybeSingle();
      features.push({ name: "Skrivåtkomst", status: fetched ? "working" : "broken", classification: fetched ? "real" : "broken" });
      if (fetched) await supabase.from("activity_logs").delete().eq("id", inserted.id);
    }
  } catch (e: any) { features.push({ name: "Skrivåtkomst", status: "error", classification: "broken", reason: e.message }); }

  const durationMs = Date.now() - startMs;
  const working = features.filter(f => f.status === "working").length;
  const broken = features.filter(f => f.status !== "working").length;
  const score = Math.round((working / Math.max(1, features.length)) * 100);
  return { features, working_count: working, broken_count: broken, total_features: features.length, overall_score: score, score, issues_found: broken, duration_ms: durationMs, scanned_at: new Date().toISOString(), real_db_scan: true };
}

// ── REAL DB SCAN: Interaction QA ──
async function runRealInteractionQA(supabase: any, scanRunId: string): Promise<any> {
  const issues: any[] = [];
  const startMs = Date.now();

  try {
    // Bundles referencing non-existent products
    const { data: bundleItems } = await supabase.from("bundle_items").select("id, bundle_id, shopify_product_id").limit(200);
    const { data: bundles } = await supabase.from("bundles").select("id, name, is_active").eq("is_active", true).limit(50);
    const activeBundleIds = new Set((bundles || []).map((b: any) => b.id));
    for (const bi of bundleItems || []) {
      if (!activeBundleIds.has(bi.bundle_id)) {
        const { data: b } = await supabase.from("bundles").select("id").eq("id", bi.bundle_id).maybeSingle();
        if (!b) issues.push({ title: `Bundle item → borttaget bundle ${bi.bundle_id.slice(0, 8)}`, severity: "high", component: "bundles", element: "bundle_items" });
      }
    }

    // Orphan notifications
    const { data: recentNotifs } = await supabase.from("notifications").select("id, user_id, type, created_at").order("created_at", { ascending: false }).limit(50);
    const userIds = new Set((recentNotifs || []).map((n: any) => n.user_id).filter(Boolean));
    if (userIds.size > 0) {
      const { data: profiles } = await supabase.from("profiles").select("user_id").in("user_id", [...userIds]);
      const existingUserIds = new Set((profiles || []).map((p: any) => p.user_id));
      for (const n of recentNotifs || []) {
        if (n.user_id && !existingUserIds.has(n.user_id)) issues.push({ title: `Notis för borttagen användare`, severity: "medium", component: "notifications", entity_id: n.id });
      }
    }

    // Incidents without valid orders
    const { data: incidents } = await supabase.from("order_incidents").select("id, title, order_id, status").in("status", ["open", "investigating", "in_progress"]).limit(50);
    for (const inc of incidents || []) {
      const { data: order } = await supabase.from("orders").select("id").eq("id", inc.order_id).maybeSingle();
      if (!order) issues.push({ title: `Ärende "${inc.title}" → order finns ej`, severity: "high", component: "order_incidents", entity_id: inc.id });
    }

    // Active automation rules with empty config
    const { data: rules } = await supabase.from("automation_rules").select("id, rule_key, config, is_active").eq("is_active", true).limit(50);
    for (const r of rules || []) {
      if (!r.config || (typeof r.config === "object" && Object.keys(r.config).length === 0)) issues.push({ title: `Automationsregel utan config: "${r.rule_key}"`, severity: "medium", component: "automation_rules", entity_id: r.id });
    }

    // Email templates missing fields
    const { data: templates } = await supabase.from("email_templates").select("*").eq("is_active", true).limit(20);
    for (const t of templates || []) {
      if (!t.subject_sv || !t.intro_sv) issues.push({ title: `E-postmall "${t.template_type}" saknar ämne/intro`, severity: "high", component: "email_templates", entity_id: t.id });
    }

  } catch (e: any) { issues.push({ title: `Interaction QA error: ${e.message}`, severity: "critical", component: "interaction_qa" }); }

  const durationMs = Date.now() - startMs;
  const score = Math.max(0, 100 - issues.length * 6);
  return { issues, issues_found: issues.length, dead_elements: issues, interaction_score: score, overall_score: score, duration_ms: durationMs, scanned_at: new Date().toISOString(), real_db_scan: true };
}

// ── REAL DB SCAN: Component Map (UI Visual) ──
async function runRealComponentMapScan(supabase: any, scanRunId: string): Promise<any> {
  const issues: any[] = [];
  const startMs = Date.now();
  let componentsScanned = 0;

  try {
    // 1. Missing visible label: page_sections without title
    const { data: sections } = await supabase.from("page_sections").select("id, section_key, page, title_sv, title_en, is_visible").eq("is_visible", true).limit(200);
    componentsScanned += (sections || []).length;
    for (const s of sections || []) {
      if (!s.title_sv && !s.title_en) {
        issues.push({ title: `Missing visible label: section "${s.section_key}" on ${s.page}`, severity: "medium", component: s.section_key, element: "page_sections", category: "ui_visual", page: s.page, entity_id: s.id });
      }
    }

    // 2. Products missing title/description (label check)
    const { data: products } = await supabase.from("products").select("id, title_sv, title_en, description_sv, description_en, is_visible, image_urls, handle").eq("is_visible", true).limit(200);
    componentsScanned += (products || []).length;
    for (const p of products || []) {
      if (!p.title_sv && !p.title_en) {
        issues.push({ title: `Missing visible label: product "${p.handle || p.id.slice(0,8)}"`, severity: "high", component: "products", element: "ProductCard", category: "ui_visual", entity_id: p.id });
      }
      if (!p.description_sv && !p.description_en) {
        issues.push({ title: `Missing visible label: product description "${p.handle || p.id.slice(0,8)}"`, severity: "medium", component: "products", element: "ProductDetail", category: "ui_visual", entity_id: p.id });
      }
    }

    // 3. Categories missing label
    const { data: categories } = await supabase.from("categories").select("id, name_sv, name_en, slug, is_visible").eq("is_visible", true).limit(100);
    componentsScanned += (categories || []).length;
    for (const c of categories || []) {
      if (!c.name_sv && !c.name_en) {
        issues.push({ title: `Missing visible label: category "${c.slug}"`, severity: "high", component: "categories", element: "CategoryFilter", category: "ui_visual", entity_id: c.id });
      }
    }

    // 4. Dead interaction: bundles active but no items (clickable but no handler)
    const { data: activeBundles } = await supabase.from("bundles").select("id, name, is_active").eq("is_active", true).limit(50);
    componentsScanned += (activeBundles || []).length;
    for (const b of activeBundles || []) {
      const { count } = await supabase.from("bundle_items").select("id", { count: "exact", head: true }).eq("bundle_id", b.id);
      if (!count || count === 0) {
        issues.push({ title: `Dead interaction: bundle "${b.name}" active but empty`, severity: "high", component: "bundles", element: "ProductBundles", category: "ui_visual", entity_id: b.id });
      }
    }

    // 5. Inconsistent UI: products with mixed image counts (some have images, some don't)
    if (products && products.length > 0) {
      const withImages = products.filter((p: any) => p.image_urls && p.image_urls.length > 0).length;
      const withoutImages = products.filter((p: any) => !p.image_urls || p.image_urls.length === 0).length;
      if (withImages > 0 && withoutImages > 0) {
        issues.push({ title: `Inconsistent UI: ${withoutImages} products without images vs ${withImages} with images`, severity: "medium", component: "products", element: "ProductGrid", category: "ui_visual" });
      }
    }

    // 6. Layout compression: sections with same display_order (stacked/overlapping)
    if (sections && sections.length > 1) {
      const orderMap: Record<string, any[]> = {};
      for (const s of sections) {
        const pageKey = s.page;
        if (!orderMap[pageKey]) orderMap[pageKey] = [];
        orderMap[pageKey].push(s);
      }
      for (const [page, pageSections] of Object.entries(orderMap)) {
        const orders = pageSections.map((s: any) => s.display_order);
        const duplicateOrders = orders.filter((o: number, i: number) => orders.indexOf(o) !== i);
        if (duplicateOrders.length > 0) {
          issues.push({ title: `Layout compression: ${duplicateOrders.length} sections share display_order on "${page}"`, severity: "medium", component: "page_sections", element: "PageLayout", category: "ui_visual", page });
        }
      }
    }

    // 7. Dead interaction: email templates active but missing CTA
    const { data: emailTemplates } = await supabase.from("email_templates").select("id, template_type, cta_text_sv, cta_text_en, is_active").eq("is_active", true).limit(20);
    componentsScanned += (emailTemplates || []).length;
    for (const t of emailTemplates || []) {
      if (!t.cta_text_sv && !t.cta_text_en) {
        issues.push({ title: `Dead interaction: email "${t.template_type}" has no CTA`, severity: "medium", component: "email_templates", element: "EmailTemplate", category: "ui_visual", entity_id: t.id });
      }
    }

    // 8. Inconsistent UI: product_tags with mixed colors (some have color, some don't)
    const { data: tags } = await supabase.from("product_tags").select("id, name_sv, color, tag_type").limit(100);
    componentsScanned += (tags || []).length;
    if (tags && tags.length > 1) {
      const withColor = tags.filter((t: any) => t.color).length;
      const withoutColor = tags.filter((t: any) => !t.color).length;
      if (withColor > 0 && withoutColor > 0) {
        issues.push({ title: `Inconsistent UI: ${withoutColor} tags without color vs ${withColor} with color`, severity: "low", component: "product_tags", element: "TagBadge", category: "ui_visual" });
      }
    }

  } catch (e: any) { issues.push({ title: `Component map scan error: ${e.message}`, severity: "critical", component: "component_map", category: "ui_visual" }); }

  const durationMs = Date.now() - startMs;
  const score = Math.max(0, 100 - issues.length * 5);
  return { issues, issues_found: issues.length, components_scanned: componentsScanned, overall_score: score, duration_ms: durationMs, scanned_at: new Date().toISOString(), real_db_scan: true };
}

// ── REAL DB SCAN: UI Flow Integrity ──
async function runUiFlowIntegrityScan(supabase: any, scanRunId: string): Promise<any> {
  const issues: any[] = [];
  const startMs = Date.now();
  let flowsScanned = 0;

  // Known application routes
  const KNOWN_ROUTES = [
    "/", "/shop", "/produkter", "/about", "/contact", "/checkout",
    "/donations", "/cbd", "/business", "/whats-new", "/track-order",
    "/suggest-product", "/affiliate", "/balance", "/member",
    "/admin", "/privacy-policy", "/terms", "/returns-policy", "/shipping-policy",
  ];

  // Known flows: start → end
  const KNOWN_FLOWS = [
    { name: "Checkout", steps: ["product_view", "add_to_cart", "checkout", "payment", "confirmation"], startRoute: "/shop", endRoute: "/order-confirmation" },
    { name: "Login", steps: ["open_auth", "enter_credentials", "authenticated"], startRoute: "/", endRoute: "/" },
    { name: "Registration", steps: ["open_auth", "enter_details", "verify_email", "profile_created"], startRoute: "/", endRoute: "/member" },
    { name: "Track Order", steps: ["enter_email_order", "lookup", "display_status"], startRoute: "/track-order", endRoute: "/track-order" },
    { name: "Affiliate Signup", steps: ["landing", "apply", "confirmation"], startRoute: "/affiliate", endRoute: "/affiliate" },
    { name: "Donation", steps: ["select_amount", "checkout", "confirmation"], startRoute: "/donations", endRoute: "/donations" },
  ];

  try {
    // 1. Check routes have corresponding page_sections (content exists)
    const { data: sections } = await supabase.from("page_sections").select("page, section_key, is_visible").limit(500);
    const pagesWithContent = new Set((sections || []).map((s: any) => s.page));
    flowsScanned += KNOWN_ROUTES.length;

    for (const route of KNOWN_ROUTES) {
      const pageName = route === "/" ? "home" : route.replace(/^\//, "").replace(/-/g, "_");
      // Skip admin and policy routes (they don't use page_sections)
      if (route.startsWith("/admin") || route.includes("policy") || route.includes("terms")) continue;
      if (!pagesWithContent.has(pageName) && !pagesWithContent.has(route.replace(/^\//, ""))) {
        // Not necessarily broken, but flag if no content at all
      }
    }

    // 2. Check navigation paths: products should be navigable (have handles)
    const { data: products } = await supabase.from("products").select("id, handle, title_sv, is_visible").eq("is_visible", true).limit(200);
    flowsScanned += (products || []).length;
    for (const p of products || []) {
      if (!p.handle) {
        issues.push({ title: `Broken flow: product "${p.title_sv || p.id.slice(0,8)}" has no URL handle`, severity: "high", component: "products", element: "ProductDetail", category: "flow_ui", _issue_type: "bug", _suggested_fix: "Fix broken logic or missing connection" });
      }
    }

    // 3. Check categories have valid slugs (navigation targets)
    const { data: categories } = await supabase.from("categories").select("id, name_sv, slug, is_visible").eq("is_visible", true).limit(100);
    flowsScanned += (categories || []).length;
    for (const c of categories || []) {
      if (!c.slug || c.slug.trim() === "") {
        issues.push({ title: `Broken flow: category "${c.name_sv || c.id.slice(0,8)}" has no slug`, severity: "high", component: "categories", element: "CategoryFilter", category: "flow_ui", _issue_type: "bug", _suggested_fix: "Fix broken logic or missing connection" });
      }
    }

    // 4. Check flows have start → end: verify analytics events exist for flow steps
    const { data: recentEvents } = await supabase.from("analytics_events").select("event_type").order("created_at", { ascending: false }).limit(500);
    const eventTypes = new Set((recentEvents || []).map((e: any) => e.event_type));
    flowsScanned += KNOWN_FLOWS.length;

    for (const flow of KNOWN_FLOWS) {
      const missingSteps = flow.steps.filter(step => {
        // Check if any event matches this step pattern
        const patterns = [step, `${step}_start`, `${step}_complete`, flow.name.toLowerCase() + "_" + step];
        return !patterns.some(p => eventTypes.has(p));
      });

      if (missingSteps.length === flow.steps.length) {
        issues.push({ title: `Broken flow: "${flow.name}" has no tracked events (${flow.steps.length} steps missing)`, severity: "medium", component: flow.name, element: "FlowTracking", category: "flow_ui", _issue_type: "bug", _suggested_fix: "Fix broken logic or missing connection", route: flow.startRoute });
      } else if (missingSteps.length > 0 && missingSteps.length < flow.steps.length) {
        issues.push({ title: `Broken flow: "${flow.name}" incomplete tracking (${missingSteps.length}/${flow.steps.length} steps missing)`, severity: "low", component: flow.name, element: "FlowTracking", category: "flow_ui", _issue_type: "bug", _suggested_fix: "Fix broken logic or missing connection", route: flow.startRoute });
      }
    }

    // 5. Buttons point somewhere: bundles/promotions with no linked products
    const { data: activeBundles } = await supabase.from("bundles").select("id, name, is_active").eq("is_active", true).limit(50);
    flowsScanned += (activeBundles || []).length;
    for (const b of activeBundles || []) {
      const { count } = await supabase.from("bundle_items").select("id", { count: "exact", head: true }).eq("bundle_id", b.id);
      if (!count || count === 0) {
        issues.push({ title: `Broken flow: bundle "${b.name}" has no products (dead CTA)`, severity: "high", component: "bundles", element: "ProductBundles", category: "flow_ui", _issue_type: "bug", _suggested_fix: "Fix broken logic or missing connection" });
      }
    }

    // 6. Legal documents should be accessible (active)
    const { data: legalDocs } = await supabase.from("legal_documents").select("id, document_type, is_active, title_sv").limit(20);
    flowsScanned += (legalDocs || []).length;
    const requiredTypes = ["privacy_policy", "terms_conditions", "return_policy"];
    for (const reqType of requiredTypes) {
      const found = (legalDocs || []).find((d: any) => d.document_type === reqType && d.is_active);
      if (!found) {
        issues.push({ title: `Broken flow: required legal document "${reqType}" missing or inactive`, severity: "high", component: "legal_documents", element: "LegalPage", category: "flow_ui", _issue_type: "bug", _suggested_fix: "Fix broken logic or missing connection" });
      }
    }

    // 7. Flow chain analysis: check each known flow for complete chain coverage
    const productHandles = new Set((products || []).filter((p: any) => p.handle).map((p: any) => p.handle));
    const categorySlugs = new Set((categories || []).filter((c: any) => c.slug).map((c: any) => c.slug));
    const hasDbWrites = eventTypes.has("checkout_complete") || eventTypes.has("payment") || eventTypes.has("confirmation");

    for (const flow of KNOWN_FLOWS) {
      const chain = {
        has_ui: KNOWN_ROUTES.includes(flow.startRoute) || KNOWN_ROUTES.includes(flow.endRoute),
        has_action: flow.steps.some(step => eventTypes.has(step) || eventTypes.has(`${step}_start`) || eventTypes.has(`${step}_complete`)),
        has_flow: flow.steps.length >= 2,
        has_data: eventTypes.has(flow.steps[0]) || eventTypes.has(`${flow.name.toLowerCase()}_${flow.steps[0]}`),
        has_db: flow.name === "Checkout" ? hasDbWrites : eventTypes.has(flow.steps[flow.steps.length - 1]),
      };

      // ── Data Trace: track data through each pipeline stage ──
      const flowKey = flow.name.toLowerCase();
      const input_detected = chain.has_ui || flow.steps.some(step => eventTypes.has(step) || eventTypes.has(`${step}_start`));
      const mapped = chain.has_action || flow.steps.some(step => eventTypes.has(`${step}_complete`) || eventTypes.has(`${flowKey}_${step}`));
      const transformed = flow.steps.length >= 2 && flow.steps.slice(1).some(step => eventTypes.has(step) || eventTypes.has(`${step}_start`) || eventTypes.has(`${step}_complete`));
      const saved_to_db = chain.has_db;

      const data_trace = { input_detected, mapped, transformed, saved_to_db };

      // Detect data loss point
      const traceSteps = [
        { key: "input_detected", ok: input_detected },
        { key: "mapped", ok: mapped },
        { key: "transformed", ok: transformed },
        { key: "saved_to_db", ok: saved_to_db },
      ];
      let prevOk: string | null = null;
      for (const ts of traceSteps) {
        if (ts.ok) {
          prevOk = ts.key;
        } else if (prevOk) {
          issues.push({
            title: `Data lost at: ${prevOk} → ${ts.key} in "${flow.name}"`,
            severity: ts.key === "saved_to_db" ? "critical" : "high",
            component: flow.name,
            element: "DataTrace",
            category: "flow_data",
            _issue_type: "bug",
            _suggested_fix: `Verify data pipeline from ${prevOk} to ${ts.key}`,
            route: flow.startRoute,
            data_trace,
          });
          break; // report first break only
        }
      }

      // Attach chain + data_trace to existing issues for this flow
      const flowIssues = issues.filter((i: any) => i.component === flow.name);
      for (const fi of flowIssues) {
        fi._flow_chain = chain;
        fi.data_trace = data_trace;
      }

      // Detect broken chain links
      const chainParts = [
        { key: "UI", ok: chain.has_ui },
        { key: "Action", ok: chain.has_action },
        { key: "Flow", ok: chain.has_flow },
        { key: "Data", ok: chain.has_data },
        { key: "DB", ok: chain.has_db },
      ];
      const brokenLinks = chainParts.filter(p => !p.ok);
      if (brokenLinks.length > 0 && brokenLinks.length < chainParts.length) {
        const from = chainParts.find(p => p.ok)?.key || "UI";
        const to = chainParts.find(p => !p.ok)?.key || "DATA";
        issues.push({
          title: `Broken chain: ${from} → ${to} in "${flow.name}" (missing: ${brokenLinks.map(b => b.key).join(", ")})`,
          severity: brokenLinks.length >= 3 ? "high" : "medium",
          component: flow.name,
          element: "FlowChain",
          category: "flow_ui",
          _issue_type: "bug",
          _suggested_fix: "Fix broken logic or missing connection",
          route: flow.startRoute,
          _flow_chain: chain,
          data_trace,
        });
      }
    }

  } catch (e: any) { issues.push({ title: `UI Flow Integrity error: ${e.message}`, severity: "critical", component: "ui_flow_integrity", category: "flow_ui" }); }

  const durationMs = Date.now() - startMs;
  const score = Math.max(0, 100 - issues.length * 6);
  return { issues, issues_found: issues.length, flows_scanned: flowsScanned, overall_score: score, duration_ms: durationMs, scanned_at: new Date().toISOString(), real_db_scan: true };
}

// ── Map scan types to real DB functions ──
const REAL_DB_SCANNERS: Record<string, (supabase: any, scanRunId: string) => Promise<any>> = {
  data_integrity: runDataIntegrityScan,
  sync_scan: runRealSyncScan,
  system_scan: runRealSystemScan,
  feature_detection: runRealFeatureDetection,
  interaction_qa: runRealInteractionQA,
  component_map: runRealComponentMapScan,
  ui_flow_integrity: runUiFlowIntegrityScan,
};

// ── SCAN CONSISTENCY GUARD ──
// Compares current scan fingerprints against existing work_items from previous scans.
// - Reappearing issue (same fingerprint, active): update existing, do NOT create new
// - Severity changed: update priority on existing item, log change
// - Issue disappeared (active work_item fingerprint not in current scan): mark resolved

async function runConsistencyGuard(supabase: any, currentFingerprints: Map<string, { title: string; priority: string; item_type: string; description?: string }>) {
  // Fetch all active scan-sourced work_items with fingerprints
  const { data: activeItems } = await supabase
    .from("work_items")
    .select("id, title, status, priority, issue_fingerprint, created_at")
    .eq("source_type", "ai_scan")
    .not("issue_fingerprint", "is", null)
    .in("status", ["open", "claimed", "in_progress", "escalated", "new", "pending", "detected"])
    .limit(500);

  const existingByFp = new Map<string, any>();
  for (const item of activeItems || []) {
    if (item.issue_fingerprint) existingByFp.set(item.issue_fingerprint, item);
  }

  let resolved = 0;
  // Issues that disappeared: active work_item fingerprint not in current scan
  for (const [fp, item] of existingByFp) {
    if (!currentFingerprints.has(fp)) {
      await supabase.from("work_items").update({ status: "done", updated_at: new Date().toISOString() }).eq("id", item.id);
      console.log(`[consistency-guard] RESOLVED (disappeared): ${item.id.slice(0, 8)} "${item.title.slice(0, 40)}"`);
      resolved++;
    }
  }
  if (resolved > 0) console.log(`[consistency-guard] Marked ${resolved} disappeared issues as resolved`);

  return existingByFp;
}

// ── Create work items with CONSISTENCY GUARD ──
// ── Issue type classifier ──
function classifyIssueType(issue: any, category: string): "bug" | "improvement" | "upgrade" {
  const text = `${issue.title || ""} ${issue.description || ""} ${issue.fix_suggestion || ""} ${issue.type || ""} ${issue.failure_type || ""}`.toLowerCase();
  // Bug: broken flow, missing data, crash, error, data_loss, action_failed
  const bugPatterns = /broken|crash|error|missing data|data.?loss|action.?failed|lost.?state|orphan|saknas|finns ej|failed|duplicate|stale/;
  // Improvement: UI spacing, unclear CTA, layout, inconsistency
  const improvementPatterns = /spacing|layout|overflow|z-index|position|responsive|mobile|unclear|cta|inconsisten|alignment|truncat|padding|margin|style|visual|css/;
  // Upgrade: feature missing but expected, outdated pattern, fake feature
  const upgradePatterns = /fake.?feature|not.?implemented|placeholder|outdated|deprecated|missing.?feature|expected|wip|coming.?soon|icke.?funktionell/;

  if (category === "fake_features") return "upgrade";
  if (upgradePatterns.test(text)) return "upgrade";
  if (improvementPatterns.test(text)) return "improvement";
  if (bugPatterns.test(text)) return "bug";
  return "bug";
}

async function createWorkItems(supabase: any, unified: any, stage: SystemStage): Promise<{ created: number; createTrace: any[] }> {
  let workItemsCreated = 0;
  const createTrace: any[] = [];
  const allWorkIssues: { title: string; priority: string; item_type: string; description?: string; fingerprint: string; source_path?: string; source_file?: string; source_component?: string; issue_type?: string; suggested_fix?: string; affected_area?: { type: string; target: string } }[] = [];

  // Map issue categories to affected areas
  const CATEGORY_AREA_MAP: Record<string, { type: string; target: string }> = {
    broken_flows: { type: "flow", target: "checkout_flow" },
    fake_features: { type: "business", target: "features" },
    interaction_failures: { type: "flow", target: "checkout_flow" },
    data_issues: { type: "data", target: "orders" },
    blocker: { type: "edge", target: "blockers" },
  };

  function suggestedFixForType(issueType: string): string {
    if (issueType === "improvement") return "Adjust UI/UX for clarity and usability";
    if (issueType === "upgrade") return "Add or enhance feature based on expected behavior";
    return "Fix broken logic or missing connection";
  }

  // DEBUG MODE: Relaxed filter — only skip explicitly dev-expected issues
  const tagActionable = (issues: any[]) => issues.map(issue => {
    if (issue._dev_expected) {
      return { ...issue, _filter_decision: issue._filter_decision || "filtered_out", _filter_reason: issue._filter_reason || "not_actionable" };
    }
    return { ...issue, _filter_decision: issue._filter_decision || "passed" };
  });
  const isActionable = (issue: any) => !issue._dev_expected;

  if (unified.blocker) {
    const fp = generateFingerprint({ component: "blocker", type: "blocker", route: "global" });
    allWorkIssues.push({ title: `BLOCKER: ${unified.blocker.description || unified.blocker.title || "Critical blocker"}`.slice(0, 120), priority: "critical", item_type: "bug", fingerprint: fp, affected_area: CATEGORY_AREA_MAP.blocker });
  }

  // Group broken_flows before creating
  const groupedFlows = groupSimilarIssues(tagActionable(unified.broken_flows || []).filter(isActionable));
  for (const flow of groupedFlows.slice(0, 15)) {
    const fp = generateFingerprint(flow);
    const similarNote = flow._similar_count ? ` (+${flow._similar_count} liknande)` : "";
    const issueType = classifyIssueType(flow, "broken_flows");
    flow._issue_type = issueType;
    flow._suggested_fix = suggestedFixForType(issueType);
    flow._affected_area = flow.category === "flow_ui" ? { type: "flow", target: "ui_flows" } : CATEGORY_AREA_MAP.broken_flows;
    flow._origin_source = "ai_scan";
    allWorkIssues.push({
      title: `Broken flow: ${flow.description || flow.route || flow.issue || "unknown"}${similarNote}`.slice(0, 120),
      priority: "high", item_type: "bug", description: flow.fix_suggestion || flow.detail || "",
      fingerprint: fp, issue_type: issueType, suggested_fix: suggestedFixForType(issueType),
      source_path: flow.route || flow.page || null, source_file: flow.file || flow.source_file || null, source_component: flow.component || flow.element || null,
      affected_area: flow.category === "flow_ui" ? { type: "flow", target: "ui_flows" } : CATEGORY_AREA_MAP.broken_flows,
    });
  }

  const groupedFake = groupSimilarIssues(tagActionable(unified.fake_features || []).filter(isActionable));
  for (const fake of groupedFake.slice(0, 15)) {
    const fp = generateFingerprint(fake);
    const similarNote = fake._similar_count ? ` (+${fake._similar_count} liknande)` : "";
    const issueType = classifyIssueType(fake, "fake_features");
    fake._issue_type = issueType;
    fake._suggested_fix = suggestedFixForType(issueType);
    fake._affected_area = CATEGORY_AREA_MAP.fake_features;
    fake._origin_source = "ai_scan";
    allWorkIssues.push({
      title: `Fake feature: ${fake.name || fake.component || fake.description || "unknown"}${similarNote}`.slice(0, 120),
      priority: "high", item_type: "improvement", description: fake.reason || fake.detail || "",
      fingerprint: fp, issue_type: issueType, suggested_fix: suggestedFixForType(issueType),
      source_path: fake.route || fake.page || null, source_file: fake.file || fake.source_file || null, source_component: fake.component || fake.name || null,
      affected_area: CATEGORY_AREA_MAP.fake_features,
    });
  }

  const groupedInteraction = groupSimilarIssues(tagActionable(unified.interaction_failures || []).filter(isActionable));
  for (const fail of groupedInteraction.slice(0, 15)) {
    const fp = generateFingerprint(fail);
    const similarNote = fail._similar_count ? ` (+${fail._similar_count} liknande)` : "";
    const issueType = classifyIssueType(fail, "interaction_failures");
    fail._issue_type = issueType;
    fail._suggested_fix = suggestedFixForType(issueType);
    fail._affected_area = CATEGORY_AREA_MAP.interaction_failures;
    fail._origin_source = "ai_scan";
    allWorkIssues.push({
      title: `Interaction: ${fail.title || fail.element || fail.description || "unknown"}${similarNote}`.slice(0, 120),
      priority: fail.severity === "critical" ? "critical" : "high", item_type: "bug",
      description: fail.fix_suggestion || fail.detail || fail.issue || "",
      fingerprint: fp, issue_type: issueType, suggested_fix: suggestedFixForType(issueType),
      source_path: fail.route || fail.page || null, source_file: fail.file || fail.source_file || null, source_component: fail.component || fail.element || null,
      affected_area: CATEGORY_AREA_MAP.interaction_failures,
    });
  }

  const groupedData = groupSimilarIssues(tagActionable(unified.data_issues || []).filter(isActionable));
  for (const issue of groupedData.slice(0, 15)) {
    const fp = generateFingerprint(issue);
    const similarNote = issue._similar_count ? ` (+${issue._similar_count} liknande)` : "";
    const issueType = classifyIssueType(issue, "data_issues");
    issue._issue_type = issueType;
    issue._suggested_fix = suggestedFixForType(issueType);
    issue._affected_area = issue.category === "ui_visual" ? { type: "ui", target: "components" } : CATEGORY_AREA_MAP.data_issues;
    issue._origin_source = "ai_scan";
    allWorkIssues.push({
      title: `Data: ${issue.title || issue.field || issue.description || "unknown"}${similarNote}`.slice(0, 120),
      priority: issue.severity === "critical" ? "critical" : "medium", item_type: "bug",
      description: issue.fix_suggestion || issue.detail || "",
      fingerprint: fp, issue_type: issueType, suggested_fix: suggestedFixForType(issueType),
      source_path: issue.route || issue.page || null, source_file: issue.file || issue.source_file || null, source_component: issue.component || issue.table || issue.entity || null,
      affected_area: issue.category === "ui_visual" ? { type: "ui", target: "components" } : CATEGORY_AREA_MAP.data_issues,
    });
  }

  // Tag all scanner-created issues with origin_source
  for (const issue of allWorkIssues) {
    (issue as any)._origin_source = "ai_scan";
  }

  // ── IMPACT SCORING: classify each issue 1–5 ──
  const FLOW_KEYWORDS = ["checkout", "login", "order", "payment", "auth", "signup", "cart"];
  const ACTION_KEYWORDS = ["button", "click", "submit", "form", "action", "interaction", "navigation"];
  const DATA_KEYWORDS = ["data", "mismatch", "inconsisten", "sync", "orphan", "missing", "duplicate", "stale"];

  for (const issue of allWorkIssues) {
    const text = `${issue.title || ""} ${issue.description || ""} ${(issue as any).source_component || ""} ${(issue as any).source_path || ""}`.toLowerCase();
    const isFlow = FLOW_KEYWORDS.some(k => text.includes(k));
    const isAction = ACTION_KEYWORDS.some(k => text.includes(k));
    const isData = DATA_KEYWORDS.some(k => text.includes(k));
    const sevCritical = issue.priority === "critical";
    const sevHigh = issue.priority === "high";

    let impact_score = 1;
    let impact_label = "low";

    if (sevCritical || (isFlow && (sevHigh || sevCritical))) {
      impact_score = 5; impact_label = "critical";
    } else if (isFlow || (isAction && sevHigh)) {
      impact_score = 4; impact_label = "high";
    } else if (isData) {
      impact_score = 3; impact_label = "medium";
    } else if (isAction || issue.item_type === "improvement") {
      impact_score = 2; impact_label = "low";
    }

    (issue as any)._impact_score = impact_score;
    (issue as any)._impact_label = impact_label;
  }

  // ── CONSISTENCY GUARD: Build fingerprint map of current scan issues ──
  const currentFingerprints = new Map<string, { title: string; priority: string; item_type: string; description?: string }>();
  for (const issue of allWorkIssues) {
    currentFingerprints.set(issue.fingerprint, { title: issue.title, priority: issue.priority, item_type: issue.item_type, description: issue.description });
  }

  // Run guard: resolve disappeared issues, get existing map
  const existingByFp = await runConsistencyGuard(supabase, currentFingerprints);

  // ── PROCESS EACH ISSUE with consistency logic ──
  for (const issue of allWorkIssues) {
    // Validation checks
    if (!issue.title || issue.title.trim().length === 0) {
      createTrace.push({ title: issue.title, fingerprint: issue.fingerprint, _create_decision: 'skipped_validation', _validation_reason: 'missing_title', issue_type: issue.issue_type || 'bug', affected_area: issue.affected_area });
      continue;
    }
    if (!issue.item_type || issue.item_type.trim().length === 0) {
      createTrace.push({ title: issue.title, fingerprint: issue.fingerprint, _create_decision: 'skipped_validation', _validation_reason: 'missing_type', issue_type: issue.issue_type || 'bug', affected_area: issue.affected_area });
      continue;
    }

    const existingItem = existingByFp.get(issue.fingerprint);

    if (existingItem) {
      // 24h window: only block if created within last 24 hours
      const itemAge = Date.now() - new Date(existingItem.created_at).getTime();
      const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
      if (itemAge <= TWENTY_FOUR_HOURS) {
        // REAPPEARING ISSUE within 24h — do NOT create new, but update occurrence tracking
        const updatePayload: Record<string, any> = {
          last_seen_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        if (existingItem.priority !== issue.priority) {
          updatePayload.priority = issue.priority;
        }
        await supabase.from("work_items").update(updatePayload).eq("id", existingItem.id);
        // Increment occurrence_count via raw increment
        await supabase.rpc("increment_work_item_occurrence", { p_work_item_id: existingItem.id }).catch(() => {
          // Fallback if RPC doesn't exist yet
          console.log(`[occurrence] RPC fallback for ${existingItem.id.slice(0, 8)}`);
        });

        if (existingItem.priority !== issue.priority) {
          await supabase.from("system_observability_log").insert({
            event_type: "action", severity: "info", source: "consistency_guard",
            message: `Severity ändrad: "${issue.title.slice(0, 60)}" ${existingItem.priority} → ${issue.priority}`,
            details: { work_item_id: existingItem.id, old_priority: existingItem.priority, new_priority: issue.priority },
            component: "scan-consistency-guard",
          });
          console.log(`[consistency-guard] SEVERITY UPDATED: ${existingItem.id.slice(0, 8)} ${existingItem.priority} → ${issue.priority}`);
        } else {
          console.log(`[consistency-guard] LINKED (unchanged, <24h): ${existingItem.id.slice(0, 8)} "${issue.title.slice(0, 40)}"`);
        }
        createTrace.push({ title: issue.title, fingerprint: issue.fingerprint, _create_decision: 'skipped_dedup', _dedup_reason: 'fingerprint_match', existing_item_id: existingItem.id, issue_type: issue.issue_type || 'bug', affected_area: issue.affected_area });
        continue;
      } else {
        console.log(`[consistency-guard] ALLOW re-creation (>24h old): "${issue.title.slice(0, 40)}" (existing ${existingItem.id.slice(0, 8)})`);
      }
    }

    // Fallback: fuzzy title match — DEBUG: narrowed to first 20 chars for less aggressive dedup
    const searchTitle = issue.title.substring(0, 20);
    const { data: existingByTitle } = await supabase
      .from("work_items")
      .select("id, priority")
      .ilike("title", `%${searchTitle}%`)
      .in("status", ["open", "claimed", "in_progress", "escalated", "new", "pending", "detected"])
      .limit(1);

    if (existingByTitle?.length) {
      await supabase.from("work_items").update({
        issue_fingerprint: issue.fingerprint,
        last_seen_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", existingByTitle[0].id);
      await supabase.rpc("increment_work_item_occurrence", { p_work_item_id: existingByTitle[0].id }).catch(() => {});
      console.log(`[consistency-guard] LINKED by title: ${existingByTitle[0].id.slice(0, 8)} "${issue.title.slice(0, 40)}"`);
      createTrace.push({ title: issue.title, fingerprint: issue.fingerprint, _create_decision: 'skipped_dedup', _dedup_reason: 'title_match', existing_item_id: existingByTitle[0].id, issue_type: issue.issue_type || 'bug', affected_area: issue.affected_area });
      continue;
    }

    // NEW ISSUE — create
    const now = new Date().toISOString();
    // Try match a recent runtime_trace (within 60s)
    let matchedTraceId: string | null = null;
    if (issue.issue_type === "bug" || issue.affected_area === "data" || issue.title?.toLowerCase().includes("missing") || issue.title?.toLowerCase().includes("mismatch") || issue.title?.toLowerCase().includes("null") || issue.title?.toLowerCase().includes("lost")) {
      try {
        const cutoff = new Date(Date.now() - 60_000).toISOString();
        const keywords = (issue.title || "").split(/\s+/).filter((w: string) => w.length > 4).slice(0, 3);
        let traceQuery = supabase.from("runtime_traces").select("id, error_message").gte("created_at", cutoff).order("created_at", { ascending: false }).limit(5);
        const { data: traces } = await traceQuery;
        if (traces?.length) {
          const match = traces.find((t: any) => keywords.some((kw: string) => t.error_message?.toLowerCase().includes(kw.toLowerCase())));
          matchedTraceId = match?.id || traces[0]?.id || null;
        }
      } catch (_) {}
    }

    const insertPayload: Record<string, any> = {
      title: issue.title,
      description: issue.description || "Auto-generated from scan",
      status: "open",
      priority: issue.priority,
      item_type: issue.item_type,
      source_type: "ai_scan",
      ai_detected: true,
      issue_fingerprint: issue.fingerprint,
      source_path: issue.source_path || null,
      source_file: issue.source_file || null,
      source_component: issue.source_component || null,
      first_seen_at: now,
      last_seen_at: now,
      occurrence_count: 1,
      ...(matchedTraceId ? { runtime_trace_id: matchedTraceId } : {}),
    };

    let verified = false;
    for (let attempt = 1; attempt <= 2; attempt++) {
      const { data: created, error } = await supabase.from("work_items").insert(insertPayload).select("id, title, status").single();
      if (error) {
        console.error(`[create-verify] INSERT failed (attempt ${attempt}):`, error.message);
        continue;
      }
      const { data: fetched } = await supabase.from("work_items").select("id").eq("id", created.id).maybeSingle();
      if (!fetched) {
        console.error(`[create-verify] VERIFY failed — id=${created.id} not found`);
        continue;
      }
      console.log(`[create-verify] ✅ VERIFIED: ${created.id} "${issue.title.slice(0, 40)}"`);
      workItemsCreated++;
      verified = true;
      createTrace.push({ title: issue.title, fingerprint: issue.fingerprint, _create_decision: 'created', created_id: created.id, issue_type: issue.issue_type || 'bug', affected_area: issue.affected_area, _origin_source: 'ai_scan', _impact_score: (issue as any)._impact_score, _impact_label: (issue as any)._impact_label });
      
      break;
    }
    if (!verified) {
      createTrace.push({ title: issue.title, fingerprint: issue.fingerprint, _create_decision: 'skipped_validation', _validation_reason: 'invalid_payload', issue_type: issue.issue_type || 'bug', affected_area: issue.affected_area });
      console.error(`[create-verify] ❌ FAILED: "${issue.title.slice(0, 60)}"`);
    }
  }

  return { created: workItemsCreated, createTrace };
}

// ── Helper: Persist per-step scan results ──
async function persistStepResults(supabase: any, steps: typeof STEPS, results: Record<string, any>, startedBy: string) {
  for (const stepDef of steps) {
    const stepRes = results[stepDef.id];
    if (!stepRes || stepRes.failed) continue;
    const stepScore = stepRes.overall_score ?? stepRes.system_score ?? stepRes.score ?? stepRes.health_score ?? stepRes.sync_score ?? stepRes.ux_score ?? stepRes.interaction_score ?? null;
    const stepIssues = stepRes.issues_found ?? stepRes.issues?.length ?? stepRes.dead_elements?.length ?? stepRes.mismatches?.length ?? 0;
    await supabase.from("ai_scan_results").insert({
      scan_type: stepDef.scanType, results: stepRes, overall_score: stepScore,
      overall_status: stepScore != null ? (stepScore >= 75 ? "healthy" : stepScore >= 50 ? "warning" : "critical") : null,
      executive_summary: stepRes.executive_summary || `${stepDef.id}: score ${stepScore ?? '?'}, ${stepIssues} issues`,
      issues_count: stepIssues, tasks_created: stepRes.tasks_created || 0, scanned_by: startedBy,
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

    // ── START ──
    if (action === "start") {
      const authHeader = req.headers.get("authorization");
      if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

      const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
      const token = authHeader.replace("Bearer ", "");
      const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
      if (claimsError || !claimsData?.claims?.sub) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
      const userId = claimsData.claims.sub as string;

      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
      const isStaff = roles?.some((r: any) => ["admin", "founder", "it", "support", "moderator"].includes(r.role));
      if (!isStaff) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 403, headers: corsHeaders });

      // Check running scan lock
      const { data: running } = await supabase.from("scan_runs").select("id, started_by, current_step_label, started_at").eq("status", "running").limit(1);
      if (running?.length) {
        const startedAt = new Date(running[0].started_at).getTime();
        if (Date.now() - startedAt > 15 * 60 * 1000) {
          await supabase.from("scan_runs").update({ status: "error", error_message: "Timeout 15 min", completed_at: new Date().toISOString() }).eq("id", running[0].id);
        } else {
          return new Response(JSON.stringify({ error: "En skanning körs redan", running_scan: running[0] }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }

      // Get system stage
      const systemStage = await getSystemStage(supabase);

      const focusMemory = await loadFocusMemory(supabase);
      const prioritizedSteps = prioritizeSteps(STEPS, focusMemory);

      const { data: scanRun, error: insertError } = await supabase.from("scan_runs").insert({
        status: "running", started_by: userId, current_step: 0, total_steps: prioritizedSteps.length,
        current_step_label: prioritizedSteps[0].label, steps_results: {},
        iteration: 1, max_iterations: MAX_ITERATIONS, iteration_results: [], pattern_discoveries: [],
        high_risk_areas: focusMemory.slice(0, 10).map((m: any) => ({ component: m.label, issue_count: m.issue_count, risk_level: m.severity, source: "focus_memory" })),
        coverage_score: 0, total_new_issues: 0,
        system_stage: systemStage, // Store stage in scan run
      }).select("id").single();

      if (insertError || !scanRun) return new Response(JSON.stringify({ error: "Failed to create scan run" }), { status: 500, headers: corsHeaders });

      fetch(`${supabaseUrl}/functions/v1/run-full-scan`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
        body: JSON.stringify({ action: "process_step", scan_run_id: scanRun.id, step_index: 0, iteration: 1 }),
      }).catch((e) => console.error("Failed to chain first step:", e));

      return new Response(JSON.stringify({ scan_run_id: scanRun.id, status: "started", system_stage: systemStage }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── PROCESS_STEP ──
    if (action === "process_step" && scan_run_id && step_index !== undefined) {
      const currentIteration = iteration || 1;
      const { data: scanRun } = await supabase.from("scan_runs").select("*").eq("id", scan_run_id).single();
      if (!scanRun || scanRun.status !== "running") return new Response(JSON.stringify({ error: "Scan not running" }), { status: 400, headers: corsHeaders });

      const step = currentIteration === 1 ? STEPS[step_index] : (scanRun._targeted_steps || STEPS)[step_index];
      if (!step) return new Response(JSON.stringify({ error: "Invalid step index" }), { status: 400, headers: corsHeaders });

      await supabase.from("scan_runs").update({ current_step: step_index, current_step_label: `[Iteration ${currentIteration}/${MAX_ITERATIONS}] ${step.label}`, iteration: currentIteration }).eq("id", scan_run_id);

      let stepResult: any = { error: "unknown", failed: true };
      const stepStart = Date.now();

      try {
        const realScanner = REAL_DB_SCANNERS[step.scanType];
        if (realScanner) {
          console.log(`[scan] Running REAL DB scanner for ${step.scanType}`);
          const dbResult = await realScanner(supabase, scan_run_id);
          let aiEnrichment: any = null;
          try {
            const resp = await fetch(`${supabaseUrl}/functions/v1/ai-assistant`, {
              method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
              body: JSON.stringify({ type: step.scanType, orchestrated: true, step_index, real_db_findings: { issues_count: dbResult.issues_found || dbResult.total_issues || 0, score: dbResult.overall_score, sample_issues: (dbResult.issues || dbResult.mismatches || dbResult.features || []).slice(0, 5).map((i: any) => i.title || i.name || "") } }),
            });
            if (resp.ok) { const data = await resp.json(); aiEnrichment = data.result || data; }
          } catch (_) {}
          stepResult = { ...dbResult, ai_suggestions: aiEnrichment?.suggestions || aiEnrichment?.recommendations || [], ai_summary: aiEnrichment?.summary || aiEnrichment?.executive_summary || null };
        } else {
          console.log(`[scan] Running AI-only scanner for ${step.scanType}`);
          const previousContext: Record<string, any> = {};
          const existingResults = scanRun.steps_results || {};
          for (const [key, val] of Object.entries(existingResults)) {
            const v = val as any;
            if (v?.overall_score != null) previousContext[key] = { score: v.overall_score };
            if (v?.issues_count != null) previousContext[key] = { ...previousContext[key], issues: v.issues_count };
          }
          let deepScanContext: any = undefined;
          if (currentIteration > 1) {
            deepScanContext = { iteration: currentIteration, previous_patterns: scanRun.pattern_discoveries || [], high_risk_areas: scanRun.high_risk_areas || [], instruction: "DEEP RE-SCAN. Focus on high_risk_areas and patterns." };
          }
          const resp = await fetch(`${supabaseUrl}/functions/v1/ai-assistant`, {
            method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
            body: JSON.stringify({ type: step.scanType, orchestrated: true, step_index, previous_context: Object.keys(previousContext).length > 0 ? previousContext : undefined, deep_scan_context: deepScanContext }),
          });
          if (resp.ok) { const data = await resp.json(); stepResult = data.result || data; }
          else { const errBody = await resp.text().catch(() => ""); stepResult = { error: `HTTP ${resp.status}: ${errBody.substring(0, 200)}`, failed: true }; }
        }
      } catch (e: any) { stepResult = { error: e.message, failed: true }; }

      const duration_ms = Date.now() - stepStart;
      const scanFinishedAt = new Date().toISOString();
      const scanStartedAt = new Date(Date.now() - duration_ms).toISOString();

      // ── Normalize scanner output ──
      const didExecute = !stepResult.failed && !stepResult.error;
      stepResult._executed = didExecute;
      stepResult._scanner_name = step.id;
      if (didExecute) {
        if (!Array.isArray(stepResult.issues)) {
          stepResult.issues = stepResult.issues ?? [];
        }
      } else {
        stepResult.issues = stepResult.issues ?? [];
      }

      // ── Extended metadata ──
      stepResult._execution_time_ms = duration_ms;
      stepResult._scan_started_at = scanStartedAt;
      stepResult._scan_finished_at = scanFinishedAt;

      // Compute input_size from scanner-specific fields
      const inputSize = stepResult.components_scanned ?? stepResult.routes_scanned ?? stepResult.records_scanned ?? stepResult.features_scanned ?? stepResult.tables_scanned ?? stepResult.flows_scanned ?? stepResult.items_scanned ?? stepResult.total_checked ?? stepResult.total_scanned ?? 0;
      stepResult._input_size = inputSize;

      // Determine empty_reason when 0 issues
      if (stepResult.issues.length === 0) {
        if (stepResult.failed || stepResult.error) {
          stepResult._empty_reason = "scanner_failed";
        } else if (inputSize === 0) {
          stepResult._empty_reason = "no_data";
        } else if (didExecute) {
          stepResult._empty_reason = "no_detection";
        } else {
          stepResult._empty_reason = "not_applicable";
        }
      }

      // ── Scan scope metadata ──
      const SCAN_SCOPE_MAP: Record<string, { type: string; target: string }> = {
        data_integrity: { type: "data", target: "orders" },
        data_flow_validation: { type: "data", target: "orders" },
        sync_scan: { type: "data", target: "products" },
        component_map: { type: "ui", target: "components" },
        ui_data_binding: { type: "ui", target: "components" },
        interaction_qa: { type: "flow", target: "checkout_flow" },
        human_test: { type: "flow", target: "checkout_flow" },
        nav_scan: { type: "ui", target: "routes" },
        feature_detection: { type: "business", target: "features" },
        system_scan: { type: "business", target: "regressions" },
        decision_engine: { type: "business", target: "rules" },
        blocker_detection: { type: "edge", target: "blockers" },
        ui_flow_integrity: { type: "flow", target: "ui_flows" },
      };
      const scopeDef = SCAN_SCOPE_MAP[step.scanType] || { type: "edge", target: step.scanType };
      stepResult._scan_scope = { type: scopeDef.type, target: scopeDef.target, size: inputSize };
      stepResult._affected_area = { type: scopeDef.type, target: scopeDef.target };

      // ── Upsert system_structure_map ──
      await supabase.from("system_structure_map").upsert({
        entity_type: scopeDef.type,
        entity_name: scopeDef.target,
        source_path: step.scanType,
        last_seen_at: new Date().toISOString(),
        scan_count: 1,
      }, { onConflict: "entity_type,entity_name" }).then(async () => {
        // Increment scan_count for existing rows (upsert sets 1 for new)
        await supabase.rpc("increment_structure_map_scan", { p_entity_type: scopeDef.type, p_entity_name: scopeDef.target }).catch(() => {});
      }).catch(() => {});

      stepResult._duration_ms = duration_ms;
      stepResult._step_id = step.id;
      stepResult._iteration = currentIteration;

      await supabase.from("system_observability_log").insert({
        event_type: "scan_step", severity: stepResult.failed ? "error" : "info", source: "scanner",
        message: stepResult.failed ? `Steg misslyckades: ${step.label}` : `Steg klart: ${step.label}`,
        details: { step_id: step.id, iteration: currentIteration, failed: !!stepResult.failed },
        scan_id: scan_run_id, trace_id: `full-scan-${scan_run_id.slice(0, 8)}`, component: step.scanType, duration_ms,
      }).catch(() => {});

      const updatedResults = { ...(scanRun.steps_results || {}), [step.id]: stepResult };
      const stepsForIteration = currentIteration === 1 ? STEPS : (scanRun._targeted_steps || STEPS);
      const isLastStep = step_index + 1 >= stepsForIteration.length;

      if (!isLastStep) {
        const nextStep = stepsForIteration[step_index + 1];
        await supabase.from("scan_runs").update({ steps_results: updatedResults, current_step: step_index + 1, current_step_label: `[Iteration ${currentIteration}/${MAX_ITERATIONS}] ${nextStep.label}` }).eq("id", scan_run_id);
        fetch(`${supabaseUrl}/functions/v1/run-full-scan`, {
          method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
          body: JSON.stringify({ action: "process_step", scan_run_id, step_index: step_index + 1, iteration: currentIteration }),
        }).catch((e) => console.error("Failed to chain next step:", e));
      } else {
        await supabase.from("scan_runs").update({ steps_results: updatedResults }).eq("id", scan_run_id);
        fetch(`${supabaseUrl}/functions/v1/run-full-scan`, {
          method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
          body: JSON.stringify({ action: "evaluate_iteration", scan_run_id, iteration: currentIteration }),
        }).catch((e) => console.error("Failed to chain evaluation:", e));
      }

      return new Response(JSON.stringify({ ok: true, step: step.id, step_index, iteration: currentIteration }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── EVALUATE_ITERATION ──
    if (action === "evaluate_iteration" && scan_run_id) {
      const currentIteration = iteration || 1;
      const { data: scanRun } = await supabase.from("scan_runs").select("*").eq("id", scan_run_id).single();
      if (!scanRun || scanRun.status !== "running") return new Response(JSON.stringify({ error: "Scan not running" }), { status: 400, headers: corsHeaders });

      await supabase.from("scan_runs").update({ current_step_label: `[Iteration ${currentIteration}/${MAX_ITERATIONS}] Analyserar mönster...` }).eq("id", scan_run_id);

      const updatedResults = scanRun.steps_results || {};
      const totalDuration = Object.values(updatedResults).reduce((sum: number, r: any) => sum + (r?._duration_ms || 0), 0);
      const unified = buildUnifiedResult(updatedResults, totalDuration);

      const { data: rootCauseData } = await supabase.from("root_cause_memory").select("pattern_key, affected_system, root_cause, recurrence_count, severity").order("recurrence_count", { ascending: false }).limit(50);
      const { patterns, highRiskAreas, systemicIssues } = extractPatterns(unified, rootCauseData || []);

      const previousIssueKeys = new Set<string>();
      const prevIterResults = scanRun.iteration_results || [];
      for (const prevIter of prevIterResults) { for (const key of (prevIter.issue_keys || [])) { previousIssueKeys.add(key); } }

      const { newCount, newKeys } = countNewIssues(unified, previousIssueKeys);
      const scannedScanTypes = new Set(Object.keys(updatedResults).map(k => { const step = STEPS.find(s => s.id === k); return step?.scanType || k; }));
      const baseCoverage = Math.round((scannedScanTypes.size / STEPS.length) * 100);
      const coverageScore = Math.min(100, baseCoverage + Math.min(20, (currentIteration - 1) * 10));

      const iterationResult = {
        iteration: currentIteration, new_issues_found: newCount,
        total_issues: unified.broken_flows.length + unified.fake_features.length + unified.interaction_failures.length + unified.data_issues.length,
        patterns_discovered: patterns.length, high_risk_areas: highRiskAreas.length,
        systemic_issues: systemicIssues.length, health_score: unified.system_health_score,
        issue_keys: [...newKeys], completed_at: new Date().toISOString(),
      };

      const allIterResults = [...prevIterResults, iterationResult];
      const allPatterns = [...(scanRun.pattern_discoveries || []), ...patterns];
      const allHighRisk = [...(scanRun.high_risk_areas || []), ...highRiskAreas];
      const totalNewIssues = (scanRun.total_new_issues || 0) + newCount;

      await supabase.from("scan_runs").update({ iteration_results: allIterResults, pattern_discoveries: allPatterns, high_risk_areas: allHighRisk, coverage_score: coverageScore, total_new_issues: totalNewIssues }).eq("id", scan_run_id);

      const shouldRecurse = currentIteration < MAX_ITERATIONS && newCount > 0 && (highRiskAreas.length > 0 || patterns.length > 0);

      if (shouldRecurse) {
        const targetedSteps = buildTargetedSteps(patterns, highRiskAreas, currentIteration + 1);
        if (targetedSteps.length > 0) {
          await supabase.from("scan_runs").update({ current_step_label: `[Iteration ${currentIteration + 1}/${MAX_ITERATIONS}] ${targetedSteps[0].label}`, current_step: 0, total_steps: STEPS.length + targetedSteps.length * currentIteration, _targeted_steps: targetedSteps }).eq("id", scan_run_id);
          fetch(`${supabaseUrl}/functions/v1/run-full-scan`, {
            method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
            body: JSON.stringify({ action: "process_step", scan_run_id, step_index: 0, iteration: currentIteration + 1 }),
          }).catch((e) => console.error("Failed to chain re-scan:", e));
          return new Response(JSON.stringify({ ok: true, action: "recursing", iteration: currentIteration + 1 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }

      fetch(`${supabaseUrl}/functions/v1/run-full-scan`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
        body: JSON.stringify({ action: "finalize", scan_run_id }),
      }).catch((e) => console.error("Failed to chain finalize:", e));

      return new Response(JSON.stringify({ ok: true, action: "finalizing", iterations_completed: currentIteration }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── FINALIZE ──
    if (action === "finalize" && scan_run_id) {
      const { data: scanRun } = await supabase.from("scan_runs").select("*").eq("id", scan_run_id).single();
      if (!scanRun || scanRun.status !== "running") return new Response(JSON.stringify({ error: "Scan not running" }), { status: 400, headers: corsHeaders });

      const systemStage: SystemStage = scanRun.system_stage || await getSystemStage(supabase);

      await supabase.from("scan_runs").update({ current_step_label: "Kör dataintegritetskontroll..." }).eq("id", scan_run_id);
      const integrityResult = await runDataIntegrityScan(supabase, scan_run_id);

      await supabase.from("scan_runs").update({ current_step_label: "Kör funktionell beteendeskanning..." }).eq("id", scan_run_id);
      const behaviorResult = await runFunctionalBehaviorScan(supabase, scan_run_id);

      await supabase.from("scan_runs").update({ current_step_label: "Sammanställer resultat..." }).eq("id", scan_run_id);

      const updatedResults = scanRun.steps_results || {};
      updatedResults._data_integrity = integrityResult;
      updatedResults._functional_behavior = behaviorResult;

      const totalDuration = Object.values(updatedResults).reduce((sum: number, r: any) => sum + (r?._duration_ms || 0), 0);
      const unified = buildUnifiedResult(updatedResults, totalDuration);

      // ── CONTEXT AWARENESS: Filter dev false positives ──
      unified.broken_flows = filterDevFalsePositives(unified.broken_flows, systemStage);
      unified.interaction_failures = filterDevFalsePositives(unified.interaction_failures, systemStage);
      unified.data_issues = filterDevFalsePositives(unified.data_issues, systemStage);

      // Merge integrity issues
      for (const issue of integrityResult.issues || []) {
        unified.data_issues.push({ title: issue.title, description: issue.description, severity: issue.severity, type: issue.type, entity: issue.entity, entity_id: issue.entity_id, step: issue.step, root_cause: issue.root_cause, source: "integrity_scan", component: issue.component || "integrity" });
      }
      unified.integrity_issues = integrityResult.issues || [];
      unified.integrity_summary = integrityResult.by_type || {};
      unified.behavior_failures = behaviorResult.failures || [];
      unified.behavior_summary = behaviorResult.by_type || {};

      for (const f of behaviorResult.failures || []) {
        if (f.severity === "critical" || f.severity === "high") {
          unified.interaction_failures.push({ title: `[Behavior] ${f.chain}: ${f.action}`, description: `Expected: ${f.expected}\nActual: ${f.actual}`, severity: f.severity, type: f.failure_type, step: f.step, source: "behavior_scan", component: f.chain || "behavior" });
        }
      }

      // ── GROUP SIMILAR ISSUES in final result ──
      unified.broken_flows = groupSimilarIssues(unified.broken_flows);
      unified.interaction_failures = groupSimilarIssues(unified.interaction_failures);
      unified.data_issues = groupSimilarIssues(unified.data_issues);
      unified.fake_features = groupSimilarIssues(unified.fake_features);

      // ── VIEWPORT TAGGING for UI issues ──
      const VIEWPORT_CHECKS = [
        { type: "desktop", width: 1440 },
        { type: "tablet", width: 768 },
        { type: "mobile", width: 375 },
      ];
      unified._viewport_checks = VIEWPORT_CHECKS;

      const LAYOUT_PATTERN = /overflow|scroll|z-index|position|sticky|fixed|absolute|flex|grid|responsive|mobile|tablet|desktop|breakpoint|truncat|clip|hidden|wrap|width|height|padding|margin|gap|spacing|layout|resize|viewport/i;
      const UI_PATTERN = /layout|overflow|scroll|z-index|position|css|style|responsive|mobile|tablet|component|button|modal|dialog|drawer|header|footer|nav|sidebar|card|form|input|select|image|icon/i;

      function tagViewport(issues: any[]): any[] {
        const result: any[] = [];
        for (const issue of issues) {
          const text = `${issue.title || ""} ${issue.description || ""} ${issue.component || ""} ${issue.element || ""} ${issue.route || ""}`.toLowerCase();
          const isLayout = LAYOUT_PATTERN.test(text);
          const isUi = UI_PATTERN.test(text);

          if (isLayout) {
            // Duplicate per viewport
            for (const vp of VIEWPORT_CHECKS) {
              result.push({ ...issue, _viewport: vp.type, _viewport_width: vp.width });
            }
          } else if (isUi) {
            // Tag as desktop (default viewport)
            result.push({ ...issue, _viewport: "desktop", _viewport_width: 1440 });
          } else {
            result.push(issue);
          }
        }
        return result;
      }

      unified.broken_flows = tagViewport(unified.broken_flows);
      unified.interaction_failures = tagViewport(unified.interaction_failures);
      unified.fake_features = tagViewport(unified.fake_features);

      // Count only actionable (non-dev-expected) issues
      const actionableIssues = [
        ...unified.broken_flows.filter((i: any) => !i._dev_expected),
        ...unified.fake_features.filter((i: any) => !i._dev_expected),
        ...unified.interaction_failures.filter((i: any) => !i._dev_expected),
        ...unified.data_issues.filter((i: any) => !i._dev_expected),
      ];
      const issuesCount = actionableIssues.length;

      const iterationsCompleted = scanRun.iteration || 1;
      const patternDiscoveries = scanRun.pattern_discoveries || [];
      const highRiskAreas = scanRun.high_risk_areas || [];
      const coverageScore = scanRun.coverage_score || 0;

      const { data: finalRootCause } = await supabase.from("root_cause_memory").select("pattern_key, affected_system, root_cause, recurrence_count, severity").order("recurrence_count", { ascending: false }).limit(50);
      const { systemicIssues } = extractPatterns(unified, finalRootCause || []);

      await saveFocusMemory(supabase, unified, highRiskAreas, patternDiscoveries);
      const updatedFocusMemory = await loadFocusMemory(supabase);
      const predictions = generatePredictions(unified, patternDiscoveries, systemicIssues, updatedFocusMemory, finalRootCause || []);

      // ── BUILD SYSTEM OVERVIEW ──
      const systemOverview = buildSystemOverview(updatedResults, unified, systemStage);

      // ── HIGH ATTENTION AREA DETECTION ──
      const highAttentionAreas: { type: string; target: string; reason: string }[] = [];
      // Count issues per affected_area target
      const targetIssueCounts: Record<string, { type: string; target: string; count: number }> = {};
      for (const issue of actionableIssues) {
        const area = (issue as any)._affected_area;
        if (area?.target) {
          const key = `${area.type}::${area.target}`;
          if (!targetIssueCounts[key]) targetIssueCounts[key] = { type: area.type, target: area.target, count: 0 };
          targetIssueCounts[key].count++;
        }
      }
      for (const [, entry] of Object.entries(targetIssueCounts)) {
        if (entry.count > 3) {
          highAttentionAreas.push({ type: entry.type, target: entry.target, reason: `${entry.count} issues in single scan` });
        }
      }
      // Check system_structure_map for targets with 3+ consecutive scans
      const { data: structureEntries } = await supabase.from("system_structure_map").select("entity_type, entity_name, scan_count").gte("scan_count", 3);
      if (structureEntries) {
        for (const entry of structureEntries) {
          const key = `${entry.entity_type}::${entry.entity_name}`;
          // Only flag if this target also has issues in the current scan
          if (targetIssueCounts[key] && !highAttentionAreas.find(h => h.type === entry.entity_type && h.target === entry.entity_name)) {
            highAttentionAreas.push({ type: entry.entity_type, target: entry.entity_name, reason: `Issues in ${entry.scan_count} consecutive scans` });
          }
        }
      }

      // ── SUSPICIOUS AREA DETECTION ──
      const suspiciousAreas: { target: string; type: string; reason: string }[] = [];

      // All structure map entities
      const { data: allStructure } = await supabase.from("system_structure_map").select("entity_type, entity_name, scan_count, source_path").limit(200);
      const allStructureEntries = allStructure || [];

      // Collect all scanned targets from step results
      const scannedTargets = new Set<string>();
      for (const [, val] of Object.entries(updatedResults)) {
        if (val?._scan_scope?.target) scannedTargets.add(val._scan_scope.target.toLowerCase());
      }

      // 1. Unscanned entity near area with known issues
      for (const entry of allStructureEntries) {
        const nameL = entry.entity_name?.toLowerCase() || "";
        const isScanned = Array.from(scannedTargets).some(t => nameL.includes(t) || t.includes(nameL));
        if (!isScanned && entry.scan_count > 0) {
          const relatedHasIssues = Object.entries(targetIssueCounts).some(([key]) => key.split("::")[0] === entry.entity_type);
          if (relatedHasIssues) {
            suspiciousAreas.push({ target: entry.entity_name, type: entry.entity_type, reason: "Unscanned entity near area with known issues" });
          }
        }
      }

      // 2. flow_chain shows missing parts
      for (const issue of actionableIssues) {
        const chain = (issue as any)._flow_chain;
        if (chain) {
          const missing = [!chain.has_ui && "UI", !chain.has_action && "Action", !chain.has_flow && "Flow", !chain.has_data && "Data", !chain.has_db && "DB"].filter(Boolean);
          if (missing.length > 0) {
            const target = (issue as any).component || (issue as any).route || "unknown";
            if (!suspiciousAreas.find(s => s.target === target && s.reason.includes("chain"))) {
              suspiciousAreas.push({ target, type: "flow", reason: `Broken chain: missing ${missing.join(", ")}` });
            }
          }
        }
      }

      // Rule 3 (high issues / low creation) runs after createWorkItems — see below

      const adaptiveResult = {
        ...unified,
        system_overview: systemOverview,
        system_stage: systemStage,
        high_attention_areas: highAttentionAreas,
        suspicious_areas: suspiciousAreas,
        adaptive_scan: {
          iterations: iterationsCompleted, new_issues_found: scanRun.total_new_issues || 0,
          pattern_discoveries: patternDiscoveries, high_risk_areas: highRiskAreas,
          systemic_issues: systemicIssues, coverage_score: coverageScore,
          iteration_results: scanRun.iteration_results || [],
          focus_memory: updatedFocusMemory.slice(0, 15).map((m: any) => ({ focus_key: m.focus_key, focus_type: m.focus_type, label: m.label, issue_count: m.issue_count, scan_count: m.scan_count, severity: m.severity, last_seen_at: m.last_seen_at })),
          predictions,
        },
      };

      await supabase.from("ai_scan_results").insert({
        scan_type: "full_orchestrated", results: adaptiveResult, overall_score: unified.system_health_score,
        overall_status: unified.system_health_score >= 75 ? "healthy" : unified.system_health_score >= 50 ? "warning" : "critical",
        executive_summary: `Adaptive scan (${iterationsCompleted} iter, ${systemStage}): ${unified.system_health_score}/100 | ${issuesCount} actionable issues | ${systemicIssues.length} systemic | ${coverageScore}%`,
        issues_count: issuesCount, scanned_by: scanRun.started_by,
      });

      await persistStepResults(supabase, STEPS, updatedResults, scanRun.started_by);

      // Create work items with context awareness and fingerprint dedup
      const createResult = await createWorkItems(supabase, unified, systemStage);
      let workItemsCreated = createResult.created;
      unified._create_trace = createResult.createTrace;

      // ── SUSPICIOUS AREA RULE 3: High issues but low creation (post-createWorkItems) ──
      for (const [, entry] of Object.entries(targetIssueCounts)) {
        if (entry.count >= 3) {
          const createdForArea = (createResult.createTrace || []).filter((t: any) => t._create_decision === "created" && t.affected_area?.target === entry.target).length;
          if (createdForArea === 0 && !suspiciousAreas.find(s => s.target === entry.target && s.reason.includes("issues but"))) {
            suspiciousAreas.push({ target: entry.target, type: entry.type, reason: `${entry.count} issues but 0 work items created` });
          }
        }
      }
      // Update adaptiveResult with final suspicious_areas
      adaptiveResult.suspicious_areas = suspiciousAreas;

      // Systemic issues → work items (with consistency guard)
      for (const si of systemicIssues) {
        const fp = generateFingerprint({ component: si.pattern, type: "systemic", route: "global" });

        // Check existing by fingerprint
        const { data: existingByFp } = await supabase.from("work_items").select("id, priority, created_at").eq("issue_fingerprint", fp).in("status", ["open", "claimed", "in_progress", "escalated", "new", "pending", "detected"]).limit(1);
        if (existingByFp?.length) {
          const itemAge = Date.now() - new Date(existingByFp[0].created_at).getTime();
          const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
          if (itemAge <= TWENTY_FOUR_HOURS) {
            const newPriority = si.severity === "critical" ? "critical" : "high";
            if (existingByFp[0].priority !== newPriority) {
              await supabase.from("work_items").update({ priority: newPriority, updated_at: new Date().toISOString() }).eq("id", existingByFp[0].id);
              console.log(`[consistency-guard] SYSTEMIC severity updated: ${existingByFp[0].id.slice(0, 8)}`);
            }
            continue;
          } else {
            console.log(`[consistency-guard] ALLOW systemic re-creation (>24h): "${si.label.slice(0, 40)}"`);
          }
        }

        // Check existing by title
        const searchTitle = si.label.substring(0, 40);
        const { data: existingByTitle } = await supabase.from("work_items").select("id").ilike("title", `%${searchTitle}%`).in("status", ["open", "claimed", "in_progress", "escalated", "new", "pending", "detected"]).limit(1);
        if (existingByTitle?.length) {
          await supabase.from("work_items").update({ issue_fingerprint: fp, updated_at: new Date().toISOString() }).eq("id", existingByTitle[0].id);
          continue;
        }

        // Try match runtime_trace for systemic issues
        let sysTraceId: string | null = null;
        try {
          const cutoff = new Date(Date.now() - 60_000).toISOString();
          const { data: traces } = await supabase.from("runtime_traces").select("id").gte("created_at", cutoff).order("created_at", { ascending: false }).limit(1);
          if (traces?.length) sysTraceId = traces[0].id;
        } catch (_) {}

        const { error } = await supabase.from("work_items").insert({
          title: `🔗 ${si.label}`.slice(0, 120),
          description: `${si.description}\n\nExempel: ${si.examples?.join(", ") || "N/A"}\nPåverkade: ${si.affected_components?.join(", ") || "N/A"}`,
          status: "open", priority: si.severity === "critical" ? "critical" : "high",
          item_type: "bug", source_type: "ai_scan", ai_detected: true, issue_fingerprint: fp,
          ...(sysTraceId ? { runtime_trace_id: sysTraceId } : {}),
        });
        if (!error) workItemsCreated++;
      }

      const execSummary = `${unified.system_health_score}/100 — ${issuesCount} issues (${systemStage}) — ${iterationsCompleted} iter — ${coverageScore}% — ${workItemsCreated} uppgifter`;
      await supabase.from("scan_runs").update({
        status: "done", completed_at: new Date().toISOString(), steps_results: updatedResults,
        unified_result: adaptiveResult, system_health_score: unified.system_health_score,
        executive_summary: execSummary, work_items_created: workItemsCreated,
        current_step: STEPS.length, current_step_label: `Klar ✓ (${iterationsCompleted} iter, ${systemStage})`,
      }).eq("id", scan_run_id);

      // Store scan snapshot for historical tracking
      const totalScanners = STEPS.length;
      const totalDetected = issuesCount;
      const totalFiltered = adaptiveResult?.issues?.length ?? 0;
      const totalSkipped = Math.max(0, totalDetected - workItemsCreated);
      const highAttentionCount = (adaptiveResult?.issues ?? []).filter((i: any) => i._impact_score >= 4).length;
      const deadScannersCount = Object.values(updatedResults || {}).filter((s: any) => s?._executed === false || s?.failed === true).length;
      const blindScannersCount = Object.values(updatedResults || {}).filter((s: any) => s?._executed !== false && s?.failed !== true && (s?._scan_scope?.size > 0) && (!s?.issues || s.issues.length === 0)).length;

      // Coverage metrics
      let coverageTotal = 0;
      const uniqueTargets = new Set<string>();
      for (const [_, scanner] of Object.entries(updatedResults || {})) {
        const s = scanner as any;
        if (s?._scan_scope) {
          const scopeSize = typeof s._scan_scope.size === "number" ? s._scan_scope.size : (Array.isArray(s._scan_scope.targets) ? s._scan_scope.targets.length : 0);
          coverageTotal += scopeSize;
          if (Array.isArray(s._scan_scope.targets)) {
            for (const t of s._scan_scope.targets) uniqueTargets.add(String(t));
          }
        }
      }
      const coverageUniqueTargets = uniqueTargets.size;

      // Generate rule-based diagnosis summary (max 10 lines)
      const diagLines: string[] = [];
      diagLines.push(`Health: ${unified.system_health_score}/100 — ${systemStage} — ${iterationsCompleted} iteration(s)`);
      diagLines.push(`Detected: ${totalDetected} issues → ${workItemsCreated} created, ${totalSkipped} skipped`);
      diagLines.push(`Coverage: ${coverageUniqueTargets} unique targets / ${coverageTotal} total scope`);
      if (highAttentionCount > 0) diagLines.push(`⚠️ ${highAttentionCount} high-attention issues (impact ≥ 4)`);
      const impact5 = (adaptiveResult?.issues ?? []).filter((i: any) => i._impact_score >= 5);
      if (impact5.length > 0) diagLines.push(`💥 ${impact5.length} CRITICAL (impact 5): ${impact5.slice(0, 3).map((i: any) => i.title || i.description || "unnamed").join(", ")}${impact5.length > 3 ? "…" : ""}`);
      if (deadScannersCount > 0) {
        const deadNames = Object.entries(updatedResults || {}).filter(([_, s]: any) => s?._executed === false || s?.failed === true).map(([k]) => k).slice(0, 3);
        diagLines.push(`💀 ${deadScannersCount} dead scanner(s): ${deadNames.join(", ")}${deadScannersCount > 3 ? "…" : ""}`);
      }
      if (blindScannersCount > 0) {
        const blindNames = Object.entries(updatedResults || {}).filter(([_, s]: any) => s?._executed !== false && s?.failed !== true && (s?._scan_scope?.size > 0) && (!s?.issues || s.issues.length === 0)).map(([k]) => k).slice(0, 3);
        diagLines.push(`👁️ ${blindScannersCount} blind scanner(s): ${blindNames.join(", ")}${blindScannersCount > 3 ? "…" : ""}`);
      }
      // Largest cluster
      const clusterMap: Record<string, number> = {};
      for (const issue of (adaptiveResult?.issues ?? [])) {
        const target = issue?.target || issue?.component || "unknown";
        clusterMap[target] = (clusterMap[target] || 0) + 1;
      }
      const sortedClusters = Object.entries(clusterMap).sort((a, b) => b[1] - a[1]);
      if (sortedClusters.length > 0 && sortedClusters[0][1] >= 2) {
        diagLines.push(`📦 Largest cluster: "${sortedClusters[0][0]}" with ${sortedClusters[0][1]} issues`);
      }
      if (deadScannersCount === 0 && blindScannersCount === 0 && highAttentionCount === 0) {
        diagLines.push("✅ No critical scanner or issue anomalies detected");
      }
      // Scan confidence score (0–100)
      let scanConfidenceScore = 100;
      scanConfidenceScore -= deadScannersCount * 10;
      scanConfidenceScore -= blindScannersCount * 5;
      // NO_INPUT: scanners with no scope at all
      const noInputCount = Object.values(updatedResults || {}).filter((s: any) => s?._executed !== false && s?.failed !== true && (!s?._scan_scope || s._scan_scope.size === 0) && (!Array.isArray(s?._scan_scope?.targets) || s._scan_scope.targets.length === 0)).length;
      scanConfidenceScore -= noInputCount * 5;
      // Coverage penalty
      const coveragePct = totalScanners > 0 ? Math.round((coverageUniqueTargets / Math.max(coverageTotal, 1)) * 100) : 0;
      if (coveragePct < 50) scanConfidenceScore -= 10;

      // Extended confidence modifiers
      // +10 if all required entities exist, -10 per missing
      const { data: expectations } = await supabase.from("system_expectations").select("entity_type, entity_name").eq("required", true);
      const { data: structMap } = await supabase.from("system_structure_map").select("entity_type, entity_name");
      const structKeys = new Set((structMap || []).map((s: any) => `${s.entity_type}::${s.entity_name}`));
      const missingRequired = (expectations || []).filter((e: any) => !structKeys.has(`${e.entity_type}::${e.entity_name}`));
      if (missingRequired.length === 0 && (expectations || []).length > 0) {
        scanConfidenceScore += 10;
      } else {
        scanConfidenceScore -= missingRequired.length * 10;
      }

      // -10 if regression detected (compare with previous snapshot)
      const { data: prevSnapshots } = await supabase.from("scan_snapshots").select("total_detected, dead_scanners_count, blind_scanners_count, coverage_unique_targets, payload").order("created_at", { ascending: false }).limit(1);
      if (prevSnapshots && prevSnapshots.length > 0) {
        const prev = prevSnapshots[0] as any;
        const prevDead = prev.dead_scanners_count ?? 0;
        const prevBlind = prev.blind_scanners_count ?? 0;
        if (deadScannersCount > prevDead || blindScannersCount > prevBlind || (coverageUniqueTargets < (prev.coverage_unique_targets ?? 0))) {
          scanConfidenceScore -= 10;
        }
      }

      // +5 if confirmed fixes exist
      const { count: confirmedCount } = await supabase.from("work_items").select("id", { count: "exact", head: true }).eq("status", "done").eq("verification_status", "confirmed");
      if ((confirmedCount ?? 0) > 0) {
        scanConfidenceScore += 5;
      }

      scanConfidenceScore = Math.max(0, Math.min(100, scanConfidenceScore));
      diagLines.push(`🎯 Scan confidence: ${scanConfidenceScore}%`);
      const diagnosisSummary = diagLines.slice(0, 10).join("\n");

      await supabase.from("scan_snapshots").insert({
        total_scanners: totalScanners,
        total_detected: totalDetected,
        total_filtered: totalFiltered,
        total_created: workItemsCreated,
        total_skipped: totalSkipped,
        high_attention_count: highAttentionCount,
        dead_scanners_count: deadScannersCount,
        blind_scanners_count: blindScannersCount,
        coverage_total: coverageTotal,
        coverage_unique_targets: coverageUniqueTargets,
        scan_confidence_score: scanConfidenceScore,
        diagnosis_summary: diagnosisSummary,
        payload: adaptiveResult,
      });

      // Fix verification: check done items against current scan
      const { data: doneItems } = await supabase
        .from("work_items")
        .select("id, issue_fingerprint, verification_status, verification_scans_checked")
        .eq("status", "done")
        .in("verification_status", ["unknown", "pending"])
        .not("issue_fingerprint", "is", null)
        .limit(200);

      if (doneItems && doneItems.length > 0) {
        const currentFingerprints = new Set(
          (adaptiveResult?.issues ?? []).map((i: any) => i._fingerprint || i.issue_fingerprint).filter(Boolean)
        );

        for (const item of doneItems) {
          const scansChecked = (item.verification_scans_checked ?? 0) + 1;
          const stillFound = currentFingerprints.has(item.issue_fingerprint);

          if (stillFound) {
            await supabase.from("work_items").update({
              verification_status: "failed",
              verification_scans_checked: scansChecked,
              verified_at: new Date().toISOString(),
            }).eq("id", item.id);
          } else if (scansChecked >= 2) {
            await supabase.from("work_items").update({
              verification_status: "confirmed",
              verification_scans_checked: scansChecked,
              verified_at: new Date().toISOString(),
            }).eq("id", item.id);
          } else {
            await supabase.from("work_items").update({
              verification_status: "pending",
              verification_scans_checked: scansChecked,
            }).eq("id", item.id);
          }
        }
      }

      await supabase.from("system_observability_log").insert({
        event_type: "action", severity: unified.system_health_score < 50 ? "warning" : "info",
        source: "scanner", message: `Full skanning klar: ${execSummary}`,
        details: { iterations: iterationsCompleted, health_score: unified.system_health_score, issues_count: issuesCount, work_items_created: workItemsCreated, predictions_count: predictions.length, coverage_score: coverageScore, system_stage: systemStage },
        scan_id: scan_run_id, trace_id: `full-scan-${scan_run_id.slice(0, 8)}`, component: "run-full-scan", duration_ms: totalDuration, user_id: scanRun.started_by,
      });

      return new Response(JSON.stringify({ ok: true, action: "finalized", iterations: iterationsCompleted, work_items_created: workItemsCreated, system_stage: systemStage }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── STATUS ──
    if (action === "status") {
      let query = supabase.from("scan_runs").select("*");
      if (scan_run_id) query = query.eq("id", scan_run_id);
      else query = query.order("created_at", { ascending: false }).limit(1);
      const { data } = await query.single();
      return new Response(JSON.stringify(data || null), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), { status: 400, headers: corsHeaders });
  } catch (e: any) {
    console.error("run-full-scan error:", e);
    await logRuntimeTrace("api", "run-full-scan", "/run-full-scan", e?.message || "Unknown", { stack: e?.stack?.slice(0, 500) });
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
