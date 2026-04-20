/**
 * EVOLUTION LOOP
 *
 * Orchestrates one cycle:
 *   1. read metrics from systemStateStore (already populated by pipeline)
 *   2. evaluate adaptive thresholds against score history
 *   3. ask controlledMutation for ≤1 proposal
 *   4. simulate via experimentMode
 *   5. apply evolutionGuard
 *   6. record cycle result
 *
 * Hard limit: max 1 evolution per cycle. Never auto-applies — only records.
 */
import { evaluateAdaptiveThresholds, type AdaptiveThresholdReport } from "./adaptiveThresholds";
import {
  evaluateControlledMutation,
  type ControlledMutationInput,
  type ControlledMutationReport,
} from "./controlledMutation";
import { runExperiment, type ExperimentResult, type ExperimentSnapshot } from "./experimentMode";
import { evaluateEvolutionGuard, type EvolutionGuardReport } from "./evolutionGuard";

export interface EvolutionCycleInput {
  scoreHistory: ReadonlyArray<number>;
  snapshot: ExperimentSnapshot;
  mutationInput: ControlledMutationInput;
}

export interface EvolutionCycleReport {
  cycle_id: string;
  evaluated_at: string;
  evolution_cycle_status: "PROMOTED" | "DISCARDED" | "NO_OP" | "BLOCKED";
  thresholds: AdaptiveThresholdReport;
  mutation: ControlledMutationReport;
  experiment: ExperimentResult | null;
  guard: EvolutionGuardReport | null;
  summary: string;
}

const MAX_PER_CYCLE = 1;

export function runEvolutionCycle(input: EvolutionCycleInput): EvolutionCycleReport {
  const cycle_id = `cycle_${Date.now()}`;
  const evaluated_at = new Date().toISOString();

  const thresholds = evaluateAdaptiveThresholds(input.scoreHistory);
  const mutation = evaluateControlledMutation(input.mutationInput);

  if (mutation.proposals.length === 0) {
    return Object.freeze({
      cycle_id,
      evaluated_at,
      evolution_cycle_status: "NO_OP",
      thresholds,
      mutation,
      experiment: null,
      guard: null,
      summary: "No proposals — nothing to evolve this cycle.",
    });
  }

  // Take only the first proposal — hard limit.
  const proposals = mutation.proposals.slice(0, MAX_PER_CYCLE);
  const experiment = runExperiment(input.snapshot, proposals[0]);
  const guard = evaluateEvolutionGuard(experiment.before, experiment.after_simulated);

  let status: EvolutionCycleReport["evolution_cycle_status"];
  let summary: string;

  if (guard.evolution_status === "BLOCKED") {
    status = "BLOCKED";
    summary = `Guard blocked promotion: ${guard.reasons.join("; ")}`;
  } else if (experiment.experiment_result === "SUCCESS") {
    status = "PROMOTED";
    summary = `Mutation promoted (Δ score ${experiment.improvement_delta}).`;
  } else {
    status = "DISCARDED";
    summary = `Experiment failed: ${experiment.reason}`;
  }

  return Object.freeze({
    cycle_id,
    evaluated_at,
    evolution_cycle_status: status,
    thresholds,
    mutation,
    experiment,
    guard,
    summary,
  });
}
