/**
 * REGRESSION GUARD
 *
 * GOAL: Prevent system degradation by comparing the candidate (current build's
 * about-to-be-committed) state to the previous immutable architecture version.
 *
 * CHECKS (all evaluated; any breach = regression):
 *   - FILE_COUNT_DROP          file_count(candidate) < file_count(previous)
 *   - ROUTE_MISMATCH           route_count(candidate) ≠ route_count(previous)
 *                              (any change is suspicious mid-build; explicit
 *                              additions should be planned)
 *   - NEW_ORPHAN_FILES         dependency_graph.isolated grew vs previous
 *   - INCREASED_COUPLING       avg edges per component grew by ≥
 *                              COUPLING_TOLERANCE vs previous
 *
 * RULE:
 *   IF any check fails → result.regression_detected = true
 *   The deterministicBuildPipeline calls this in RELEASE_CHECK and BLOCKS the
 *   release (throws) when regression is detected. No version is committed and
 *   no rollback event fires (because the run becomes FAILED, the rollback
 *   engine treats it as a normal pipeline failure).
 *
 * AUTHORITY: pure compare function. No writes anywhere. The guard maintains
 * an in-memory log of evaluations for the admin panel.
 */
import {
  versionedArchitectureStore,
  type ArchitectureVersion,
  type DependencyGraphSummary,
} from "@/core/scanner/versionedArchitectureStore";

export type RegressionCheck =
  | "FILE_COUNT_DROP"
  | "ROUTE_MISMATCH"
  | "NEW_ORPHAN_FILES"
  | "INCREASED_COUPLING";

/** Coupling = edges / max(1, components). A jump beyond this is a regression. */
export const COUPLING_TOLERANCE = 0.5;

export interface CandidateState {
  source_pipeline_id: string;
  file_count: number;
  component_count: number;
  route_count: number;
  dependency_graph: DependencyGraphSummary;
}

export interface RegressionDifference {
  check: RegressionCheck;
  field: string;
  previous: number;
  candidate: number;
  delta: number;
  message: string;
}

export interface RegressionEvaluation {
  readonly id: string;
  readonly evaluated_at: string;
  readonly source_pipeline_id: string;
  readonly previous_version_id: string | null;
  readonly regression_detected: boolean;
  readonly is_first_version: boolean;
  readonly differences: RegressionDifference[];
  readonly summary: string;
}

export interface RegressionGuardState {
  last: RegressionEvaluation | null;
  history: RegressionEvaluation[]; // newest first
  blocked_pipeline_ids: string[];
}

class RegressionGuard {
  private history: RegressionEvaluation[] = [];
  private blocked = new Set<string>();
  private nextId = 1;
  private listeners = new Set<() => void>();

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private emit() {
    for (const fn of this.listeners) fn();
  }

  getState(): RegressionGuardState {
    return {
      last: this.history[0] ?? null,
      history: [...this.history],
      blocked_pipeline_ids: [...this.blocked],
    };
  }

  /**
   * Evaluate a candidate against the previous (most recent) committed version.
   * Returns the evaluation. If `regression_detected` is true, the caller
   * (pipeline RELEASE_CHECK) MUST block the release.
   */
  evaluate(candidate: CandidateState): RegressionEvaluation {
    const previous = versionedArchitectureStore.getState().current; // newest version, or null
    const differences: RegressionDifference[] = [];

    if (previous) {
      // FILE_COUNT_DROP
      if (candidate.file_count < previous.file_count) {
        differences.push({
          check: "FILE_COUNT_DROP",
          field: "file_count",
          previous: previous.file_count,
          candidate: candidate.file_count,
          delta: candidate.file_count - previous.file_count,
          message: `file_count dropped from ${previous.file_count} to ${candidate.file_count}`,
        });
      }
      // ROUTE_MISMATCH (any change flagged; addition or removal)
      if (candidate.route_count !== previous.route_count) {
        differences.push({
          check: "ROUTE_MISMATCH",
          field: "route_count",
          previous: previous.route_count,
          candidate: candidate.route_count,
          delta: candidate.route_count - previous.route_count,
          message: `route_count changed from ${previous.route_count} to ${candidate.route_count}`,
        });
      }
      // NEW_ORPHAN_FILES
      if (candidate.dependency_graph.isolated > previous.dependency_graph.isolated) {
        differences.push({
          check: "NEW_ORPHAN_FILES",
          field: "dependency_graph.isolated",
          previous: previous.dependency_graph.isolated,
          candidate: candidate.dependency_graph.isolated,
          delta:
            candidate.dependency_graph.isolated - previous.dependency_graph.isolated,
          message: `isolated/orphan files grew by ${
            candidate.dependency_graph.isolated - previous.dependency_graph.isolated
          } (${previous.dependency_graph.isolated} → ${candidate.dependency_graph.isolated})`,
        });
      }
      // INCREASED_COUPLING — edges per component
      const prevCoupling = coupling(previous.dependency_graph.edges, previous.component_count);
      const candCoupling = coupling(
        candidate.dependency_graph.edges,
        candidate.component_count
      );
      const couplingDelta = candCoupling - prevCoupling;
      if (couplingDelta > COUPLING_TOLERANCE) {
        differences.push({
          check: "INCREASED_COUPLING",
          field: "edges_per_component",
          previous: round2(prevCoupling),
          candidate: round2(candCoupling),
          delta: round2(couplingDelta),
          message: `coupling rose by ${round2(couplingDelta)} (${round2(
            prevCoupling
          )} → ${round2(candCoupling)}, tolerance ${COUPLING_TOLERANCE})`,
        });
      }
    }

    const isFirst = !previous;
    const regression = differences.length > 0;
    const evaluation: RegressionEvaluation = Object.freeze({
      id: `rg-${this.nextId++}`,
      evaluated_at: new Date().toISOString(),
      source_pipeline_id: candidate.source_pipeline_id,
      previous_version_id: previous?.version_id ?? null,
      regression_detected: regression,
      is_first_version: isFirst,
      differences: Object.freeze(differences) as RegressionDifference[],
      summary: isFirst
        ? "no previous version — guard skipped"
        : regression
          ? `BLOCKED: ${differences.length} regression${differences.length === 1 ? "" : "s"}`
          : "PASS: no regression vs previous version",
    });

    if (regression) this.blocked.add(candidate.source_pipeline_id);
    this.history.unshift(evaluation);
    if (this.history.length > 100) this.history.length = 100;
    this.emit();
    return evaluation;
  }

  /** Look up the evaluation produced for a given pipeline id. */
  getForPipeline(pipeline_id: string): RegressionEvaluation | null {
    return this.history.find((e) => e.source_pipeline_id === pipeline_id) ?? null;
  }

  reset() {
    this.history = [];
    this.blocked.clear();
    this.nextId = 1;
    this.emit();
  }
}

function coupling(edges: number, components: number): number {
  return edges / Math.max(1, components);
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Read-only helper for callers that just want a previous-version reference. */
export function getPreviousVersion(): ArchitectureVersion | null {
  return versionedArchitectureStore.getState().current;
}

export const regressionGuard = new RegressionGuard();
