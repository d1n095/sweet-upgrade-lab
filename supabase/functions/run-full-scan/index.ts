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

// ── Prediction rules: map issue categories to predicted future problems + preventive fixes ──
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
        "Centralisera z-index-skalan i design tokens (t.ex. --z-modal: 50)",
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
    trigger: (ctx) => countByCategory(ctx.issues, "nav") >= 2 || countByCategory(ctx.issues, "route") >= 2,
    predict: () => ({
      problem: "Navigeringsfel och döda länkar",
      area: "Routing, breadcrumbs, sidlänkar",
      reason: "Upprepade navigeringsproblem tyder på trasiga routes",
      preventive_fixes: [
        "Skapa centraliserad route-config med typade konstanter",
        "Lägg till 404-catch för alla dynamiska routes",
        "Granska alla NavLink/Link-komponenter mot route-registret",
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
    trigger: (ctx) => ctx.systemicIssues.filter(s => s.severity === "critical").length >= 1,
    predict: () => ({
      problem: "Kaskadfel från systemiskt problem",
      area: "Hela systemet",
      reason: "Kritiska systemiska problem sprider sig ofta till relaterade komponenter",
      preventive_fixes: [
        "Isolera kritiska systemiska problem med error boundaries",
        "Implementera graceful degradation för beroende komponenter",
        "Lägg till hälsokontroller som varnar innan kaskadfel uppstår",
      ],
    }),
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
  // Flatten all issue text for keyword matching
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
        // Calculate confidence: more data = higher confidence
        const issueCount = allIssueTexts.length;
        const focusHits = focusMemory.filter(m => m.scan_count >= 2).length;
        const baseConfidence = 0.55;
        const issueBoost = Math.min(0.2, issueCount * 0.02);
        const focusBoost = Math.min(0.15, focusHits * 0.05);
        const confidence = Math.min(0.95, baseConfidence + issueBoost + focusBoost);

        // Only include high-confidence predictions (>= 0.6)
        if (confidence >= 0.6) {
          predictions.push({
            ...pred,
            confidence: Math.round(confidence * 100),
            type: "prediction",
          });
        }
      }
    } catch (_) { /* skip broken rules */ }
  }

  // Deduplicate by problem text
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

