/**
 * ARCHITECTURE SCORING — deterministic.
 *
 * GOAL: Score system on a 0–100 scale using ONLY measurable inputs.
 *
 * FORMULA:
 *   score = 100
 *     - (orphan_files          * 1)
 *     - (duplicates            * 2)
 *     - (circular_dependencies * 5)
 *     - (cross_layer_violations* 3)
 *     - (unmounted_routes      * 2)
 *     - (high_coupling_nodes   * 1)
 *
 * Score is clamped to [0, 100]. NO subjective scoring, NO interpretation —
 * every input comes from another deterministic engine:
 *   - dependencyHeatmap          → orphans, cycles, high-coupling
 *   - architectureEnforcementCore→ cross-layer violations (rules A1–A4)
 *   - fileSystemMap.getDuplicatedLines → duplicates
 *   - ROUTE_REGISTRY vs fileSystemMap → unmounted routes
 */
import { runDependencyHeatmap } from "@/core/architecture/dependencyHeatmap";
import { runArchitectureEnforcement } from "@/core/architecture/architectureEnforcementCore";
import { fileSystemMap, getDuplicatedLines } from "@/lib/fileSystemMap";
import { ROUTE_REGISTRY } from "@/architecture/routeRegistry";

export interface ScoreFactor {
  readonly key:
    | "orphan_files"
    | "duplicates"
    | "circular_dependencies"
    | "cross_layer_violations"
    | "unmounted_routes"
    | "high_coupling_nodes";
  readonly count: number;
  readonly weight: number;
  readonly penalty: number; // count * weight
  readonly description: string;
  readonly samples: ReadonlyArray<string>;
}

export interface ArchitectureScoreReport {
  readonly generated_at: string;
  readonly architecture_score: number;       // 0–100, clamped
  readonly raw_score: number;                // can go negative before clamp
  readonly total_penalty: number;
  readonly grade: "A" | "B" | "C" | "D" | "F";
  readonly score_breakdown: ReadonlyArray<ScoreFactor>;
  readonly inputs: {
    readonly file_count: number;
    readonly route_count: number;
    readonly node_count: number;
    readonly edge_count: number;
  };
}

const WEIGHTS = {
  orphan_files: 1,
  duplicates: 2,
  circular_dependencies: 5,
  cross_layer_violations: 3,
  unmounted_routes: 2,
  high_coupling_nodes: 1,
} as const;

const HIGH_COUPLING_THRESHOLD = 15; // |in| + |out| ≥ 15 → "high"

function gradeFor(score: number): ArchitectureScoreReport["grade"] {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  if (score >= 40) return "D";
  return "F";
}

