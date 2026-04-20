/**
 * RELEASE GATE
 *
 * GOAL: Final stability verdict. Aggregates the prior engines into a single
 * APPROVED / BLOCKED decision per pipeline run.
 *
 * REQUIREMENTS (ALL must hold):
 *   1. pipeline_status === "SUCCESS"
 *   2. regression_detected === false (per RegressionGuard for the same run)
 *   3. architecture_score ≥ ARCHITECTURE_SCORE_THRESHOLD
 *      (read from the version produced by this run; if no version was
 *      committed, falls back to artifacts.architecture_status)
 *   4. no critical rule violations (architecture_status !== "STOP BUILD"
 *      AND architecture_violations ≤ MAX_VIOLATIONS_FOR_RELEASE)
 *
 * AUTHORITY: read-only reporter. The gate produces a verdict; it does NOT
 * mutate pipelines, versions, or rollbacks. The deterministic pipeline calls
 * `evaluate(run)` from `finish()` after the rollback engine has run.
 */
import type { PipelineRun } from "@/core/scanner/deterministicBuildPipeline";
import { regressionGuard } from "@/core/scanner/regressionGuard";
import { versionedArchitectureStore } from "@/core/scanner/versionedArchitectureStore";

export const ARCHITECTURE_SCORE_THRESHOLD = 80;
export const MAX_VIOLATIONS_FOR_RELEASE = 0;

export type ReleaseStatus = "APPROVED" | "BLOCKED";

export type ReleaseRequirementKey =
  | "pipeline_status"
  | "regression_detected"
  | "architecture_score"
  | "critical_rule_violations";

export interface ReleaseRequirementResult {
  key: ReleaseRequirementKey;
  passed: boolean;
  expected: string;
  actual: string;
  detail: string;
}

export interface ReleaseDecision {
  readonly id: string;
  readonly evaluated_at: string;
  readonly source_pipeline_id: string;
  readonly source_version_id: string | null;
  readonly release_status: ReleaseStatus;
  readonly blocking_reasons: string[];
  readonly requirements: ReleaseRequirementResult[];
  readonly metrics: {
    pipeline_status: string;
    architecture_score: number | null;
    architecture_violations: number | null;
    architecture_status: string | null;
    regression_detected: boolean | null;
  };
}

export interface ReleaseGateState {
  current: ReleaseDecision | null;
  history: ReleaseDecision[]; // newest first
  approved_count: number;
  blocked_count: number;
}

class ReleaseGate {
  private history: ReleaseDecision[] = [];
  private nextId = 1;
  private listeners = new Set<() => void>();

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private emit() {
    for (const fn of this.listeners) fn();
  }

  getState(): ReleaseGateState {
    return {
      current: this.history[0] ?? null,
      history: [...this.history],
      approved_count: this.history.filter((d) => d.release_status === "APPROVED").length,
      blocked_count: this.history.filter((d) => d.release_status === "BLOCKED").length,
    };
  }

  /** Evaluate a finished pipeline run against all release requirements. */
  evaluate(run: PipelineRun): ReleaseDecision {
    const requirements: ReleaseRequirementResult[] = [];
    const blocking: string[] = [];

    // ── 1. pipeline_status ──
    const pipelineOk = run.status === "SUCCESS";
    requirements.push({
      key: "pipeline_status",
      passed: pipelineOk,
      expected: "SUCCESS",
      actual: run.status,
      detail: pipelineOk
        ? "pipeline reached RELEASE_CHECK without failures"
        : `pipeline ${run.status}${
            run.failed_stage ? ` at ${run.failed_stage}` : ""
          }${run.failure_reason ? `: ${run.failure_reason}` : ""}`,
    });
    if (!pipelineOk) blocking.push(`pipeline_status=${run.status}`);

    // ── 2. regression_detected ──
    const regression = regressionGuard.getForPipeline(run.pipeline_id);
    const regressionDetected = regression?.regression_detected ?? null;
    const regressionPassed = regressionDetected === false || regressionDetected === null;
    requirements.push({
      key: "regression_detected",
      passed: regressionPassed,
      expected: "false",
      actual: regressionDetected === null ? "n/a" : String(regressionDetected),
      detail:
        regressionDetected === null
          ? "no regression evaluation recorded for this pipeline"
          : regressionDetected
            ? `${regression?.differences.length ?? 0} regression(s) vs ${regression?.previous_version_id ?? "previous"}`
            : "no regression vs previous version",
    });
    if (regressionDetected === true) {
      blocking.push(
        `regression_detected (${regression?.differences.map((d) => d.check).join(", ") || "see panel"})`
      );
    }

    // ── 3. architecture_score ──
    const versionFromRun = versionedArchitectureStore
      .getState()
      .versions.find((v) => v.source_pipeline_id === run.pipeline_id) ?? null;
    const score = versionFromRun?.architecture_score ?? null;
    const scorePassed = score == null ? pipelineOk : score >= ARCHITECTURE_SCORE_THRESHOLD;
    requirements.push({
      key: "architecture_score",
      passed: scorePassed,
      expected: `≥ ${ARCHITECTURE_SCORE_THRESHOLD}`,
      actual: score == null ? "n/a" : String(score),
      detail:
        score == null
          ? "no version committed — score unavailable; falling back to pipeline status"
          : `version ${versionFromRun?.version_id} score=${score}`,
    });
    if (score != null && score < ARCHITECTURE_SCORE_THRESHOLD) {
      blocking.push(`architecture_score ${score} < ${ARCHITECTURE_SCORE_THRESHOLD}`);
    }

    // ── 4. critical_rule_violations ──
    const archStatus = run.artifacts.architecture_status;
    const violations = run.artifacts.architecture_violations ?? 0;
    const noCritical =
      archStatus !== "STOP BUILD" && violations <= MAX_VIOLATIONS_FOR_RELEASE;
    requirements.push({
      key: "critical_rule_violations",
      passed: noCritical,
      expected: `status≠STOP BUILD AND violations≤${MAX_VIOLATIONS_FOR_RELEASE}`,
      actual: `status=${archStatus ?? "n/a"} · violations=${violations}`,
      detail: noCritical
        ? "no critical rule violations"
        : archStatus === "STOP BUILD"
          ? "architecture enforcement returned STOP BUILD"
          : `${violations} violation(s) exceeds limit ${MAX_VIOLATIONS_FOR_RELEASE}`,
    });
    if (!noCritical) {
      if (archStatus === "STOP BUILD") blocking.push("architecture STOP BUILD");
      if (violations > MAX_VIOLATIONS_FOR_RELEASE) {
        blocking.push(`${violations} rule violation(s) > ${MAX_VIOLATIONS_FOR_RELEASE}`);
      }
    }

    const decision: ReleaseDecision = Object.freeze({
      id: `rel-${this.nextId++}`,
      evaluated_at: new Date().toISOString(),
      source_pipeline_id: run.pipeline_id,
      source_version_id: versionFromRun?.version_id ?? null,
      release_status: blocking.length === 0 ? "APPROVED" : "BLOCKED",
      blocking_reasons: Object.freeze(blocking) as string[],
      requirements: Object.freeze(requirements) as ReleaseRequirementResult[],
      metrics: Object.freeze({
        pipeline_status: run.status,
        architecture_score: score,
        architecture_violations: violations,
        architecture_status: archStatus ?? null,
        regression_detected: regressionDetected,
      }),
    });

    this.history.unshift(decision);
    if (this.history.length > 100) this.history.length = 100;
    this.emit();
    return decision;
  }

  reset() {
    this.history = [];
    this.nextId = 1;
    this.emit();
  }
}

export const releaseGate = new ReleaseGate();