// ── DATA INTEGRITY SCAN: Real DB checks for data loss / inconsistencies ──
async function runDataIntegrityScan(supabase: any, scanRunId: string): Promise<any> {
  const issues: any[] = [];
  const traceId = `integrity-${scanRunId.slice(0, 8)}`;
  const startMs = Date.now();

  try {
    // 1. Work items created but missing source (potential failed insert follow-up)
    const { data: sourceless } = await supabase
      .from("work_items")
      .select("id, title, item_type, source_type, source_id, created_at")
      .in("status", ["open", "claimed", "in_progress", "escalated"])
      .is("source_id", null)
      .not("item_type", "in", '("manual","manual_task","general")')
      .limit(100);

    for (const wi of sourceless || []) {
      issues.push({
        type: "failed_insert",
        severity: "high",
        entity: "work_item",
        entity_id: wi.id,
        title: `Work item utan källa: "${wi.title}"`,
        description: `item_type=${wi.item_type} men source_id saknas — trolig ofullständig skapelse`,
        step: "create → database",
        root_cause: "source_id ej satt vid INSERT eller trigger misslyckades",
      });
    }

    // 2. Orphan work items — source references non-existent rows
    const { data: bugSourced } = await supabase
      .from("work_items")
      .select("id, title, source_id")
      .eq("source_type", "bug_report")
      .not("source_id", "is", null)
      .in("status", ["open", "claimed", "in_progress", "escalated"])
      .limit(200);

    for (const wi of bugSourced || []) {
      const { data: bug } = await supabase.from("bug_reports").select("id").eq("id", wi.source_id).maybeSingle();
      if (!bug) {
        issues.push({
          type: "data_loss",
          severity: "critical",
          entity: "work_item",
          entity_id: wi.id,
          title: `Orphan: "${wi.title}" → bug ${wi.source_id} finns ej`,
          description: "Work item pekar på raderad eller obefintlig bug_report",
          step: "database → fetch",
          root_cause: "Källa raderad utan att work_item uppdaterades",
        });
      }
    }

    const { data: incidentSourced } = await supabase
      .from("work_items")
      .select("id, title, source_id")
      .eq("source_type", "order_incident")
      .not("source_id", "is", null)
      .in("status", ["open", "claimed", "in_progress", "escalated"])
      .limit(200);

    for (const wi of incidentSourced || []) {
      const { data: inc } = await supabase.from("order_incidents").select("id").eq("id", wi.source_id).maybeSingle();
      if (!inc) {
        issues.push({
          type: "data_loss",
          severity: "critical",
          entity: "work_item",
          entity_id: wi.id,
          title: `Orphan: "${wi.title}" → incident ${wi.source_id} finns ej`,
          description: "Work item pekar på raderat eller obefintligt ärende",
          step: "database → fetch",
          root_cause: "Källa raderad utan att work_item uppdaterades",
        });
      }
    }

    // 3. Duplicate active work items (same source)
    const { data: activeItems } = await supabase
      .from("work_items")
      .select("id, source_type, source_id, title, created_at")
      .in("status", ["open", "claimed", "in_progress", "escalated"])
      .not("source_id", "is", null)
      .limit(500);

    const sourceMap = new Map<string, any[]>();
    for (const wi of activeItems || []) {
      const key = `${wi.source_type}:${wi.source_id}`;
      if (!sourceMap.has(key)) sourceMap.set(key, []);
      sourceMap.get(key)!.push(wi);
    }
    for (const [key, items] of sourceMap) {
      if (items.length > 1) {
        issues.push({
          type: "stale_state",
          severity: "high",
          entity: "work_item",
          entity_id: items.map((i: any) => i.id).join(", "),
          title: `${items.length} duplicerade work items för ${key}`,
          description: `IDs: ${items.map((i: any) => i.id.slice(0, 8)).join(", ")}`,
          step: "create → database",
          root_cause: "Dedup-logik missade eller race condition vid skapande",
        });
      }
    }

    // 4. Work items linked to deleted/cancelled orders still active
    const { data: orderLinked } = await supabase
      .from("work_items")
      .select("id, title, related_order_id, status")
      .not("related_order_id", "is", null)
      .in("status", ["open", "claimed", "in_progress"])
      .limit(200);

    for (const wi of orderLinked || []) {
      const { data: order } = await supabase
        .from("orders")
        .select("id, status, deleted_at")
        .eq("id", wi.related_order_id)
        .maybeSingle();

      if (!order) {
        issues.push({
          type: "data_loss",
          severity: "high",
          entity: "work_item",
          entity_id: wi.id,
          title: `"${wi.title}" → order finns ej`,
          description: "Work item kopplad till obefintlig order",
          step: "database → fetch",
          root_cause: "Order raderad helt utan cleanup av work_items",
        });
      } else if (order.deleted_at) {
        issues.push({
          type: "incorrect_filtering",
          severity: "high",
          entity: "work_item",
          entity_id: wi.id,
          title: `"${wi.title}" → order soft-deleted`,
          description: "Aktiv task kopplad till soft-deleted order",
          step: "database → UI",
          root_cause: "Cleanup-trigger/cron missade denna work_item",
        });
      } else if (["cancelled", "delivered", "completed"].includes(order.status)) {
        issues.push({
          type: "stale_state",
          severity: "medium",
          entity: "work_item",
          entity_id: wi.id,
          title: `"${wi.title}" → order redan ${order.status}`,
          description: "Aktiv task för order som redan är färdig/avbruten",
          step: "database → UI",
          root_cause: "Status-synk mellan orders och work_items bruten",
        });
      }
    }

    // 5. Status mismatch: bug resolved but work_item still open
    const { data: resolvedBugs } = await supabase
      .from("bug_reports")
      .select("id")
      .eq("status", "resolved")
      .limit(100);

    for (const bug of resolvedBugs || []) {
      const { data: activeWi } = await supabase
        .from("work_items")
        .select("id, title")
        .eq("source_type", "bug_report")
        .eq("source_id", bug.id)
        .in("status", ["open", "claimed", "in_progress", "escalated"])
        .limit(1);

      if (activeWi?.length) {
        issues.push({
          type: "stale_state",
          severity: "high",
          entity: "work_item",
          entity_id: activeWi[0].id,
          title: `"${activeWi[0].title}" aktiv trots löst bug`,
          description: `Bug ${bug.id.slice(0, 8)} markerad som resolved men work_item fortfarande aktiv`,
          step: "database → UI",
          root_cause: "Bi-direktionell statussynk misslyckades",
        });
      }
    }

    // 6. Stale claimed items (claimed >30min without progress)
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data: staleClaimed } = await supabase
      .from("work_items")
      .select("id, title, claimed_by, claimed_at")
      .eq("status", "claimed")
      .not("claimed_at", "is", null)
      .lt("claimed_at", thirtyMinAgo)
      .limit(50);

    for (const wi of staleClaimed || []) {
      issues.push({
        type: "stale_state",
        severity: "medium",
        entity: "work_item",
        entity_id: wi.id,
        title: `"${wi.title}" claimad >30min utan progress`,
        description: `Claimed ${wi.claimed_at} men aldrig flyttad till in_progress`,
        step: "UI → database",
        root_cause: "Användaren övergav uppgiften utan att frigöra den",
      });
    }

  } catch (e: any) {
    console.error("Data integrity scan error:", e);
    issues.push({
      type: "scan_error",
      severity: "critical",
      entity: "integrity_scan",
      title: `Integrity scan fel: ${e.message}`,
      step: "scan",
      root_cause: e.message,
    });
  }

  const durationMs = Date.now() - startMs;

  // Log to observability
  await supabase.from("system_observability_log").insert({
    event_type: "scan_step",
    severity: issues.filter(i => i.severity === "critical").length > 0 ? "warning" : "info",
    source: "scanner",
    message: `Data integrity scan: ${issues.length} problem hittade`,
    details: {
      total_issues: issues.length,
      by_type: {
        data_loss: issues.filter(i => i.type === "data_loss").length,
        failed_insert: issues.filter(i => i.type === "failed_insert").length,
        stale_state: issues.filter(i => i.type === "stale_state").length,
        incorrect_filtering: issues.filter(i => i.type === "incorrect_filtering").length,
      },
    },
    scan_id: scanRunId,
    trace_id: traceId,
    component: "data_integrity_scan",
    duration_ms: durationMs,
  }).catch(() => {});

  return {
    issues,
    total_issues: issues.length,
    by_type: {
      data_loss: issues.filter(i => i.type === "data_loss").length,
      failed_insert: issues.filter(i => i.type === "failed_insert").length,
      stale_state: issues.filter(i => i.type === "stale_state").length,
      incorrect_filtering: issues.filter(i => i.type === "incorrect_filtering").length,
    },
    duration_ms: durationMs,
    scanned_at: new Date().toISOString(),
  };
}