export function runArchitectureScoring(): ArchitectureScoreReport {
  const generated_at = new Date().toISOString();

  // ── INPUTS (all from deterministic producers) ───────────────────────────
  let heatmap;
  try { heatmap = runDependencyHeatmap(); } catch { heatmap = null; }

  let arch;
  try { arch = runArchitectureEnforcement(); } catch { arch = null; }

  let dupes: { line: string; files: string[] }[] = [];
  try { dupes = getDuplicatedLines(); } catch { dupes = []; }

  // ── FACTOR: orphan_files (heatmap.isolated_nodes, ignore shadcn primitives) ──
  const orphans = (heatmap?.isolated_nodes ?? []).filter(
    (n) => !n.id.startsWith("src/components/ui/")
  );
  const orphanFactor: ScoreFactor = {
    key: "orphan_files",
    count: orphans.length,
    weight: WEIGHTS.orphan_files,
    penalty: orphans.length * WEIGHTS.orphan_files,
    description: "Files with 0 imports in and 0 imports out (excluding shadcn primitives).",
    samples: orphans.slice(0, 5).map((n) => n.id),
  };

  // ── FACTOR: duplicates (lines that repeat across ≥3 files) ────────────────
  const duplicateFactor: ScoreFactor = {
    key: "duplicates",
    count: dupes.length,
    weight: WEIGHTS.duplicates,
    penalty: dupes.length * WEIGHTS.duplicates,
    description: "Long lines repeated verbatim across ≥3 files (copy-paste).",
    samples: dupes.slice(0, 3).map((d) => `${d.files.length}× — ${d.line.slice(0, 60)}…`),
  };

  // ── FACTOR: circular_dependencies (Tarjan SCCs from heatmap) ─────────────
  const cycles = heatmap?.circular_dependencies ?? [];
  const circularFactor: ScoreFactor = {
    key: "circular_dependencies",
    count: cycles.length,
    weight: WEIGHTS.circular_dependencies,
    penalty: cycles.length * WEIGHTS.circular_dependencies,
    description: "Strongly-connected import cycles in the dependency graph.",
    samples: cycles.slice(0, 3).map((c) => c.join(" → ")),
  };

  // ── FACTOR: cross_layer_violations (A1–A4 from enforcement core) ─────────
  const xLayer = arch?.violations ?? [];
  const crossLayerFactor: ScoreFactor = {
    key: "cross_layer_violations",
    count: xLayer.length,
    weight: WEIGHTS.cross_layer_violations,
    penalty: xLayer.length * WEIGHTS.cross_layer_violations,
    description: "Layer-boundary violations (A1: ui→core, A2: routes-with-logic, A3: components-write-DB, A4: external SDK outside services).",
    samples: xLayer.slice(0, 5).map((v) => `${v.rule} ${v.file}`),
  };

  // ── FACTOR: unmounted_routes (registered route → file does not exist) ────
  const pathSet = new Set(fileSystemMap.map((f) => f.path));
  const unmounted: string[] = [];
  for (const r of ROUTE_REGISTRY as any[]) {
    const file = r.file || r.module;
    if (!file) continue;
    const candidate = file.startsWith("src/") ? file : "src/" + file;
    const found = [".ts", ".tsx", ""].some((ext) => pathSet.has(candidate + ext));
    if (!found) unmounted.push(`${r.path || r.id || "?"} → ${file}`);
  }
  const unmountedFactor: ScoreFactor = {
    key: "unmounted_routes",
    count: unmounted.length,
    weight: WEIGHTS.unmounted_routes,
    penalty: unmounted.length * WEIGHTS.unmounted_routes,
    description: "Routes in ROUTE_REGISTRY whose target file is missing on disk.",
    samples: unmounted.slice(0, 5),
  };

  // ── FACTOR: high_coupling_nodes (coupling_score ≥ threshold) ─────────────
  const high = (heatmap?.nodes ?? []).filter(
    (n) => n.coupling_score >= HIGH_COUPLING_THRESHOLD
  );
  const highCouplingFactor: ScoreFactor = {
    key: "high_coupling_nodes",
    count: high.length,
    weight: WEIGHTS.high_coupling_nodes,
    penalty: high.length * WEIGHTS.high_coupling_nodes,
    description: `Nodes with coupling_score ≥ ${HIGH_COUPLING_THRESHOLD} (imports_in + imports_out).`,
    samples: high
      .slice()
      .sort((a, b) => b.coupling_score - a.coupling_score)
      .slice(0, 5)
      .map((n) => `${n.id} (${n.coupling_score})`),
  };

  const score_breakdown: ScoreFactor[] = [
    orphanFactor,
    duplicateFactor,
    circularFactor,
    crossLayerFactor,
    unmountedFactor,
    highCouplingFactor,
  ];

  const total_penalty = score_breakdown.reduce((s, f) => s + f.penalty, 0);
  const raw_score = 100 - total_penalty;
  const architecture_score = Math.max(0, Math.min(100, raw_score));

  return Object.freeze({
    generated_at,
    architecture_score,
    raw_score,
    total_penalty,
    grade: gradeFor(architecture_score),
    score_breakdown: Object.freeze(score_breakdown.map((f) => Object.freeze(f))),
    inputs: Object.freeze({
      file_count: fileSystemMap.length,
      route_count: ROUTE_REGISTRY.length,
      node_count: heatmap?.metrics.total_nodes ?? 0,
      edge_count: heatmap?.metrics.total_edges ?? 0,
    }),
  });
}
