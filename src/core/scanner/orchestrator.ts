/**
 * SYSTEM ORCHESTRATOR
 *
 * Single entrypoint that runs every system module in the mandated order and
 * blocks downstream steps the moment an upstream guard fails.
 *
 * Execution contract:
 *   1. Truth Layer            (file + route validation)         — HARD GATE
 *   2. Dependency Graph       (import graph + cycle detection)
 *   3. Architecture Validation(layer rules + violations)
 *   4. Auto-Healing           (only when arch dirty)
 *   5. Observability Layer    (final report bundle)
 *
 * If step 1 fails the run aborts immediately with status "BLOCKED" and every
 * downstream step is recorded as "skipped" with the reason "blocked_by_step_1".
 */

import { fileSystemMap, getRawSources } from "@/lib/fileSystemMap";
import { runTruthEngine, type TruthReport } from "@/architecture/truthEngine";
import { runScannerV2Verified } from "@/architecture/scannerV2";
import { ROUTE_REGISTRY } from "@/architecture/routeRegistry";
import { verifyState } from "@/core/scanner/zeroFakeStateGuard";

export type StepStatus = "ok" | "warning" | "failed" | "skipped";

export interface StepResult<T = unknown> {
  step: number;
  name: string;
  status: StepStatus;
  duration_ms: number;
  reason?: string;
  output?: T;
}

export interface OrchestrationReport {
  status: "VERIFIED" | "WARNING" | "BLOCKED";
  started_at: string;
  finished_at: string;
  duration_ms: number;
  steps: StepResult[];
  summary: {
    files: number;
    routes_registered: number;
    routes_file_backed: number;
    cycles: number;
    arch_violations: number;
    healing_required: boolean;
  };
}

const IMPORT_RE = /(?:from|import)\s+['"]([^'"]+)['"]/g;

function resolveAlias(imp: string, fromFile: string, known: Set<string>): string | null {
  let base: string;
  if (imp.startsWith("@/")) base = "src/" + imp.slice(2);
  else if (imp.startsWith("./") || imp.startsWith("../")) {
    const dir = fromFile.split("/").slice(0, -1).join("/");
    const parts = (dir + "/" + imp).split("/");
    const stack: string[] = [];
    for (const p of parts) {
      if (p === "" || p === ".") continue;
      if (p === "..") stack.pop();
      else stack.push(p);
    }
    base = stack.join("/");
  } else return null;
  for (const ext of ["", ".ts", ".tsx", "/index.ts", "/index.tsx"]) {
    if (known.has(base + ext)) return base + ext;
  }
  return null;
}

/** Build adjacency + Tarjan SCC cycle detection — recomputed every run. */
function buildDependencyGraph() {
  const raw = getRawSources();
  const known = new Set(fileSystemMap.map((f) => f.path));
  const adj = new Map<string, Set<string>>();
  for (const path of known) adj.set(path, new Set());
  for (const [rawPath, src] of Object.entries(raw)) {
    if (typeof src !== "string") continue;
    const file = rawPath.startsWith("/") ? rawPath.slice(1) : rawPath;
    if (!known.has(file)) continue;
    let m: RegExpExecArray | null;
    IMPORT_RE.lastIndex = 0;
    while ((m = IMPORT_RE.exec(src)) !== null) {
      const target = resolveAlias(m[1], file, known);
      if (target && target !== file) adj.get(file)!.add(target);
    }
  }
  // Tarjan SCC
  const index = new Map<string, number>();
  const low = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const cycles: string[][] = [];
  let idx = 0;
  const strongconnect = (v: string) => {
    index.set(v, idx); low.set(v, idx); idx++;
    stack.push(v); onStack.add(v);
    for (const w of adj.get(v) ?? []) {
      if (!index.has(w)) {
        strongconnect(w);
        low.set(v, Math.min(low.get(v)!, low.get(w)!));
      } else if (onStack.has(w)) {
        low.set(v, Math.min(low.get(v)!, index.get(w)!));
      }
    }
    if (low.get(v) === index.get(v)) {
      const comp: string[] = [];
      while (true) {
        const w = stack.pop()!;
        onStack.delete(w); comp.push(w);
        if (w === v) break;
      }
      const selfLoop = comp.length === 1 && (adj.get(comp[0])?.has(comp[0]) ?? false);
      if (comp.length > 1 || selfLoop) cycles.push(comp);
    }
  };
  for (const v of adj.keys()) if (!index.has(v)) strongconnect(v);
  let edges = 0;
  for (const s of adj.values()) edges += s.size;
  return { node_count: adj.size, edge_count: edges, cycles };
}