// ── FUNCTIONAL BEHAVIOR SCAN: Detect action chains that don't produce expected results ──
async function runFunctionalBehaviorScan(supabase: any, scanRunId: string): Promise<any> {
  const failures: any[] = [];
  const startMs = Date.now();
  const traceId = `behavior-${scanRunId.slice(0, 8)}`;

  try {
    // ── ACTION CHAIN 1: Create work item → save to DB → verify existence ──
    // Test: insert a probe row, verify it exists, then delete it
    const probeTitle = `__behavior_probe_${Date.now()}`;
    const { data: probeInsert, error: insertErr } = await supabase
      .from("work_items")
      .insert({
        title: probeTitle,
        status: "cancelled",
        priority: "low",
        item_type: "general",
        source_type: "behavior_scan",
        description: "Temporary probe for functional behavior scan — will be auto-deleted",
      })
      .select("id, title, status")
      .single();

    if (insertErr || !probeInsert) {
      failures.push({
        chain: "create_work_item",
        action: "INSERT work_item",
        expected: "Row created and returned with ID",
        actual: insertErr ? `Error: ${insertErr.message}` : "No data returned",
        failure_type: "action_failed",
        step: "action → backend → database",
        severity: "critical",
      });
    } else {
      // Verify fetch-back
      const { data: fetched, error: fetchErr } = await supabase
        .from("work_items")
        .select("id, title, status")
        .eq("id", probeInsert.id)
        .maybeSingle();

      if (fetchErr || !fetched) {
        failures.push({
          chain: "create_work_item",
          action: "VERIFY work_item after INSERT",
          expected: `Row ${probeInsert.id} retrievable from DB`,
          actual: fetchErr ? `Fetch error: ${fetchErr.message}` : "Row not found — lost_state",
          failure_type: "lost_state",
          step: "database → fetch",
          severity: "critical",
          entity_id: probeInsert.id,
        });
      } else if (fetched.title !== probeTitle) {
        failures.push({
          chain: "create_work_item",
          action: "COMPARE work_item title",
          expected: probeTitle,
          actual: fetched.title,
          failure_type: "silent_failure",
          step: "database → fetch → compare",
          severity: "high",
          entity_id: probeInsert.id,
        });
      }
      // Cleanup probe
      await supabase.from("work_items").delete().eq("id", probeInsert.id);
    }

    // ── ACTION CHAIN 2: Bug report → work_item trigger → verify linked task ──
    // Check: for recent bugs, does a corresponding work_item exist?
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: recentBugs } = await supabase
      .from("bug_reports")
      .select("id, description, created_at")
      .gte("created_at", fiveMinAgo)
      .order("created_at", { ascending: false })
      .limit(10);

    for (const bug of recentBugs || []) {
      const { data: linkedWi } = await supabase
        .from("work_items")
        .select("id")
        .eq("source_type", "bug_report")
        .eq("source_id", bug.id)
        .limit(1);

      if (!linkedWi?.length) {
        failures.push({
          chain: "bug_to_work_item",
          action: "Bug trigger → create work_item",
          expected: `Work item created for bug ${bug.id.slice(0, 8)}`,
          actual: "No work_item found — trigger may have failed",
          failure_type: "action_failed",
          step: "database trigger → work_items",
          severity: "high",
          entity_id: bug.id,
        });
      }
    }

    // ── ACTION CHAIN 3: Incident → work_item creation → verify linked task ──
    const { data: recentIncidents } = await supabase
      .from("order_incidents")
      .select("id, title, created_at")
      .gte("created_at", fiveMinAgo)
      .order("created_at", { ascending: false })
      .limit(10);

    for (const inc of recentIncidents || []) {
      const { data: linkedWi } = await supabase
        .from("work_items")
        .select("id")
        .eq("source_type", "order_incident")
        .eq("source_id", inc.id)
        .limit(1);

      if (!linkedWi?.length) {
        failures.push({
          chain: "incident_to_work_item",
          action: "Incident trigger → create work_item",
          expected: `Work item created for incident ${inc.id.slice(0, 8)}`,
          actual: "No work_item found — trigger may have failed",
          failure_type: "action_failed",
          step: "database trigger → work_items",
          severity: "high",
          entity_id: inc.id,
        });
      }
    }

    // ── ACTION CHAIN 4: Work item status change → source sync ──
    // Check: done work_items with source_type bug_report → is bug resolved?
    const { data: doneWiFromBugs } = await supabase
      .from("work_items")
      .select("id, title, source_id")
      .eq("status", "done")
      .eq("source_type", "bug_report")
      .not("source_id", "is", null)
      .order("completed_at", { ascending: false })
      .limit(20);

    for (const wi of doneWiFromBugs || []) {
      const { data: bug } = await supabase
        .from("bug_reports")
        .select("id, status")
        .eq("id", wi.source_id)
        .maybeSingle();

      if (bug && bug.status !== "resolved") {
        failures.push({
          chain: "status_sync",
          action: "Work item done → bug resolved",
          expected: `Bug ${wi.source_id.slice(0, 8)} status = resolved`,
          actual: `Bug status = ${bug.status}`,
          failure_type: "partial_execution",
          step: "work_item status → sync trigger → bug_reports",
          severity: "high",
          entity_id: wi.id,
        });
      }
    }

    // ── ACTION CHAIN 5: Scan dismissal → item does not reappear incorrectly ──
    const { data: dismissals } = await supabase
      .from("scan_dismissals")
      .select("issue_key, scan_type, dismissed_at")
      .order("dismissed_at", { ascending: false })
      .limit(50);

    const { data: activeWorkItems } = await supabase
      .from("work_items")
      .select("id, title, source_type")
      .in("status", ["open", "claimed", "in_progress"])
      .eq("source_type", "scan")
      .limit(200);

    for (const d of dismissals || []) {
      const reappeared = (activeWorkItems || []).find(
        (wi: any) => wi.title?.includes(d.issue_key)
      );
      if (reappeared) {
        failures.push({
          chain: "dismiss_reappear",
          action: "Dismiss issue → should not reappear",
          expected: `Issue "${d.issue_key}" stays dismissed`,
          actual: `Reappeared as work_item ${reappeared.id.slice(0, 8)}: "${reappeared.title}"`,
          failure_type: "silent_failure",
          step: "scan_dismissals → scan → work_items",
          severity: "medium",
          entity_id: reappeared.id,
        });
      }
    }

    // ── ACTION CHAIN 6: Order → payment status → work item lifecycle ──
    const { data: paidOrders } = await supabase
      .from("orders")
      .select("id, status, payment_status, fulfillment_status")
      .eq("payment_status", "paid")
      .in("fulfillment_status", ["shipped", "delivered"])
      .is("deleted_at", null)
      .limit(50);

    for (const order of paidOrders || []) {
      const { data: activeWi } = await supabase
        .from("work_items")
        .select("id, title, item_type")
        .eq("related_order_id", order.id)
        .in("status", ["open", "claimed", "in_progress"])
        .in("item_type", ["pack_order", "packing", "shipping"])
        .limit(1);

      if (activeWi?.length) {
        failures.push({
          chain: "order_lifecycle",
          action: "Order shipped/delivered → close packing tasks",
          expected: `No active packing/shipping tasks for order ${order.id.slice(0, 8)}`,
          actual: `Active task: "${activeWi[0].title}" (${activeWi[0].item_type})`,
          failure_type: "stale_state",
          step: "order status → cleanup → work_items",
          severity: "medium",
          entity_id: activeWi[0].id,
        });
      }
    }

    // ── ACTION CHAIN 7: Notification creation on incident ──
    const { data: recentNotifIncidents } = await supabase
      .from("order_incidents")
      .select("id, title, created_at")
      .gte("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString())
      .order("created_at", { ascending: false })
      .limit(10);

    for (const inc of recentNotifIncidents || []) {
      const { data: notifs } = await supabase
        .from("notifications")
        .select("id")
        .eq("related_id", inc.id)
        .eq("related_type", "incident")
        .limit(1);

      if (!notifs?.length) {
        failures.push({
          chain: "incident_notification",
          action: "Incident created → notification sent to admins",
          expected: `Notification for incident ${inc.id.slice(0, 8)}`,
          actual: "No notification found",
          failure_type: "action_failed",
          step: "incident trigger → notifications",
          severity: "medium",
          entity_id: inc.id,
        });
      }
    }

  } catch (e: any) {
    console.error("Functional behavior scan error:", e);
    failures.push({
      chain: "scan_error",
      action: "Run functional behavior scan",
      expected: "Scan completes without error",
      actual: `Error: ${e.message}`,
      failure_type: "action_failed",
      step: "scan execution",
      severity: "critical",
    });
  }

  const durationMs = Date.now() - startMs;

  // Classify
  const byType = {
    action_failed: failures.filter(f => f.failure_type === "action_failed").length,
    partial_execution: failures.filter(f => f.failure_type === "partial_execution").length,
    silent_failure: failures.filter(f => f.failure_type === "silent_failure").length,
    lost_state: failures.filter(f => f.failure_type === "lost_state").length,
    stale_state: failures.filter(f => f.failure_type === "stale_state").length,
  };

  // ── FAILURE MEMORY: Record failures and retest known patterns ──
  const retestResults: any[] = [];
  try {
    // Record new failures to memory
    for (const f of failures) {
      const patternKey = `${(f.chain || "").toLowerCase()}::${(f.action || "").toLowerCase().replace(/[^a-z0-9]/g, "_").slice(0, 60)}::${(f.step || "").toLowerCase().replace(/[^a-z0-9]/g, "_").slice(0, 60)}`;
      const { data: existing } = await supabase
        .from("functional_failure_memory")
        .select("id, occurrence_count")
        .eq("pattern_key", patternKey)
        .limit(1);

      if (existing?.length) {
        await supabase.from("functional_failure_memory").update({
          occurrence_count: (existing[0].occurrence_count || 1) + 1,
          last_seen_at: new Date().toISOString(),
          fail_reason: f.actual?.slice(0, 500),
          is_resolved: false,
          resolved_at: null,
          last_scan_retest_at: new Date().toISOString(),
          last_retest_passed: false,
        }).eq("id", existing[0].id);
      } else {
        await supabase.from("functional_failure_memory").insert({
          action_type: f.chain || f.action || "unknown",
          component: f.chain || "behavior_scan",
          entity_type: f.chain || "system",
          failed_step: f.step || "unknown",
          fail_reason: f.actual?.slice(0, 500),
          pattern_key: patternKey,
          severity: f.severity || "medium",
          occurrence_count: 1,
          last_scan_retest_at: new Date().toISOString(),
          last_retest_passed: false,
        });
      }
    }

    // Mark previously-failing patterns that passed this scan as resolved
    const { data: knownFailures } = await supabase
      .from("functional_failure_memory")
      .select("id, pattern_key, action_type, failed_step, occurrence_count")
      .eq("is_resolved", false)
      .order("occurrence_count", { ascending: false })
      .limit(100);

    const failureKeys = new Set(failures.map(f =>
      `${(f.chain || "").toLowerCase()}::${(f.action || "").toLowerCase().replace(/[^a-z0-9]/g, "_").slice(0, 60)}::${(f.step || "").toLowerCase().replace(/[^a-z0-9]/g, "_").slice(0, 60)}`
    ));

    for (const kf of knownFailures || []) {
      if (!failureKeys.has(kf.pattern_key)) {
        // This pattern was NOT found in current failures — it passed!
        await supabase.from("functional_failure_memory").update({
          last_scan_retest_at: new Date().toISOString(),
          last_retest_passed: true,
          is_resolved: true,
          resolved_at: new Date().toISOString(),
        }).eq("id", kf.id);
        retestResults.push({
          pattern_key: kf.pattern_key,
          action_type: kf.action_type,
          result: "passed",
          was_occurrence_count: kf.occurrence_count,
        });
      }
    }
  } catch (memErr: any) {
    console.warn("Failure memory recording error:", memErr.message);
  }

  // Log to observability
  await supabase.from("system_observability_log").insert({
    event_type: "scan_step",
    severity: failures.filter(f => f.severity === "critical").length > 0 ? "warning" : "info",
    source: "scanner",
    message: `Functional behavior scan: ${failures.length} failures, ${retestResults.length} retests passed`,
    details: { total_failures: failures.length, by_type: byType, retests_passed: retestResults.length },
    scan_id: scanRunId,
    trace_id: traceId,
    component: "functional_behavior_scan",
    duration_ms: durationMs,
  }).catch(() => {});

  return {
    failures,
    total_failures: failures.length,
    by_type: byType,
    retests_passed: retestResults,
    duration_ms: durationMs,
    scanned_at: new Date().toISOString(),
  };
}


