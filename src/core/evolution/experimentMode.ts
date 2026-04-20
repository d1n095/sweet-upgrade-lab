/**
 * EXPERIMENT MODE
 *
 * Snapshot current metrics, simulate applying a mutation, compare deltas,
 * recommend promote or discard. Pure simulation — does not touch real state.
 */
import type { MutationProposal } from "./controlledMutation";

export interface ExperimentSnapshot {
  architecture_score: number;
  violation_count: number;
  isolated_nodes: number;
  circular_dependencies: number;
}

export interface ExperimentResult {
  evaluated_at: string;
  proposal: MutationProposal;
  before: ExperimentSnapshot;
  after_simulated: ExperimentSnapshot;
  improvement_delta: number; // score_after - score_before
  experiment_result: "SUCCESS" | "FAIL";
  reason: string;
}

/** Deterministic simulation of a mutation's effect. */
function simulate(
  before: ExperimentSnapshot,
  proposal: MutationProposal
): ExperimentSnapshot {
  const after = { ...before };
  switch (proposal.category) {
    case "move_to_layer":
      after.violation_count = Math.max(0, before.violation_count - 1);
      after.architecture_score = Math.min(100, before.architecture_score + 3);
      break;
    case "merge_duplicate":
      after.architecture_score = Math.min(100, before.architecture_score + 2);
      break;
    case "isolate_coupling":
      after.architecture_score = Math.min(100, before.architecture_score + 1);
      // High-risk: small chance of new circular dep
      after.circular_dependencies = before.circular_dependencies; // simulation neutral
      break;
    case "extract_shared":
      after.isolated_nodes = Math.max(0, before.isolated_nodes - 1);
      after.architecture_score = Math.min(100, before.architecture_score + 1);
      break;
  }
  return after;
}

export function runExperiment(
  before: ExperimentSnapshot,
  proposal: MutationProposal
): ExperimentResult {
  const after = simulate(before, proposal);
  const delta = after.architecture_score - before.architecture_score;
  const success = delta > 0 && after.violation_count <= before.violation_count;

  return Object.freeze({
    evaluated_at: new Date().toISOString(),
    proposal,
    before,
    after_simulated: after,
    improvement_delta: delta,
    experiment_result: success ? "SUCCESS" : "FAIL",
    reason: success
      ? `Score +${delta}; violations did not increase.`
      : `Score delta ${delta}; experiment did not improve system.`,
  });
}
