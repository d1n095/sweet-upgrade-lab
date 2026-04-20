/**
 * CLUSTER HEALTH SCORING
 *
 * Per-cluster score on 4 dimensions:
 *   - dependency density   (in+out edges relative to cluster size)
 *   - circular references  (membership in any cycle)
 *   - render frequency     (proxied by file count = render_heat)
 *   - state complexity     (proxied by violations + coupling)
 *
 * Flags: critical | unstable | inefficient | healthy.
 * Emits alerts when thresholds exceeded.
 */
import type { ClusterRegistry } from "./clusterIntelligence";

export type ClusterHealthFlag = "healthy" | "inefficient" | "unstable" | "critical";

export interface ClusterScore {
  cluster_id: string;
  dependency_density: number;
  in_cycle: boolean;
  render_frequency: number;
  state_complexity: number;
  composite_score: number; // 0–100, higher is healthier
  flag: ClusterHealthFlag;
}

export interface ClusterHealthAlert {
  cluster_id: string;
  flag: ClusterHealthFlag;
  reason: string;
}

export interface ClusterHealthReport {
  generated_at: string;
  scores: ReadonlyArray<ClusterScore>;
  alerts: ReadonlyArray<ClusterHealthAlert>;
  summary: { healthy: number; inefficient: number; unstable: number; critical: number };
}

const clamp = (v: number) => Math.max(0, Math.min(100, v));

export function evaluateClusterHealth(registry: ClusterRegistry): ClusterHealthReport {
  const inCycle = new Set<string>();
  for (const chain of registry.circular_clusters) for (const id of chain) inCycle.add(id);

  const scores: ClusterScore[] = registry.clusters.map((c) => {
    const size = Math.max(1, c.files.length);
    const dependency_density = (c.in_edges + c.out_edges) / size;
    const render_frequency = c.render_heat;
    const state_complexity = c.failure_risk;
    const in_cycle = inCycle.has(c.id);

    // Composite — start at 100, subtract penalties
    let s = 100;
    s -= dependency_density * 4;
    s -= state_complexity * 2;
    s -= render_frequency > 30 ? (render_frequency - 30) * 0.5 : 0;
    s -= in_cycle ? 25 : 0;
    const composite_score = clamp(Math.round(s));

    let flag: ClusterHealthFlag = "healthy";
    if (composite_score < 40 || in_cycle) flag = "critical";
    else if (composite_score < 60) flag = "unstable";
    else if (render_frequency > 35 && state_complexity < 2) flag = "inefficient";

    return {
      cluster_id: c.id,
      dependency_density: Number(dependency_density.toFixed(2)),
      in_cycle,
      render_frequency,
      state_complexity,
      composite_score,
      flag,
    };
  });

  const alerts: ClusterHealthAlert[] = scores
    .filter((s) => s.flag !== "healthy")
    .map((s) => ({
      cluster_id: s.cluster_id,
      flag: s.flag,
      reason:
        s.flag === "critical"
          ? s.in_cycle
            ? "Part of a circular cluster chain."
            : `Composite score ${s.composite_score} < 40.`
          : s.flag === "unstable"
            ? `Composite score ${s.composite_score} < 60.`
            : `High render frequency (${s.render_frequency}) with low complexity — likely over-engineered.`,
    }));

  const summary = scores.reduce(
    (acc, s) => ({ ...acc, [s.flag]: acc[s.flag] + 1 }),
    { healthy: 0, inefficient: 0, unstable: 0, critical: 0 }
  );

  return Object.freeze({
    generated_at: new Date().toISOString(),
    scores: Object.freeze(scores.sort((a, b) => a.composite_score - b.composite_score)),
    alerts: Object.freeze(alerts),
    summary,
  });
}