// ── REAL DB SCAN: Sync Scanner — verify frontend data expectations match DB reality ──
async function runRealSyncScan(supabase: any, scanRunId: string): Promise<any> {
  const issues: any[] = [];
  const startMs = Date.now();

  try {
    // 1. Products: check for products with missing critical fields
    const { data: products } = await supabase
      .from("products")
      .select("id, title, price, status, image_url, slug, category_id")
      .limit(500);

    for (const p of products || []) {
      if (!p.title || p.title.trim() === "") {
        issues.push({ title: `Produkt utan titel (id: ${p.id?.slice(0, 8)})`, severity: "high", field: "title", component: "products" });
      }
      if (p.price == null || p.price <= 0) {
        issues.push({ title: `Produkt utan giltigt pris: "${p.title}" (${p.price})`, severity: "high", field: "price", component: "products" });
      }
      if (p.status === "active" && !p.image_url) {
        issues.push({ title: `Aktiv produkt utan bild: "${p.title}"`, severity: "medium", field: "image_url", component: "products" });
      }
      if (p.status === "active" && !p.slug) {
        issues.push({ title: `Aktiv produkt utan slug: "${p.title}"`, severity: "high", field: "slug", component: "products" });
      }
      if (p.status === "active" && !p.category_id) {
        issues.push({ title: `Aktiv produkt utan kategori: "${p.title}"`, severity: "medium", field: "category_id", component: "products" });
      }
    }

    // 2. Categories: check for categories referenced by products but missing
    const categoryIds = new Set((products || []).filter((p: any) => p.category_id).map((p: any) => p.category_id));
    if (categoryIds.size > 0) {
      const { data: categories } = await supabase.from("categories").select("id").in("id", [...categoryIds]);
      const existingCatIds = new Set((categories || []).map((c: any) => c.id));
      for (const catId of categoryIds) {
        if (!existingCatIds.has(catId)) {
          const affectedProducts = (products || []).filter((p: any) => p.category_id === catId);
          issues.push({
            title: `Kategori ${(catId as string).slice(0, 8)} finns ej men refereras av ${affectedProducts.length} produkter`,
            severity: "critical", field: "category_id", component: "categories",
          });
        }
      }
    }

    // 3. Orders: check status consistency
    const { data: orders } = await supabase
      .from("orders")
      .select("id, status, payment_status, fulfillment_status, delivery_status, shipped_at, delivered_at, packed_at")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(200);

    for (const o of orders || []) {
      if (o.fulfillment_status === "shipped" && !o.shipped_at) {
        issues.push({ title: `Order ${o.id.slice(0, 8)} status=shipped men shipped_at saknas`, severity: "high", field: "shipped_at", component: "orders" });
      }
      if (o.fulfillment_status === "delivered" && !o.delivered_at) {
        issues.push({ title: `Order ${o.id.slice(0, 8)} status=delivered men delivered_at saknas`, severity: "high", field: "delivered_at", component: "orders" });
      }
      if (o.fulfillment_status === "packed" && !o.packed_at) {
        issues.push({ title: `Order ${o.id.slice(0, 8)} status=packed men packed_at saknas`, severity: "medium", field: "packed_at", component: "orders" });
      }
      if (o.payment_status === "paid" && o.status === "cancelled") {
        issues.push({ title: `Order ${o.id.slice(0, 8)} betalad men avbruten — möjlig refund-miss`, severity: "critical", field: "status", component: "orders" });
      }
    }

    // 4. Affiliates: active with invalid/empty codes
    const { data: affiliates } = await supabase
      .from("affiliates")
      .select("id, name, code, is_active, email")
      .eq("is_active", true)
      .limit(100);

    for (const a of affiliates || []) {
      if (!a.code || a.code.trim() === "") {
        issues.push({ title: `Aktiv affiliate utan kod: "${a.name}"`, severity: "high", field: "code", component: "affiliates" });
      }
      if (!a.email || a.email.trim() === "") {
        issues.push({ title: `Aktiv affiliate utan e-post: "${a.name}"`, severity: "medium", field: "email", component: "affiliates" });
      }
    }

    // 5. Duplicate affiliate/influencer codes
    const { data: allCodes } = await supabase.from("affiliates").select("code").eq("is_active", true);
    const { data: influencerCodes } = await supabase.from("influencers").select("code").eq("is_active", true);
    const codeMap = new Map<string, number>();
    for (const a of [...(allCodes || []), ...(influencerCodes || [])]) {
      const c = (a.code || "").toLowerCase();
      if (c) codeMap.set(c, (codeMap.get(c) || 0) + 1);
    }
    for (const [code, count] of codeMap) {
      if (count > 1) {
        issues.push({ title: `Duplikat rabattkod: "${code}" (${count} st)`, severity: "critical", field: "code", component: "affiliates/influencers" });
      }
    }

    // 6. Reviews: check for reviews referencing non-existent products
    const { data: reviews } = await supabase
      .from("reviews")
      .select("id, product_id, shopify_product_id")
      .limit(200);

    const reviewProductIds = new Set((reviews || []).filter((r: any) => r.product_id).map((r: any) => r.product_id));
    if (reviewProductIds.size > 0) {
      const { data: existingProducts } = await supabase.from("products").select("id").in("id", [...reviewProductIds]);
      const existingProdIds = new Set((existingProducts || []).map((p: any) => p.id));
      for (const pid of reviewProductIds) {
        if (!existingProdIds.has(pid)) {
          issues.push({ title: `Recension refererar borttagen produkt ${(pid as string).slice(0, 8)}`, severity: "medium", field: "product_id", component: "reviews" });
        }
      }
    }

  } catch (e: any) {
    issues.push({ title: `Sync scan error: ${e.message}`, severity: "critical", component: "sync_scan" });
  }

  const durationMs = Date.now() - startMs;
  const score = Math.max(0, 100 - issues.length * 5);

  return {
    issues,
    mismatches: issues,
    total_issues: issues.length,
    sync_score: score,
    overall_score: score,
    issues_found: issues.length,
    duration_ms: durationMs,
    scanned_at: new Date().toISOString(),
    real_db_scan: true,
  };
}

