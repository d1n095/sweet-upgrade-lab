/**
 * ROLLBACK ENGINE
 *
 * GOAL: Restore the system to the last stable architecture version when
 * instability is detected.
 *
 * TRIGGERS (evaluated by `evaluatePipelineRun`):
 *   - PIPELINE_FAILURE          — a deterministic build pipeline run finished
 *                                 with status "FAILED".
 *   - ARCHITECTURE_SCORE_DROP   — the latest committed version's
 *                                 architecture_score dropped vs the previous
 *                                 stable version by ≥ SCORE_DROP_THRESHOLD.
 *   - RULE_VIOLATIONS_INCREASE  — architecture_violations grew by
 *                                 ≥ VIOLATION_INCREASE_THRESHOLD vs the
 *                                 previous stable version.
 *
 * BEHAVIOUR:
 *   - The engine never mutates pipeline runs or versions.
 *   - On a trigger it selects the most recent SAFE version (not the rolled-back
 *     candidate) as `restored_version` and records a RollbackEvent.
 *   - The restored version becomes the engine's `active_version_id`. Future
 *     evaluations are scored against this active baseline.
 *   - The engine is read-only relative to the versioned store; it cannot
 *     delete or rewrite versions (immutability rule of v1, v2, …).
 *
 * AUTHORITY: read-only reporter. The deterministic pipeline calls
 * `evaluatePipelineRun(run)` after a run finishes (success or failure).
 */
import {
  versionedArchitectureStore,
  type ArchitectureVersion,
} from "@/core/scanner/versionedArchitectureStore";
import type { PipelineRun } from "@/core/scanner/deterministicBuildPipeline";

export type RollbackTrigger =
  | "PIPELINE_FAILURE"
  | "ARCHITECTURE_SCORE_DROP"
  | "RULE_VIOLATIONS_INCREASE"
  | "MANUAL";

export const SCORE_DROP_THRESHOLD = 10;
export const VIOLATION_INCREASE_THRESHOLD = 5;

export interface RollbackEvent {
  readonly id: string;
  readonly at: string;
  readonly trigger: RollbackTrigger;
  readonly reason: string;
  readonly source_pipeline_id: string | null;
  readonly rolled_back_from_version_id: string | null;
  readonly rollback_to_version: string | null;
  readonly metrics: {
    score_before: number | null;
    score_after: number | null;
    violations_before: number | null;
    violations_after: number | null;
  };
}

export interface RollbackEngineState {
  active_version_id: string | null;
  last_event: RollbackEvent | null;
  events: RollbackEvent[]; // newest first
  total_rollbacks: number;
  /** Pipelines we have already evaluated, keyed by pipeline_id. */
  evaluated_pipeline_ids: string[];
}

class RollbackEngine {
  private events: RollbackEvent[] = [];
  private activeVersionId: string | null = null;
  private evaluated = new Set<string>();
  private listeners = new Set<() => void>();
  private nextEventNumber = 1;

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private emit() {
    for (const fn of this.listeners) fn();
  }

  getState(): RollbackEngineState {
    // Default active version = newest committed version (no rollback yet).
    const activeFallback =
      this.activeVersionId ?? versionedArchitectureStore.getState().current?.version_id ?? null;
    return {
      active_version_id: activeFallback,
      last_event: this.events[0] ?? null,
      events: [...this.events],
      total_rollbacks: this.events.filter((e) => e.rollback_to_version !== null).length,
      evaluated_pipeline_ids: [...this.evaluated],
    };
  }

