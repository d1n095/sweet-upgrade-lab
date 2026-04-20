/**
 * CLUSTER MEMORY
 *
 * Append-only history of cluster snapshots. Tracks:
 *   - historical changes (cluster size deltas)
 *   - past failures (recorded health flags)
 *   - performance trends (render_heat over time)
 *
 * Predicts likely future issues from recurring patterns and recommends
 * safer architectures based on what historically worked.
 *
 * In-memory only (cleared on reload). Bounded to last 50 snapshots.
 */
import type { ClusterRegistry } from "./clusterIntelligence";
import type { ClusterHealthReport } from "./clusterHealthScoring";

export interface ClusterSnapshot {
  recorded_at: string;
  cluster_count: number;
  per_cluster: Record<
    string,
    {
      file_count: number;
      failure_risk: number;
      health_flag: "healthy" | "inefficient" | "unstable" | "critical";
      composite_score: number;
    }
  >;
}

export interface ClusterPrediction {
  cluster_id: string;
  prediction: string;
  confidence: "low" | "medium" | "high";
  recommendation: string;
}

export interface ClusterMemoryReport {
  generated_at: string;
  snapshot_count: number;
  predictions: ReadonlyArray<ClusterPrediction>;
  recommendations: ReadonlyArray<string>;
  trends: Record<string, "improving" | "declining" | "stable" | "new" | "removed">;
}

const MAX_SNAPSHOTS = 50;
const HISTORY: ClusterSnapshot[] = [];

export function recordSnapshot(
  registry: ClusterRegistry,
  health: ClusterHealthReport
): ClusterSnapshot {
  const per_cluster: ClusterSnapshot["per_cluster"] = {};
  for (const c of registry.clusters) {
    const score = health.scores.find((s) => s.cluster_id === c.id);
    per_cluster[c.id] = {
      file_count: c.files.length,
      failure_risk: c.failure_risk,
      health_flag: score?.flag ?? "healthy",
      composite_score: score?.composite_score ?? 100,
    };
  }
  const snap: ClusterSnapshot = {
    recorded_at: new Date().toISOString(),
    cluster_count: registry.clusters.length,
    per_cluster,
  };
  HISTORY.unshift(snap);
  if (HISTORY.length > MAX_SNAPSHOTS) HISTORY.length = MAX_SNAPSHOTS;
  return snap;
}

export function getHistory(): ReadonlyArray<ClusterSnapshot> {
  return [...HISTORY];
}

export function clearHistory(): void {
  HISTORY.length = 0;
}

export function evaluateClusterMemory(): ClusterMemoryReport {
  const generated_at = new Date().toISOString();
  if (HISTORY.length < 2) {
    return Object.freeze({
      generated_at,
      snapshot_count: HISTORY.length,
      predictions: Object.freeze([]),
      recommendations: Object.freeze([
        HISTORY.length === 0
          ? "No history yet — record snapshots to enable predictions."
          : "Need at least 2 snapshots to detect trends.",
      ]),
      trends: {},
    });
  }

  const latest = HISTORY[0];
  const previous = HISTORY[1];
  const trends: ClusterMemoryReport["trends"] = {};
  const predictions: ClusterPrediction[] = [];
  const recommendations: string[] = [];

  const allIds = new Set([
    ...Object.keys(latest.per_cluster),
    ...Object.keys(previous.per_cluster),
  ]);

  for (const id of allIds) {
    const cur = latest.per_cluster[id];
    const prev = previous.per_cluster[id];
    if (!prev) {
      trends[id] = "new";
      continue;
    }
    if (!cur) {
      trends[id] = "removed";
      continue;
    }
    if (cur.composite_score > prev.composite_score + 3) trends[id] = "improving";
    else if (cur.composite_score < prev.composite_score - 3) trends[id] = "declining";
    else trends[id] = "stable";
  }

  // Predictions: clusters that have been "critical" in ≥2 of last 5 snapshots
  const recent = HISTORY.slice(0, 5);
  const criticalCounts: Record<string, number> = {};
  for (const snap of recent) {
    for (const [id, info] of Object.entries(snap.per_cluster)) {
      if (info.health_flag === "critical") {
        criticalCounts[id] = (criticalCounts[id] ?? 0) + 1;
      }
    }
  }
  for (const [id, count] of Object.entries(criticalCounts)) {
    if (count >= 2) {
      const confidence: ClusterPrediction["confidence"] =
        count >= 4 ? "high" : count >= 3 ? "medium" : "low";
      predictions.push({
        cluster_id: id,
        prediction: `Likely to fail again — flagged critical in ${count}/${recent.length} recent snapshots.`,
        confidence,
        recommendation: "Refactor before adding more dependencies. Past mistakes recur here.",
      });
    }
  }

  // Recommendations from declining trends
  const declining = Object.entries(trends).filter(([, t]) => t === "declining");
  if (declining.length > 0) {
    recommendations.push(
      `${declining.length} cluster(s) trending worse — review recent changes there first.`
    );
  }
  const stableHealthy = Object.entries(trends).filter(
    ([id, t]) => t === "stable" && (latest.per_cluster[id]?.composite_score ?? 0) >= 80
  );
  if (stableHealthy.length > 0) {
    recommendations.push(
      `${stableHealthy.length} cluster(s) stable & healthy — preserve their structure as a template.`
    );
  }
  if (recommendations.length === 0) recommendations.push("No actionable patterns yet.");

  return Object.freeze({
    generated_at,
    snapshot_count: HISTORY.length,
    predictions: Object.freeze(predictions),
    recommendations: Object.freeze(recommendations),
    trends,
  });
}