// ── REAL DB SCAN: System scan — check for regressions and system health ──
async function runRealSystemScan(supabase: any, scanRunId: string): Promise<any> {
  const issues: any[] = [];
  const metrics: Record<string, number> = {};
  const startMs = Date.now();

  try {
    // Count key entities
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

    // Active work items by status
    for (const status of ["open", "claimed", "in_progress", "escalated", "done"]) {
      const { count } = await supabase.from("work_items").select("*", { count: "exact", head: true }).eq("status", status);
      metrics[`work_items_${status}`] = count || 0;
    }

    // Orders by recent activity
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: recentOrders } = await supabase.from("orders").select("*", { count: "exact", head: true }).gte("created_at", oneDayAgo).is("deleted_at", null);
    metrics.orders_last_24h = recentOrders || 0;

    const { count: recentErrors } = await supabase.from("activity_logs").select("*", { count: "exact", head: true }).eq("log_type", "error").gte("created_at", oneDayAgo);
    metrics.errors_last_24h = recentErrors || 0;

    // Check for issues
    if (metrics.open_bugs > 20) {
      issues.push({ title: `${metrics.open_bugs} öppna buggar — hög bugg-skuld`, severity: "high", component: "bug_reports" });
    }
    if (metrics.work_items_escalated > 5) {
      issues.push({ title: `${metrics.work_items_escalated} eskalerade ärenden`, severity: "critical", component: "work_items" });
    }
    if (metrics.errors_last_24h > 50) {
      issues.push({ title: `${metrics.errors_last_24h} fel senaste 24h — systeminstabilitet`, severity: "high", component: "activity_logs" });
    }
    if (metrics.unread_notifications > 100) {
      issues.push({ title: `${metrics.unread_notifications} olästa notiser — trolig notis-spam`, severity: "medium", component: "notifications" });
    }

    // Check for stale escalated items (>24h without update)
    const { data: staleEscalated } = await supabase
      .from("work_items")
      .select("id, title, updated_at")
      .eq("status", "escalated")
      .lt("updated_at", oneDayAgo)
      .limit(20);

    for (const wi of staleEscalated || []) {
      issues.push({ title: `Eskalerat ärende >24h utan uppdatering: "${wi.title}"`, severity: "high", component: "work_items", entity_id: wi.id });
    }

    // Check for recent scan results — compare health scores
    const { data: recentScans } = await supabase
      .from("ai_scan_results")
      .select("overall_score, created_at, scan_type")
      .eq("scan_type", "full_orchestrated")
      .order("created_at", { ascending: false })
      .limit(3);

    if (recentScans?.length >= 2) {
      const current = recentScans[0].overall_score || 0;
      const previous = recentScans[1].overall_score || 0;
      if (current < previous - 10) {
        issues.push({ title: `Systempoäng sjunkit: ${previous} → ${current} (-${previous - current})`, severity: "high", component: "system_health" });
      }
      metrics.previous_score = previous;
      metrics.score_delta = current - previous;
    }

  } catch (e: any) {
    issues.push({ title: `System scan error: ${e.message}`, severity: "critical", component: "system_scan" });
  }

  const durationMs = Date.now() - startMs;
  const score = Math.max(0, 100 - issues.length * 8);

  return {
    issues,
    issues_found: issues.length,
    metrics,
    system_score: score,
    overall_score: score,
    duration_ms: durationMs,
    scanned_at: new Date().toISOString(),
    real_db_scan: true,
  };
}

