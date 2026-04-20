/**
 * CLUSTER META OBSERVER
 *
 * Silent auditor + structural optimizer that sits ABOVE the other cluster
 * engines. It does not introspect single files — it watches the cluster
 * registry and historical memory snapshots over time and produces three
 * outputs:
 *
 *   1. drift_signals      — meaningful structural deltas vs prior snapshots
 *   2. inefficiencies     — long-running structural debt (persistent issues)
 *   3. evolution_plan     — prioritized, suggestion-only structural moves
 *
 * Pure derivation. Never mutates anything. Safe to run any time.
 */
import type { ClusterRegistry } from "./clusterIntelligence";
import type { ClusterHealthReport } from "./clusterHealthScoring";
import { evaluateClusterMemory, getHistory, type ClusterMemoryReport } from "./clusterMemory";

export type DriftKind =
  | "cluster_added"
  | "cluster_removed"
  | "size_spike"
  | "risk_spike"
  | "new_cycle"
  | "new_overcentralization";

export interface DriftSignal {
  kind: DriftKind;
  cluster_id: string | null;
  detail: string;
  severity: "info" | "warn" | "critical";
}

export interface Inefficiency {
  cluster_id: string;
  pattern: "persistent_critical" | "persistent_unstable" | "chronic_orphan" | "chronic_overcentralized";
  occurrences: number;
  detail: string;
}

export interface EvolutionStep {
  id: string;
  priority: "low" | "medium" | "high";
  target: string;
  action: "split" | "merge" | "isolate" | "absorb" | "deprecate";
  rationale: string;
  expected_gain: string;
}

export interface MetaObserverReport {
  generated_at: string;
  status: "STABLE" | "DRIFTING" | "DEGRADED";
  drift_signals: ReadonlyArray<DriftSignal>;
  inefficiencies: ReadonlyArray<Inefficiency>;
  evolution_plan: ReadonlyArray<EvolutionStep>;
  notes: string;
}

const SIZE_SPIKE_RATIO = 1.5;
const RISK_SPIKE_DELTA = 6;
const CHRONIC_THRESHOLD = 3; // appears in N+ snapshots

export interface MetaObserverInput {
  registry: ClusterRegistry;
  health: ClusterHealthReport;
  /** optional override; if absent, evaluateClusterMemory() is used */
  memory?: ClusterMemoryReport;
}