  /**
   * Evaluate a finished pipeline run. Idempotent per pipeline_id.
   * Returns the recorded event (null if no event was created).
   */
  evaluatePipelineRun(run: PipelineRun): RollbackEvent | null {
    if (this.evaluated.has(run.pipeline_id)) return null;
    this.evaluated.add(run.pipeline_id);

    if (run.status === "FAILED") {
      return this.recordRollback({
        trigger: "PIPELINE_FAILURE",
        reason: `pipeline FAILED at ${run.failed_stage ?? "unknown stage"}: ${
          run.failure_reason ?? "no reason"
        }`,
        source_pipeline_id: run.pipeline_id,
        candidate: null, // failed run produced no version to roll back from
        previous: this.resolveActiveVersion(),
      });
    }

    if (run.status !== "SUCCESS") return null;

    // SUCCESS — compare freshly committed version to previous stable baseline.
    const versions = versionedArchitectureStore.getState().versions; // newest first
    const candidate = versions.find((v) => v.source_pipeline_id === run.pipeline_id) ?? null;
    if (!candidate) return null;

    // Previous baseline = active version BEFORE this commit.
    // If we have an active rollback baseline, use it; otherwise use the version
    // immediately after candidate in history (i.e. the one before it).
    const candidateIdx = versions.findIndex((v) => v.version_id === candidate.version_id);
    const naturalPrevious = candidateIdx >= 0 ? versions[candidateIdx + 1] ?? null : null;
    const baseline =
      this.activeVersionId
        ? versions.find((v) => v.version_id === this.activeVersionId) ?? naturalPrevious
        : naturalPrevious;

    if (!baseline) {
      // First version ever — nothing to compare against. Adopt as active.
      this.activeVersionId = candidate.version_id;
      this.emit();
      return null;
    }

    const scoreDrop = baseline.architecture_score - candidate.architecture_score;
    const violationsIncrease =
      candidate.architecture_violations - baseline.architecture_violations;

    if (scoreDrop >= SCORE_DROP_THRESHOLD) {
      return this.recordRollback({
        trigger: "ARCHITECTURE_SCORE_DROP",
        reason: `architecture_score dropped ${scoreDrop} (${baseline.architecture_score} → ${candidate.architecture_score}, threshold ${SCORE_DROP_THRESHOLD})`,
        source_pipeline_id: run.pipeline_id,
        candidate,
        previous: baseline,
      });
    }
    if (violationsIncrease >= VIOLATION_INCREASE_THRESHOLD) {
      return this.recordRollback({
        trigger: "RULE_VIOLATIONS_INCREASE",
        reason: `architecture_violations rose by ${violationsIncrease} (${baseline.architecture_violations} → ${candidate.architecture_violations}, threshold ${VIOLATION_INCREASE_THRESHOLD})`,
        source_pipeline_id: run.pipeline_id,
        candidate,
        previous: baseline,
      });
    }

    // Healthy — promote candidate to active.
    this.activeVersionId = candidate.version_id;
    this.emit();
    return null;
  }

  /** Manual rollback to any committed version. */
  rollbackTo(version_id: string, reason: string): RollbackEvent | null {
    const target = versionedArchitectureStore
      .getState()
      .versions.find((v) => v.version_id === version_id);
    if (!target) return null;
    const previous = this.resolveActiveVersion();
    return this.recordRollback({
      trigger: "MANUAL",
      reason: reason || "manual rollback by operator",
      source_pipeline_id: null,
      candidate: previous, // we are rolling back FROM the current active
      previous: target, // …TO this target
      forceTarget: target,
    });
  }

  private resolveActiveVersion(): ArchitectureVersion | null {
    const versions = versionedArchitectureStore.getState().versions;
    const id = this.activeVersionId ?? versions[0]?.version_id ?? null;
    return versions.find((v) => v.version_id === id) ?? null;
  }

  private recordRollback(args: {
    trigger: RollbackTrigger;
    reason: string;
    source_pipeline_id: string | null;
    candidate: ArchitectureVersion | null; // version being rolled back FROM
    previous: ArchitectureVersion | null; // baseline / restore target
    forceTarget?: ArchitectureVersion;
  }): RollbackEvent {
    const versions = versionedArchitectureStore.getState().versions;

    // Restore target: explicit forceTarget (manual), else the previous stable
    // baseline, else fall back to most recent version that ISN'T the candidate.
    let restore: ArchitectureVersion | null = args.forceTarget ?? args.previous;
    if (!restore) {
      restore =
        versions.find((v) => v.version_id !== args.candidate?.version_id) ?? null;
    }

    const event: RollbackEvent = Object.freeze({
      id: `rb-${this.nextEventNumber++}`,
      at: new Date().toISOString(),
      trigger: args.trigger,
      reason: args.reason,
      source_pipeline_id: args.source_pipeline_id,
      rolled_back_from_version_id: args.candidate?.version_id ?? null,
      rollback_to_version: restore?.version_id ?? null,
      metrics: {
        score_before: args.candidate?.architecture_score ?? null,
        score_after: restore?.architecture_score ?? null,
        violations_before: args.candidate?.architecture_violations ?? null,
        violations_after: restore?.architecture_violations ?? null,
      },
    });

    this.events.unshift(event);
    if (this.events.length > 200) this.events.length = 200;
    if (restore) this.activeVersionId = restore.version_id;
    this.emit();
    return event;
  }

  /** Test/admin escape hatch — clears local engine state (does NOT touch versions). */
  reset() {
    this.events = [];
    this.activeVersionId = null;
    this.evaluated.clear();
    this.nextEventNumber = 1;
    this.emit();
  }
}

export const rollbackEngine = new RollbackEngine();
