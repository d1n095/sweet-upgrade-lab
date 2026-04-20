/**
 * VERSIONED ARCHITECTURE STATE
 *
 * GOAL: Track every verified system state as an immutable version.
 *
 * A new version is created ONLY after a successful pipeline run
 * (deterministicBuildPipeline.run() returning status === "SUCCESS").
 * Versions are append-only — never modified, never deleted.
 *
 * VERSION CONTENTS (per spec):
 *   - file_count
 *   - component_count
 *   - route_count
 *   - dependency_graph { edges, cycles, isolated }
 *   - architecture_score (0–100, derived from build_status + violations)
 *
 * AUTHORITY: read-only reporter. The deterministicBuildPipeline calls
 * `commitFromPipeline(run)` after RELEASE_CHECK passes. No other module
 * may write versions.
 */
import type { PipelineRun } from "@/core/scanner/deterministicBuildPipeline";

export interface DependencyGraphSummary {
  edges: number;
  cycles: number;
  isolated: number;
}

export interface ArchitectureVersion {
  readonly version_id: string; // "v1", "v2", ...
  readonly version_number: number;
  readonly created_at: string;
  readonly source_pipeline_id: string;
  readonly file_count: number;
  readonly component_count: number;
  readonly route_count: number;
  readonly dependency_graph: DependencyGraphSummary;
  readonly architecture_score: number;
  readonly architecture_status: "PASS" | "STOP BUILD" | "SKIPPED" | "UNKNOWN";
  readonly architecture_violations: number;
  /** Optional pointer to the snapshot that backed this version. */
  readonly snapshot_hash: string | null;
}

export type VersionFieldDelta =
  | { kind: "scalar"; from: number | string; to: number | string; delta: number | null }
  | {
      kind: "graph";
      from: DependencyGraphSummary;
      to: DependencyGraphSummary;
      delta: DependencyGraphSummary;
    };

export interface VersionDiff {
  from_version_id: string | null;
  to_version_id: string;
  changes: Record<string, VersionFieldDelta>;
  unchanged: string[];
  is_first_version: boolean;
}

export interface VersionedStoreState {
  current: ArchitectureVersion | null;
  versions: ArchitectureVersion[]; // newest first
  total: number;
  rejected_attempts: { pipeline_id: string; reason: string; at: string }[];
}

function scoreFromArchitecture(
  status: ArchitectureVersion["architecture_status"],
  violations: number
): number {
  if (status === "STOP BUILD") return Math.max(0, 50 - violations * 2);
  if (status === "SKIPPED" || status === "UNKNOWN") return 75;
  // PASS — 100 minus a small penalty per violation, floored at 60.
  return Math.max(60, 100 - violations);
}

class VersionedArchitectureStore {
  private versions: ArchitectureVersion[] = []; // index 0 = newest
  private nextVersionNumber = 1;
  private committed_pipeline_ids = new Set<string>();
  private rejected: VersionedStoreState["rejected_attempts"] = [];
  private listeners = new Set<() => void>();

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private emit() {
    for (const fn of this.listeners) fn();
  }

  getState(): VersionedStoreState {
    return {
      current: this.versions[0] ?? null,
      versions: [...this.versions],
      total: this.versions.length,
      rejected_attempts: [...this.rejected],
    };
  }