export function evaluateClusterMetaObserver(
  input: MetaObserverInput
): MetaObserverReport {
  const memory = input.memory ?? evaluateClusterMemory();
  const drift_signals: DriftSignal[] = [];
  const inefficiencies: Inefficiency[] = [];
  const evolution_plan: EvolutionStep[] = [];

  // ---- DRIFT (current vs latest historical snapshot) ----
  const history = getHistory();
  const latestSnap = history[0];
  const prevSnap = history[1];

  if (latestSnap && prevSnap) {
    const allIds = new Set([
      ...Object.keys(latestSnap.per_cluster),
      ...Object.keys(prevSnap.per_cluster),
    ]);
    for (const id of allIds) {
      const cur = latestSnap.per_cluster[id];
      const prev = prevSnap.per_cluster[id];
      if (cur && prev) {
        const sizeRatio = prev.file_count > 0 ? cur.file_count / prev.file_count : 1;
        if (sizeRatio >= SIZE_SPIKE_RATIO) {
          drift_signals.push({
            kind: "size_spike",
            cluster_id: id,
            detail: `Cluster grew ${sizeRatio.toFixed(2)}× in size (${prev.file_count} → ${cur.file_count}).`,
            severity: sizeRatio > 2 ? "critical" : "warn",
          });
        }
        const riskDelta = cur.failure_risk - prev.failure_risk;
        if (riskDelta >= RISK_SPIKE_DELTA) {
          drift_signals.push({
            kind: "risk_spike",
            cluster_id: id,
            detail: `Failure risk increased by ${riskDelta} (${prev.failure_risk} → ${cur.failure_risk}).`,
            severity: riskDelta > 12 ? "critical" : "warn",
          });
        }
      }
    }
  }

  // Cluster added / removed (via memory.trends Record)
  const currentIds = new Set(input.registry.clusters.map((c) => c.id));
  for (const [cid, trend] of Object.entries(memory.trends)) {
    if (trend === "new" && currentIds.has(cid)) {
      drift_signals.push({
        kind: "cluster_added",
        cluster_id: cid,
        detail: "New cluster appeared since last snapshot.",
        severity: "info",
      });
    } else if (trend === "removed") {
      drift_signals.push({
        kind: "cluster_removed",
        cluster_id: cid,
        detail: "Cluster disappeared since last snapshot.",
        severity: "warn",
      });
    }
  }

  if (input.registry.circular_clusters.length > 0) {
    drift_signals.push({
      kind: "new_cycle",
      cluster_id: input.registry.circular_clusters[0]?.[0] ?? null,
      detail: `${input.registry.circular_clusters.length} circular cluster chain(s) present.`,
      severity: "critical",
    });
  }
  for (const oc of input.registry.overcentralized) {
    drift_signals.push({
      kind: "new_overcentralization",
      cluster_id: oc,
      detail: `Cluster "${oc}" pulls > 25% of all in-edges.`,
      severity: "warn",
    });
  }

  // ---- INEFFICIENCIES (persistent issues from memory predictions + current health) ----
  for (const p of memory.predictions) {
    if (p.confidence === "high" || p.confidence === "medium") {
      inefficiencies.push({
        cluster_id: p.cluster_id,
        pattern: "persistent_unstable",
        occurrences: memory.snapshot_count,
        detail: p.prediction,
      });
    }
  }
  for (const a of input.health.alerts) {
    if (a.flag === "critical") {
      inefficiencies.push({
        cluster_id: a.cluster_id,
        pattern: "persistent_critical",
        occurrences: 1,
        detail: a.reason,
      });
    }
  }
  for (const oc of input.registry.overcentralized) {
    inefficiencies.push({
      cluster_id: oc,
      pattern: "chronic_overcentralized",
      occurrences: CHRONIC_THRESHOLD,
      detail: `Cluster "${oc}" remains a structural bottleneck.`,
    });
  }
  for (const o of input.registry.orphans) {
    inefficiencies.push({
      cluster_id: o,
      pattern: "chronic_orphan",
      occurrences: 1,
      detail: `Cluster "${o}" has no in/out edges.`,
    });
  }

  // ---- EVOLUTION PLAN (prioritized) ----
  // Critical clusters first → split or isolate
  for (const a of input.health.alerts.filter((x) => x.flag === "critical")) {
    evolution_plan.push({
      id: `evo_split_${a.cluster_id}`,
      priority: "high",
      target: a.cluster_id,
      action: "split",
      rationale: `Critical health: ${a.reason}`,
      expected_gain: "Lower blast radius, isolated re-renders.",
    });
  }
  for (const oc of input.registry.overcentralized) {
    evolution_plan.push({
      id: `evo_isolate_${oc}`,
      priority: "high",
      target: oc,
      action: "isolate",
      rationale: `Hub cluster — too many consumers.`,
      expected_gain: "Halts ripple at consumers via memo seam.",
    });
  }
  for (const cycle of input.registry.circular_clusters) {
    if (cycle[0]) {
      evolution_plan.push({
        id: `evo_break_${cycle.join("_")}`,
        priority: "high",
        target: cycle[0],
        action: "isolate",
        rationale: `Circular chain ${cycle.join(" → ")}`,
        expected_gain: "Breaks feedback loop.",
      });
    }
  }
  for (const o of input.registry.orphans) {
    evolution_plan.push({
      id: `evo_absorb_${o}`,
      priority: "low",
      target: o,
      action: "absorb",
      rationale: `Orphan cluster — likely belongs in a sibling layer.`,
      expected_gain: "Improves cohesion; removes dead structure.",
    });
  }

  // ---- STATUS ----
  const criticalDrift = drift_signals.filter((s) => s.severity === "critical").length;
  const warnDrift = drift_signals.filter((s) => s.severity === "warn").length;
  const status: MetaObserverReport["status"] =
    criticalDrift > 0 || inefficiencies.some((i) => i.pattern === "persistent_critical")
      ? "DEGRADED"
      : warnDrift + drift_signals.length > 2
        ? "DRIFTING"
        : "STABLE";

  return Object.freeze({
    generated_at: new Date().toISOString(),
    status,
    drift_signals: Object.freeze(drift_signals.slice(0, 12)),
    inefficiencies: Object.freeze(inefficiencies.slice(0, 12)),
    evolution_plan: Object.freeze(evolution_plan.slice(0, 8)),
    notes:
      status === "STABLE"
        ? "Cluster meta-state is stable. No structural action needed."
        : `${drift_signals.length} drift signal(s), ${inefficiencies.length} inefficiency pattern(s). Suggestion-only.`,
  });
}
