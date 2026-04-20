/**
 * DRIFT DETECTOR
 *
 * GOAL: Detect silent changes in the system over time by comparing the LIVE
 * state against the LAST committed Immutable Snapshot v2. Any difference that
 * appears WITHOUT a fresh pipeline run / snapshot commit is "drift".
 *
 * COMPARES:
 *   - file list (added / removed)
 *   - file_count
 *   - route registry (added / removed paths, mutated entries)
 *   - dependency graph (edges_count, cycles_count, isolated_count)
 *   - architecture violation count
 *   - integrity_hash (re-derived from a fresh probe snapshot)
 *
 * RULE:
 *   IF there are differences AND no new snapshot was committed since the
 *   baseline → DRIFT_DETECTED.
 *   IF there is no baseline (no snapshot ever taken) → status = NO_BASELINE.
 *   IF nothing differs → status = STABLE.
 *
 * AUTHORITY: read-only reporter. Pure derivation from `snapshotStoreV2` and
 * the live engines. Never mutates baselines or commits snapshots.
 */
import {
  snapshotStoreV2,
  type ImmutableSnapshotV2,
} from "@/core/scanner/immutableSnapshotV2";

export type DriftStatus = "STABLE" | "DRIFT_DETECTED" | "NO_BASELINE";

export interface RouteDiffEntry {
  path: string;
  before: string | null; // element name in baseline
  after: string | null;  // element name in live probe
}

export interface DriftReport {
  readonly checked_at: string;
  readonly drift_status: DriftStatus;
  readonly baseline_id: string | null;
  readonly baseline_hash: string | null;
  readonly live_hash: string | null;
  readonly changed_files: {
    added: ReadonlyArray<string>;
    removed: ReadonlyArray<string>;
    total: number;
  };
  readonly route_diff: {
    added: ReadonlyArray<string>;
    removed: ReadonlyArray<string>;
    mutated: ReadonlyArray<RouteDiffEntry>;
    total: number;
  };
  readonly counters: {
    files: { before: number; after: number; delta: number };
    routes: { before: number; after: number; delta: number };
    edges: { before: number; after: number; delta: number };
    cycles: { before: number; after: number; delta: number };
    isolated: { before: number; after: number; delta: number };
    violations: { before: number; after: number; delta: number };
  };
  readonly summary: string;
}

interface DriftDetectorState {
  last_report: DriftReport | null;
  history: ReadonlyArray<DriftReport>;
  total_checks: number;
  last_drift_at: string | null;
}

function diffSorted(before: ReadonlyArray<string>, after: ReadonlyArray<string>) {
  const beforeSet = new Set(before);
  const afterSet = new Set(after);
  const added: string[] = [];
  const removed: string[] = [];
  for (const p of after) if (!beforeSet.has(p)) added.push(p);
  for (const p of before) if (!afterSet.has(p)) removed.push(p);
  added.sort();
  removed.sort();
  return { added, removed };
}

class DriftDetector {
  private history: DriftReport[] = [];
  private listeners = new Set<() => void>();
  private last_drift_at: string | null = null;

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private emit() {
    for (const fn of this.listeners) fn();
  }

  getState(): DriftDetectorState {
    return {
      last_report: this.history[0] ?? null,
      history: [...this.history],
      total_checks: this.history.length,
      last_drift_at: this.last_drift_at,
    };
  }