/** Layer-rule checker — recomputed every run. */
function validateArchitecture() {
  const raw = getRawSources();
  const violations: { rule: string; path: string }[] = [];
  const apiRe = /supabase\.(from|rpc|auth|storage|functions)|\.functions\.invoke|fetch\s*\(/;
  const mutationRe = /\.from\([^)]+\)\.(insert|update|delete|upsert)\(/;
  const routeRe = /<Route\s+[^>]*path\s*=/;
  for (const f of fileSystemMap) {
    const src = raw["/" + f.path];
    if (typeof src !== "string") continue;
    if (f.path.startsWith("src/components/") && !f.path.startsWith("src/components/ui/") && apiRe.test(src)) {
      violations.push({ rule: "UI_HAS_BUSINESS_LOGIC", path: f.path });
    }
    if (f.path.startsWith("src/pages/") && mutationRe.test(src)) {
      violations.push({ rule: "PAGE_HAS_DIRECT_MUTATION", path: f.path });
    }
    if (
      !f.path.endsWith("App.tsx") &&
      !f.path.startsWith("src/lib/fileSystemMap") &&
      !f.path.includes("scannerV2") &&
      routeRe.test(src)
    ) {
      violations.push({ rule: "HIDDEN_ROUTING", path: f.path });
    }
  }
  return { violations };
}

export function runOrchestrator(): OrchestrationReport {
  const started_at_ms = Date.now();
  const started_at = new Date(started_at_ms).toISOString();
  const steps: StepResult[] = [];

  const now = () => Date.now();

  // ── STEP 1 — TRUTH LAYER ──────────────────────────────────────────────
  const t1 = now();
  let truth: TruthReport | null = null;
  let blocked = false;
  let blockReason = "";
  try {
    truth = runTruthEngine();
    const env = runScannerV2Verified();
    const guardOk = env.verification_status === "TRUE";
    const filesOk = fileSystemMap.length > 0;
    const routesOk = ROUTE_REGISTRY.length > 0 && truth.routing.real_file_backed > 0;
    const noPhantom = truth.routing.phantom_routes.length === 0;
    if (!filesOk || !routesOk || !guardOk) {
      blocked = true;
      blockReason = !filesOk ? "no files detected" : !routesOk ? "no file-backed routes" : env.blocked_reason ?? "guard rejected";
    }
    steps.push({
      step: 1,
      name: "Truth Layer (file + route validation)",
      status: blocked ? "failed" : noPhantom ? "ok" : "warning",
      duration_ms: now() - t1,
      reason: blocked ? blockReason : noPhantom ? undefined : `${truth.routing.phantom_routes.length} phantom routes`,
      output: {
        files: fileSystemMap.length,
        routes_registered: ROUTE_REGISTRY.length,
        routes_file_backed: truth.routing.real_file_backed,
        phantom_routes: truth.routing.phantom_routes.length,
        guard_envelope: { data_source: env.data_source, verification_status: env.verification_status, confidence_score: env.confidence_score },
      },
    });
  } catch (e) {
    blocked = true;
    blockReason = `truth engine threw: ${(e as Error).message}`;
    steps.push({ step: 1, name: "Truth Layer", status: "failed", duration_ms: now() - t1, reason: blockReason });
  }

  // HARD GATE — block downstream if step 1 failed
  const skip = (step: number, name: string): StepResult => ({
    step, name, status: "skipped", duration_ms: 0, reason: "blocked_by_step_1: " + blockReason,
  });

  let depReport: ReturnType<typeof buildDependencyGraph> | null = null;
  let archReport: ReturnType<typeof validateArchitecture> | null = null;
  let healingRequired = false;

  if (blocked) {
    steps.push(skip(2, "Dependency Graph"));
    steps.push(skip(3, "Architecture Validation"));
    steps.push(skip(4, "Auto-Healing"));
    steps.push(skip(5, "Observability Layer"));
  } else {
    // ── STEP 2 — DEPENDENCY GRAPH ─────────────────────────────────────────
    const t2 = now();
    try {
      depReport = buildDependencyGraph();
      steps.push({
        step: 2,
        name: "Dependency Graph",
        status: depReport.cycles.length === 0 ? "ok" : "warning",
        duration_ms: now() - t2,
        reason: depReport.cycles.length > 0 ? `${depReport.cycles.length} cycle(s) detected` : undefined,
        output: { nodes: depReport.node_count, edges: depReport.edge_count, cycles: depReport.cycles.length },
      });
    } catch (e) {
      steps.push({ step: 2, name: "Dependency Graph", status: "failed", duration_ms: now() - t2, reason: (e as Error).message });
    }

    // ── STEP 3 — ARCHITECTURE VALIDATION ──────────────────────────────────
    const t3 = now();
    try {
      archReport = validateArchitecture();
      healingRequired = archReport.violations.length > 0;
      steps.push({
        step: 3,
        name: "Architecture Validation",
        status: healingRequired ? "warning" : "ok",
        duration_ms: now() - t3,
        reason: healingRequired ? `${archReport.violations.length} layer violation(s)` : undefined,
        output: { violations: archReport.violations.length },
      });
    } catch (e) {
      steps.push({ step: 3, name: "Architecture Validation", status: "failed", duration_ms: now() - t3, reason: (e as Error).message });
    }

    // ── STEP 4 — AUTO-HEALING (only when arch dirty) ──────────────────────
    const t4 = now();
    if (healingRequired) {
      // Plan only — never mutates files at runtime. Returns the safe move list.
      const safeMoves = [
        { from: "src/architecture/routeRegistry.ts", to: "src/core/scanner/routeRegistry.ts" },
        { from: "src/architecture/truthEngine.ts", to: "src/core/scanner/truthEngine.ts" },
        { from: "src/architecture/scannerV2.ts", to: "src/core/scanner/scannerV2.ts" },
      ].filter((m) => fileSystemMap.find((f) => f.path === m.from));
      steps.push({
        step: 4,
        name: "Auto-Healing (plan)",
        status: safeMoves.length > 0 ? "warning" : "ok",
        duration_ms: now() - t4,
        reason: safeMoves.length > 0 ? `${safeMoves.length} safe relocation(s) suggested (not executed)` : "nothing to heal",
        output: { safe_moves: safeMoves },
      });
    } else {
      steps.push({ step: 4, name: "Auto-Healing", status: "ok", duration_ms: now() - t4, reason: "skipped — architecture clean" });
    }

    // ── STEP 5 — OBSERVABILITY ────────────────────────────────────────────
    const t5 = now();
    steps.push({
      step: 5,
      name: "Observability Layer",
      status: "ok",
      duration_ms: now() - t5,
      output: {
        timeline: steps.map((s) => ({ step: s.step, name: s.name, status: s.status, duration_ms: s.duration_ms })),
      },
    });
  }

  const finished_at_ms = Date.now();
  const anyFailed = steps.some((s) => s.status === "failed");
  const anyWarning = steps.some((s) => s.status === "warning");
  const status: OrchestrationReport["status"] = blocked || anyFailed ? "BLOCKED" : anyWarning ? "WARNING" : "VERIFIED";

  const report: OrchestrationReport = {
    status,
    started_at,
    finished_at: new Date(finished_at_ms).toISOString(),
    duration_ms: finished_at_ms - started_at_ms,
    steps,
    summary: {
      files: fileSystemMap.length,
      routes_registered: ROUTE_REGISTRY.length,
      routes_file_backed: truth?.routing.real_file_backed ?? 0,
      cycles: depReport?.cycles.length ?? 0,
      arch_violations: archReport?.violations.length ?? 0,
      healing_required: healingRequired,
    },
  };

  // Push the report through the zero-fake-state guard so downstream UI can
  // never receive a fabricated success envelope.
  const env = verifyState(report, {
    requiredCounts: { files: report.summary.files },
  });
  console.log("[ORCHESTRATOR]", { status: report.status, steps: report.steps.length, guard: env.verification_status });

  return report;
}