// ── REAL DB SCAN: Feature Detection — verify key CRUD operations work ──
async function runRealFeatureDetection(supabase: any, scanRunId: string): Promise<any> {
  const features: any[] = [];
  const startMs = Date.now();

  // Test actual table read access for key features
  const featureTests = [
    { name: "Produkter (läs)", table: "products", query: "id, title, status", classification: "real" },
    { name: "Ordrar (läs)", table: "orders", query: "id, status, created_at", classification: "real" },
    { name: "Kategorier (läs)", table: "categories", query: "id, name_sv, slug", classification: "real" },
    { name: "Recensioner (läs)", table: "reviews", query: "id, rating, product_id", classification: "real" },
    { name: "Affiliates (läs)", table: "affiliates", query: "id, name, code", classification: "real" },
    { name: "Influencers (läs)", table: "influencers", query: "id, name, code", classification: "real" },
    { name: "Bugrapporter (läs)", table: "bug_reports", query: "id, description, status", classification: "real" },
    { name: "Work Items (läs)", table: "work_items", query: "id, title, status", classification: "real" },
    { name: "Donationer (läs)", table: "donations", query: "id, amount, source", classification: "real" },
    { name: "Donationsprojekt (läs)", table: "donation_projects", query: "id, name, is_active", classification: "real" },
    { name: "E-postmallar (läs)", table: "email_templates", query: "id, template_type, is_active", classification: "real" },
    { name: "Kampanjer (bundles)", table: "bundles", query: "id, name, is_active", classification: "real" },
    { name: "Aktivitetsloggar", table: "activity_logs", query: "id, log_type, message", classification: "real" },
    { name: "Notiser", table: "notifications", query: "id, type, read", classification: "real" },
  ];

  for (const ft of featureTests) {
    try {
      const { data, error, count } = await supabase.from(ft.table).select(ft.query, { count: "exact" }).limit(1);
      if (error) {
        features.push({ name: ft.name, status: "broken", classification: "broken", reason: error.message, component: ft.table });
      } else {
        features.push({ name: ft.name, status: "working", classification: "real", row_count: count || 0, component: ft.table });
      }
    } catch (e: any) {
      features.push({ name: ft.name, status: "error", classification: "broken", reason: e.message, component: ft.table });
    }
  }

  // Test write capability with probe
  try {
    const probeId = `__feature_probe_${Date.now()}`;
    const { data: inserted, error: insertErr } = await supabase
      .from("activity_logs")
      .insert({ message: probeId, log_type: "probe", category: "feature_detection" })
      .select("id")
      .single();

    if (insertErr) {
      features.push({ name: "Skrivåtkomst (activity_logs)", status: "broken", classification: "broken", reason: insertErr.message });
    } else {
      // Verify and cleanup
      const { data: fetched } = await supabase.from("activity_logs").select("id").eq("id", inserted.id).maybeSingle();
      if (fetched) {
        features.push({ name: "Skrivåtkomst (activity_logs)", status: "working", classification: "real" });
        await supabase.from("activity_logs").delete().eq("id", inserted.id);
      } else {
        features.push({ name: "Skrivåtkomst (activity_logs)", status: "broken", classification: "broken", reason: "INSERT ok men SELECT returnerade inget" });
      }
    }
  } catch (e: any) {
    features.push({ name: "Skrivåtkomst (activity_logs)", status: "error", classification: "broken", reason: e.message });
  }

  const durationMs = Date.now() - startMs;
  const working = features.filter(f => f.status === "working").length;
  const broken = features.filter(f => f.status !== "working").length;
  const score = Math.round((working / Math.max(1, features.length)) * 100);

  return {
    features,
    working_count: working,
    broken_count: broken,
    total_features: features.length,
    overall_score: score,
    score,
    issues_found: broken,
    duration_ms: durationMs,
    scanned_at: new Date().toISOString(),
    real_db_scan: true,
  };
}