  /**
   * Commit a new version from a successful pipeline run.
   * Idempotent: same pipeline_id is accepted once.
   * Returns { version, diff } or null if rejected.
   */
  commitFromPipeline(
    run: PipelineRun
  ): { version: ArchitectureVersion; diff: VersionDiff } | null {
    const now = new Date().toISOString();

    if (run.status !== "SUCCESS") {
      this.rejected.push({
        pipeline_id: run.pipeline_id,
        reason: `pipeline status=${run.status} (only SUCCESS may version)`,
        at: now,
      });
      this.emit();
      return null;
    }
    if (this.committed_pipeline_ids.has(run.pipeline_id)) {
      this.rejected.push({
        pipeline_id: run.pipeline_id,
        reason: "already versioned (run-once rule)",
        at: now,
      });
      this.emit();
      return null;
    }

    const a = run.artifacts;
    if (
      a.file_count == null ||
      a.component_count == null ||
      a.route_count == null ||
      !a.dependency_summary
    ) {
      this.rejected.push({
        pipeline_id: run.pipeline_id,
        reason: "pipeline artifacts incomplete — cannot version",
        at: now,
      });
      this.emit();
      return null;
    }

    const status: ArchitectureVersion["architecture_status"] =
      a.architecture_status === "PASS" ||
      a.architecture_status === "STOP BUILD" ||
      a.architecture_status === "SKIPPED"
        ? a.architecture_status
        : "UNKNOWN";
    const violations = a.architecture_violations ?? 0;

    const versionNumber = this.nextVersionNumber++;
    const version: ArchitectureVersion = Object.freeze({
      version_id: `v${versionNumber}`,
      version_number: versionNumber,
      created_at: now,
      source_pipeline_id: run.pipeline_id,
      file_count: a.file_count,
      component_count: a.component_count,
      route_count: a.route_count,
      dependency_graph: Object.freeze({ ...a.dependency_summary }),
      architecture_score: scoreFromArchitecture(status, violations),
      architecture_status: status,
      architecture_violations: violations,
      snapshot_hash: a.snapshot?.verification_hash ?? null,
    });

    const previous = this.versions[0] ?? null;
    const diff = this.computeDiff(previous, version);

    this.committed_pipeline_ids.add(run.pipeline_id);
    this.versions.unshift(version);
    if (this.versions.length > 200) this.versions.length = 200;
    this.emit();
    return { version, diff };
  }

  /** Diff a candidate version against its predecessor (or null = first version). */
  computeDiff(prev: ArchitectureVersion | null, next: ArchitectureVersion): VersionDiff {
    if (!prev) {
      return {
        from_version_id: null,
        to_version_id: next.version_id,
        changes: {},
        unchanged: [],
        is_first_version: true,
      };
    }
    const changes: Record<string, VersionFieldDelta> = {};
    const unchanged: string[] = [];

    const scalarFields: (keyof ArchitectureVersion)[] = [
      "file_count",
      "component_count",
      "route_count",
      "architecture_score",
      "architecture_status",
      "architecture_violations",
    ];
    for (const f of scalarFields) {
      const a = prev[f] as number | string;
      const b = next[f] as number | string;
      if (a !== b) {
        const delta =
          typeof a === "number" && typeof b === "number" ? b - a : null;
        changes[f as string] = { kind: "scalar", from: a, to: b, delta };
      } else {
        unchanged.push(f as string);
      }
    }

    const dg1 = prev.dependency_graph;
    const dg2 = next.dependency_graph;
    if (dg1.edges !== dg2.edges || dg1.cycles !== dg2.cycles || dg1.isolated !== dg2.isolated) {
      changes.dependency_graph = {
        kind: "graph",
        from: dg1,
        to: dg2,
        delta: {
          edges: dg2.edges - dg1.edges,
          cycles: dg2.cycles - dg1.cycles,
          isolated: dg2.isolated - dg1.isolated,
        },
      };
    } else {
      unchanged.push("dependency_graph");
    }

    return {
      from_version_id: prev.version_id,
      to_version_id: next.version_id,
      changes,
      unchanged,
      is_first_version: false,
    };
  }

  /** Compute diff between any two committed versions by id. */
  diffBetween(from_id: string, to_id: string): VersionDiff | null {
    const from = this.versions.find((v) => v.version_id === from_id) ?? null;
    const to = this.versions.find((v) => v.version_id === to_id);
    if (!to) return null;
    return this.computeDiff(from, to);
  }
}

export const versionedArchitectureStore = new VersionedArchitectureStore();