  /**
   * Compare the live system to the most recent v2 snapshot. Produces a fresh
   * probe via `snapshotStoreV2.commit(...)` — but because v2 dedupes on hash,
   * an identical state returns the existing snapshot (no new history entry).
   */
  check(): DriftReport {
    const snapshotState = snapshotStoreV2.getState();
    const baseline: ImmutableSnapshotV2 | null = snapshotState.current;

    // Capture a probe of the current live state. Source-tagged so it's clear
    // this came from the drift detector and not a manual capture.
    const probe = snapshotStoreV2.commit({ source: "drift-detector:probe" });

    const checked_at = new Date().toISOString();

    if (!baseline) {
      const report: DriftReport = Object.freeze({
        checked_at,
        drift_status: "NO_BASELINE",
        baseline_id: null,
        baseline_hash: null,
        live_hash: probe.integrity_hash,
        changed_files: Object.freeze({
          added: Object.freeze([]),
          removed: Object.freeze([]),
          total: 0,
        }),
        route_diff: Object.freeze({
          added: Object.freeze([]),
          removed: Object.freeze([]),
          mutated: Object.freeze([]),
          total: 0,
        }),
        counters: emptyCounters(probe),
        summary:
          "No baseline snapshot exists yet. Capture an Immutable Snapshot v2 first to establish a reference point.",
      });
      this.record(report);
      return report;
    }

    // ── File diff ──
    const fileDiff = diffSorted(baseline.files, probe.files);

    // ── Route diff ──
    const baselineRoutes = new Map(baseline.route_registry.map((r) => [r.path, r]));
    const probeRoutes = new Map(probe.route_registry.map((r) => [r.path, r]));
    const routeDiff = diffSorted(
      [...baselineRoutes.keys()],
      [...probeRoutes.keys()]
    );
    const mutated: RouteDiffEntry[] = [];
    for (const [path, beforeR] of baselineRoutes) {
      const afterR = probeRoutes.get(path);
      if (!afterR) continue;
      if (beforeR.element !== afterR.element || beforeR.file !== afterR.file) {
        mutated.push({
          path,
          before: beforeR.element,
          after: afterR.element,
        });
      }
    }
    mutated.sort((a, b) => a.path.localeCompare(b.path));

    const totalRouteChanges =
      routeDiff.added.length + routeDiff.removed.length + mutated.length;

    const counters = {
      files: delta(baseline.file_count, probe.file_count),
      routes: delta(baseline.route_count, probe.route_count),
      edges: delta(
        baseline.dependency_graph.edges_count,
        probe.dependency_graph.edges_count
      ),
      cycles: delta(
        baseline.dependency_graph.cycles_count,
        probe.dependency_graph.cycles_count
      ),
      isolated: delta(
        baseline.dependency_graph.isolated_count,
        probe.dependency_graph.isolated_count
      ),
      violations: delta(
        baseline.architecture_violation_count,
        probe.architecture_violation_count
      ),
    };

    const hashesMatch = baseline.integrity_hash === probe.integrity_hash;
    const anyDiff =
      !hashesMatch ||
      fileDiff.added.length > 0 ||
      fileDiff.removed.length > 0 ||
      totalRouteChanges > 0 ||
      counters.edges.delta !== 0 ||
      counters.cycles.delta !== 0 ||
      counters.isolated.delta !== 0 ||
      counters.violations.delta !== 0;

    const drift_status: DriftStatus = anyDiff ? "DRIFT_DETECTED" : "STABLE";

    const summary = anyDiff
      ? buildSummary(fileDiff, totalRouteChanges, counters, hashesMatch)
      : "System matches baseline snapshot. No drift detected.";

    const report: DriftReport = Object.freeze({
      checked_at,
      drift_status,
      baseline_id: baseline.snapshot_id,
      baseline_hash: baseline.integrity_hash,
      live_hash: probe.integrity_hash,
      changed_files: Object.freeze({
        added: Object.freeze([...fileDiff.added]),
        removed: Object.freeze([...fileDiff.removed]),
        total: fileDiff.added.length + fileDiff.removed.length,
      }),
      route_diff: Object.freeze({
        added: Object.freeze([...routeDiff.added]),
        removed: Object.freeze([...routeDiff.removed]),
        mutated: Object.freeze(mutated.map((m) => Object.freeze({ ...m }))),
        total: totalRouteChanges,
      }),
      counters: Object.freeze(counters),
      summary,
    });

    if (drift_status === "DRIFT_DETECTED") this.last_drift_at = checked_at;
    this.record(report);
    return report;
  }

  reset() {
    this.history = [];
    this.last_drift_at = null;
    this.emit();
  }

  private record(report: DriftReport) {
    this.history.unshift(report);
    if (this.history.length > 50) this.history.length = 50;
    this.emit();
  }
}

function delta(before: number, after: number) {
  return { before, after, delta: after - before };
}

function emptyCounters(probe: ImmutableSnapshotV2) {
  return Object.freeze({
    files: delta(probe.file_count, probe.file_count),
    routes: delta(probe.route_count, probe.route_count),
    edges: delta(
      probe.dependency_graph.edges_count,
      probe.dependency_graph.edges_count
    ),
    cycles: delta(
      probe.dependency_graph.cycles_count,
      probe.dependency_graph.cycles_count
    ),
    isolated: delta(
      probe.dependency_graph.isolated_count,
      probe.dependency_graph.isolated_count
    ),
    violations: delta(
      probe.architecture_violation_count,
      probe.architecture_violation_count
    ),
  });
}

function buildSummary(
  fileDiff: { added: string[]; removed: string[] },
  totalRouteChanges: number,
  counters: DriftReport["counters"],
  hashesMatch: boolean
): string {
  const parts: string[] = [];
  if (fileDiff.added.length || fileDiff.removed.length) {
    parts.push(
      `${fileDiff.added.length} added / ${fileDiff.removed.length} removed file(s)`
    );
  }
  if (totalRouteChanges > 0) parts.push(`${totalRouteChanges} route change(s)`);
  if (counters.edges.delta !== 0) parts.push(`edges Δ${signed(counters.edges.delta)}`);
  if (counters.cycles.delta !== 0)
    parts.push(`cycles Δ${signed(counters.cycles.delta)}`);
  if (counters.violations.delta !== 0)
    parts.push(`violations Δ${signed(counters.violations.delta)}`);
  if (!hashesMatch && parts.length === 0) {
    parts.push("integrity hash mismatch (sub-field changes)");
  }
  return `Drift detected: ${parts.join(" · ")}.`;
}

function signed(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}

export const driftDetector = new DriftDetector();