// ── REAL DB SCAN: Interaction QA — check for dead references and broken links in data ──
async function runRealInteractionQA(supabase: any, scanRunId: string): Promise<any> {
  const issues: any[] = [];
  const startMs = Date.now();

  try {
    // 1. Bundles referencing non-existent products
    const { data: bundleItems } = await supabase.from("bundle_items").select("id, bundle_id, shopify_product_id").limit(200);
    const { data: bundles } = await supabase.from("bundles").select("id, name, is_active").eq("is_active", true).limit(50);
    const activeBundleIds = new Set((bundles || []).map((b: any) => b.id));

    for (const bi of bundleItems || []) {
      if (!activeBundleIds.has(bi.bundle_id)) {
        // Check if bundle exists at all
        const { data: b } = await supabase.from("bundles").select("id").eq("id", bi.bundle_id).maybeSingle();
        if (!b) {
          issues.push({ title: `Bundle item refererar borttaget bundle ${bi.bundle_id.slice(0, 8)}`, severity: "high", component: "bundles", element: "bundle_items" });
        }
      }
    }

    // 2. Notifications without valid user_id (orphan notifs)
    const { data: recentNotifs } = await supabase
      .from("notifications")
      .select("id, user_id, type, created_at")
      .order("created_at", { ascending: false })
      .limit(50);

    const userIds = new Set((recentNotifs || []).map((n: any) => n.user_id).filter(Boolean));
    if (userIds.size > 0) {
      const { data: profiles } = await supabase.from("profiles").select("id").in("id", [...userIds]);
      const existingUserIds = new Set((profiles || []).map((p: any) => p.id));
      for (const n of recentNotifs || []) {
        if (n.user_id && !existingUserIds.has(n.user_id)) {
          issues.push({ title: `Notis för borttagen användare ${n.user_id.slice(0, 8)}`, severity: "medium", component: "notifications", entity_id: n.id });
        }
      }
    }

    // 3. Incidents without valid orders
    const { data: incidents } = await supabase
      .from("order_incidents")
      .select("id, title, order_id, status")
      .in("status", ["open", "investigating", "in_progress"])
      .limit(50);

    for (const inc of incidents || []) {
      const { data: order } = await supabase.from("orders").select("id").eq("id", inc.order_id).maybeSingle();
      if (!order) {
        issues.push({ title: `Ärende "${inc.title}" → order finns ej`, severity: "high", component: "order_incidents", entity_id: inc.id });
      }
    }

    // 4. Automation rules: check for active rules with invalid config
    const { data: rules } = await supabase.from("automation_rules").select("id, rule_key, config, is_active").eq("is_active", true).limit(50);
    for (const r of rules || []) {
      if (!r.config || (typeof r.config === "object" && Object.keys(r.config).length === 0)) {
        issues.push({ title: `Aktiv automationsregel utan config: "${r.rule_key}"`, severity: "medium", component: "automation_rules", entity_id: r.id });
      }
    }

    // 5. Email templates: check active templates have required fields
    const { data: templates } = await supabase.from("email_templates").select("*").eq("is_active", true).limit(20);
    for (const t of templates || []) {
      if (!t.subject_sv || !t.intro_sv) {
        issues.push({ title: `E-postmall "${t.template_type}" saknar ämne/intro (SV)`, severity: "high", component: "email_templates", entity_id: t.id });
      }
    }

  } catch (e: any) {
    issues.push({ title: `Interaction QA error: ${e.message}`, severity: "critical", component: "interaction_qa" });
  }

  const durationMs = Date.now() - startMs;
  const score = Math.max(0, 100 - issues.length * 6);

  return {
    issues,
    issues_found: issues.length,
    dead_elements: issues,
    interaction_score: score,
    overall_score: score,
    duration_ms: durationMs,
    scanned_at: new Date().toISOString(),
    real_db_scan: true,
  };
}

