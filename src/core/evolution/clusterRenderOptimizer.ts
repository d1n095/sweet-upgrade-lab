/**
 * CLUSTER RENDER OPTIMIZER
 *
 * Shifts mental model from per-component rendering to per-cluster rendering.
 * Pure analyzer — never patches React, never wraps components. It produces
 * actionable suggestions to:
 *   - batch updates within a cluster (single state slice / context per cluster)
 *   - isolate re-renders between clusters (memo/selector boundaries at the seam)
 *   - eliminate cascade renders (cycles, hubs, fan-out > threshold)
 *
 * Inputs are derived from the existing dep graph + cluster registry. The
 * optimizer never assumes runtime measurement; it works on the static graph.
 */
import type { ClusterRegistry, Cluster } from "./clusterIntelligence";

export type RenderOptimizationKind =
  | "batch_within_cluster"
  | "isolate_cluster_seam"
  | "break_cascade"
  | "memoize_hub";

export interface RenderOptimization {
  id: string;
  kind: RenderOptimizationKind;
  cluster_id: string;
  rationale: string;
  expected_gain: string;
  estimated_renders_saved: number;
  safe: boolean;
}

export interface ClusterRenderProfile {
  cluster_id: string;
  render_heat: number;
  fan_out: number;
  fan_in: number;
  cascade_risk: "low" | "medium" | "high";
}

export interface RenderOptimizerReport {
  generated_at: string;
  profiles: ReadonlyArray<ClusterRenderProfile>;
  optimizations: ReadonlyArray<RenderOptimization>;
  totals: {
    cascade_high: number;
    estimated_renders_saved: number;
  };
  notes: string;
}

const FAN_OUT_HUB_THRESHOLD = 8;
const HEAT_BATCH_THRESHOLD = 6;
const SEAM_WEIGHT_THRESHOLD = 4;

function classifyCascade(c: Cluster, fanOut: number): ClusterRenderProfile["cascade_risk"] {
  if (fanOut >= FAN_OUT_HUB_THRESHOLD || c.failure_risk > 12) return "high";
  if (fanOut >= 4 || c.render_heat > HEAT_BATCH_THRESHOLD) return "medium";
  return "low";
}

export function evaluateClusterRenderOptimizer(
  registry: ClusterRegistry
): RenderOptimizerReport {
  const profiles: ClusterRenderProfile[] = registry.clusters.map((c) => ({
    cluster_id: c.id,
    render_heat: c.render_heat,
    fan_out: c.out_edges,
    fan_in: c.in_edges,
    cascade_risk: classifyCascade(c, c.out_edges),
  }));

  const optimizations: RenderOptimization[] = [];

  // batch_within_cluster — many files & moderate heat → unify state slice
  for (const c of registry.clusters) {
    if (c.files.length >= HEAT_BATCH_THRESHOLD && c.render_heat >= HEAT_BATCH_THRESHOLD) {
      optimizations.push({
        id: `batch_${c.id}`,
        kind: "batch_within_cluster",
        cluster_id: c.id,
        rationale: `Cluster has ${c.files.length} files with shared heat ${c.render_heat}. Batching reduces per-file re-evaluations.`,
        expected_gain: "One render pass per cluster instead of N.",
        estimated_renders_saved: Math.max(1, c.files.length - 1),
        safe: true,
      });
    }
  }

  // isolate_cluster_seam — heavy edges between two clusters
  const seamMap: Record<string, number> = {};
  for (const e of registry.cluster_edges) seamMap[`${e.from}→${e.to}`] = e.weight;
  for (const e of registry.cluster_edges) {
    if (e.weight >= SEAM_WEIGHT_THRESHOLD) {
      optimizations.push({
        id: `seam_${e.from}_${e.to}`,
        kind: "isolate_cluster_seam",
        cluster_id: e.to,
        rationale: `Cluster "${e.from}" emits ${e.weight} edges into "${e.to}" — this seam propagates re-renders.`,
        expected_gain: "Memoized selector at the seam stops cascade.",
        estimated_renders_saved: e.weight,
        safe: true,
      });
    }
  }

  // break_cascade — circular cluster chains
  for (const cycle of registry.circular_clusters) {
    if (cycle.length === 0) continue;
    const target = cycle[0];
    optimizations.push({
      id: `cascade_${cycle.join("_")}`,
      kind: "break_cascade",
      cluster_id: target,
      rationale: `Circular chain: ${cycle.join(" → ")}. Re-renders feed back into themselves.`,
      expected_gain: "Breaks feedback loop; render count becomes bounded.",
      estimated_renders_saved: cycle.length * 2,
      safe: true,
    });
  }

  // memoize_hub — clusters with very high fan_out
  for (const c of registry.clusters) {
    if (c.out_edges >= FAN_OUT_HUB_THRESHOLD) {
      optimizations.push({
        id: `hub_${c.id}`,
        kind: "memoize_hub",
        cluster_id: c.id,
        rationale: `Cluster "${c.id}" has fan-out ${c.out_edges} — every change ripples to many consumers.`,
        expected_gain: "Memoization at hub boundary halts ripple at consumers.",
        estimated_renders_saved: c.out_edges,
        safe: true,
      });
    }
  }

  const totals = {
    cascade_high: profiles.filter((p) => p.cascade_risk === "high").length,
    estimated_renders_saved: optimizations.reduce(
      (a, b) => a + b.estimated_renders_saved,
      0
    ),
  };

  return Object.freeze({
    generated_at: new Date().toISOString(),
    profiles: Object.freeze(profiles),
    optimizations: Object.freeze(optimizations.slice(0, 12)),
    totals,
    notes:
      optimizations.length === 0
        ? "No render optimizations needed — cluster graph is already efficient."
        : `${optimizations.length} optimization(s). Suggestion-only; nothing is auto-applied.`,
  });
}