// ── Map scan types to real DB functions ──
const REAL_DB_SCANNERS: Record<string, (supabase: any, scanRunId: string) => Promise<any>> = {
  data_integrity: runDataIntegrityScan,
  sync_scan: runRealSyncScan,
  system_scan: runRealSystemScan,
  feature_detection: runRealFeatureDetection,
  interaction_qa: runRealInteractionQA,
};


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

    // Create-Verify Loop: INSERT → FETCH → COMPARE
    const insertPayload = {
      title: issue.title,
      description: issue.description || "Auto-generated from adaptive recursive scan",
      status: "open",
      priority: issue.priority,
      item_type: issue.item_type,
      source_type: "ai_scan",
      ai_detected: true,
    };

    let verified = false;
    for (let attempt = 1; attempt <= 2; attempt++) {
      const { data: created, error } = await supabase
        .from("work_items")
        .insert(insertPayload)
        .select("id, title, status")
        .single();

      if (error) {
        console.error(`[create-verify] INSERT failed (attempt ${attempt}):`, error.message);
        await supabase.from("system_observability_log").insert({
          event_type: "error",
          severity: "error",
          source: "scanner",
          message: `Create-verify INSERT failed: ${issue.title.slice(0, 60)}`,
          details: { error: error.message, attempt, title: issue.title },
          component: "createWorkItems",
          error_code: "CREATE_VERIFY_INSERT_FAIL",
        }).catch(() => {});
        continue;
      }

      // Verify: fetch back
      const { data: fetched } = await supabase
        .from("work_items")
        .select("id")
        .eq("id", created.id)
        .maybeSingle();

      if (!fetched) {
        console.error(`[create-verify] VERIFY failed — id=${created.id} not found (attempt ${attempt})`);
        await supabase.from("system_observability_log").insert({
          event_type: "error",
          severity: "critical",
          source: "scanner",
          message: `Create-verify MISMATCH: work_item id=${created.id} inserted but not found`,
          details: { id: created.id, attempt, title: issue.title },
          component: "createWorkItems",
          error_code: "CREATE_VERIFY_MISMATCH",
        }).catch(() => {});
        continue;
      }

      console.log(`[create-verify] ✅ VERIFIED: ${created.id} "${issue.title.slice(0, 40)}"`);
      workItemsCreated++;
      verified = true;
      break;
    }

    if (!verified) {
      console.error(`[create-verify] ❌ FAILED after retries: "${issue.title.slice(0, 60)}"`);
    }
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

      // Load focus memory to prioritize scan steps
      const focusMemory = await loadFocusMemory(supabase);
      const prioritizedSteps = prioritizeSteps(STEPS, focusMemory);

      // Create scan run
      const { data: scanRun, error: insertError } = await supabase.from("scan_runs").insert({
        status: "running",
        started_by: userId,
        current_step: 0,
        total_steps: prioritizedSteps.length,
        current_step_label: prioritizedSteps[0].label,
        steps_results: {},
        iteration: 1,
        max_iterations: MAX_ITERATIONS,
        iteration_results: [],
        pattern_discoveries: [],
        high_risk_areas: focusMemory.slice(0, 10).map((m: any) => ({ component: m.label, issue_count: m.issue_count, risk_level: m.severity, source: "focus_memory" })),
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

      // Observability: log each scan step
      await supabase.from("system_observability_log").insert({
        event_type: "scan_step",
        severity: stepResult.failed ? "error" : "info",
        source: "scanner",
        message: stepResult.failed ? `Steg misslyckades: ${step.label}` : `Steg klart: ${step.label}`,
        details: { step_id: step.id, iteration: currentIteration, failed: !!stepResult.failed },
        scan_id: scan_run_id,
        trace_id: `full-scan-${scan_run_id.slice(0, 8)}`,
        component: step.scanType,
        duration_ms,
        error_code: stepResult.failed ? stepResult.error?.slice(0, 100) : undefined,
      }).catch(() => {});

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
        current_step_label: "Kör dataintegritetskontroll...",
      }).eq("id", scan_run_id);

      // ── Run Data Integrity Scan ──
      const integrityResult = await runDataIntegrityScan(supabase, scan_run_id);

      await supabase.from("scan_runs").update({
        current_step_label: "Kör funktionell beteendeskanning...",
      }).eq("id", scan_run_id);

      // ── Run Functional Behavior Scan ──
      const behaviorResult = await runFunctionalBehaviorScan(supabase, scan_run_id);

      await supabase.from("scan_runs").update({
        current_step_label: "Sammanställer resultat...",
      }).eq("id", scan_run_id);

      const updatedResults = scanRun.steps_results || {};
      updatedResults._data_integrity = integrityResult;
      updatedResults._functional_behavior = behaviorResult;

      const totalDuration = Object.values(updatedResults).reduce(
        (sum: number, r: any) => sum + (r?._duration_ms || 0), 0
      );
      const unified = buildUnifiedResult(updatedResults, totalDuration);

      // Merge integrity issues into unified data_issues
      for (const issue of integrityResult.issues || []) {
        unified.data_issues.push({
          title: issue.title,
          description: issue.description,
          severity: issue.severity,
          type: issue.type,
          entity: issue.entity,
          entity_id: issue.entity_id,
          step: issue.step,
          root_cause: issue.root_cause,
          source: "integrity_scan",
        });
      }
      // Add integrity_issues as dedicated field
      unified.integrity_issues = integrityResult.issues || [];
      unified.integrity_summary = integrityResult.by_type || {};
      // Add behavior failures as dedicated field
      unified.behavior_failures = behaviorResult.failures || [];
      unified.behavior_summary = behaviorResult.by_type || {};

      // Merge critical/high behavior failures into interaction_failures for scoring
      for (const f of behaviorResult.failures || []) {
        if (f.severity === "critical" || f.severity === "high") {
          unified.interaction_failures.push({
            title: `[Behavior] ${f.chain}: ${f.action}`,
            description: `Expected: ${f.expected}\nActual: ${f.actual}`,
            severity: f.severity,
            type: f.failure_type,
            step: f.step,
            source: "behavior_scan",
          });
        }
      }

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

      // Save focus memory for future scans
      await saveFocusMemory(supabase, unified, highRiskAreas, patternDiscoveries);

      // Load updated focus memory to include in result
      const updatedFocusMemory = await loadFocusMemory(supabase);

      // ── Predictive Issue Detection ──
      const predictions = generatePredictions(unified, patternDiscoveries, systemicIssues, updatedFocusMemory, finalRootCause || []);

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
          focus_memory: updatedFocusMemory.slice(0, 15).map((m: any) => ({
            focus_key: m.focus_key,
            focus_type: m.focus_type,
            label: m.label,
            issue_count: m.issue_count,
            scan_count: m.scan_count,
            severity: m.severity,
            last_seen_at: m.last_seen_at,
          })),
          predictions,
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

      // Observability: log full scan completion
      await supabase.from("system_observability_log").insert({
        event_type: "action",
        severity: unified.system_health_score < 50 ? "warning" : "info",
        source: "scanner",
        message: `Full skanning klar: ${execSummary}`,
        details: {
          iterations: iterationsCompleted,
          health_score: unified.system_health_score,
          issues_count: issuesCount,
          work_items_created: workItemsCreated,
          predictions_count: predictions.length,
          coverage_score: coverageScore,
        },
        scan_id: scan_run_id,
        trace_id: `full-scan-${scan_run_id.slice(0, 8)}`,
        component: "run-full-scan",
        duration_ms: totalDuration,
        user_id: scanRun.started_by,
      });

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
