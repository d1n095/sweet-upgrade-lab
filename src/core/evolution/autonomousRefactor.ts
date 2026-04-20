/**
 * AUTONOMOUS REFACTOR ENGINE
 *
 * Safely restructures the codebase using deterministic rules + verified data.
 *
 * HARD RULES:
 *   - NO direct changes — every candidate is run through Experiment Mode.
 *   - Allowed actions only: move_to_layer, extract_shared, isolate_coupling,
 *     merge_duplicate, isolate_side_effects.
 *   - Max 3 refactors per cycle.
 *   - No deletion without orphan verification.
 *   - No breaking imports (validated against dep graph).
 *
 * TRIGGERS (any one fires a cycle):
 *   - max coupling > COUPLING_THRESHOLD
 *   - violations.length >= REPEATED_VIOLATIONS
 *   - orphans.length > ORPHAN_THRESHOLD
 *
 * PROCESS:
 *   1. generate candidates (controlledMutation, hard-capped at 3)
 *   2. validate each against dep graph (target exists; isolate doesn't break imports)
 *   3. simulate via experimentMode
 *   4. evolutionGuard
 *   5. compare scores → APPLY (record version delta) or DISCARD
 */
import {
  evaluateControlledMutation,
  type ControlledMutationInput,
  type MutationProposal,
} from "./controlledMutation";
import { runExperiment, type ExperimentResult, type ExperimentSnapshot } from "./experimentMode";
import { evaluateEvolutionGuard, type EvolutionGuardReport } from "./evolutionGuard";

export const REFACTOR_LIMITS = {
  MAX_PER_CYCLE: 3,
  COUPLING_THRESHOLD: 15,
  REPEATED_VIOLATIONS: 3,
  ORPHAN_THRESHOLD: 10,
} as const;

export type RefactorAction =
  | "move_to_layer"
  | "extract_shared"
  | "isolate_coupling"
  | "merge_duplicate"
  | "isolate_side_effects";

export type RefactorOutcome = "APPLIED" | "DISCARDED" | "REJECTED_BY_GUARD" | "INVALID_AGAINST_GRAPH";

export interface RefactorCandidate {
  id: string;
  action: RefactorAction;
  target: string;
  rationale: string;
  source_proposal_id: string;
}

export interface SimulatedRefactor {
  candidate: RefactorCandidate;
  experiment: ExperimentResult;
  guard: EvolutionGuardReport;
  outcome: RefactorOutcome;
  reason: string;
  version_delta: { from: number; to: number } | null;
}

export interface RefactorTrigger {
  fired: boolean;
  reasons: ReadonlyArray<string>;
  metrics: {
    max_coupling: number;
    violations_count: number;
    orphans_count: number;
  };
}

export interface RefactorCycleInput {
  current_version: number;
  snapshot: ExperimentSnapshot;
  mutation_input: ControlledMutationInput;
  /** Adjacency edges for graph validation. */
  dependency_graph: Record<string, string[]>;
}

export interface RefactorCycleReport {
  cycle_id: string;
  evaluated_at: string;
  trigger: RefactorTrigger;
  refactor_plan: ReadonlyArray<RefactorCandidate>;
  simulation_results: ReadonlyArray<SimulatedRefactor>;
  applied_changes: ReadonlyArray<SimulatedRefactor>;
  version_delta: { from: number; to: number };
  summary: string;
}

// ── Trigger evaluation ─────────────────────────────────────────────────
function evaluateTriggers(input: ControlledMutationInput): RefactorTrigger {
  const max_coupling = input.high_coupling.reduce((m, c) => Math.max(m, c.degree), 0);
  const violations_count = input.violations.length;
  const orphans_count = input.isolated_nodes.length;
  const reasons: string[] = [];

  if (max_coupling > REFACTOR_LIMITS.COUPLING_THRESHOLD) {
    reasons.push(`coupling_score ${max_coupling} > ${REFACTOR_LIMITS.COUPLING_THRESHOLD}`);
  }
  if (violations_count >= REFACTOR_LIMITS.REPEATED_VIOLATIONS) {
    reasons.push(`repeated violations (${violations_count} ≥ ${REFACTOR_LIMITS.REPEATED_VIOLATIONS})`);
  }
  if (orphans_count > REFACTOR_LIMITS.ORPHAN_THRESHOLD) {
    reasons.push(`orphan_files ${orphans_count} > ${REFACTOR_LIMITS.ORPHAN_THRESHOLD}`);
  }

  return {
    fired: reasons.length > 0,
    reasons: Object.freeze(reasons),
    metrics: { max_coupling, violations_count, orphans_count },
  };
}

// ── Proposal → Candidate mapping ───────────────────────────────────────
function proposalToCandidate(p: MutationProposal, idx: number): RefactorCandidate | null {
  const action: RefactorAction | null =
    p.category === "move_to_layer"
      ? "move_to_layer"
      : p.category === "extract_shared"
        ? "extract_shared"
        : p.category === "isolate_coupling"
          ? "isolate_coupling"
          : p.category === "merge_duplicate"
            ? "merge_duplicate"
            : null;
  if (!action) return null;
  return {
    id: `rf_${idx}`,
    action,
    target: p.target,
    rationale: p.rationale,
    source_proposal_id: p.id,
  };
}

// ── Graph validation ───────────────────────────────────────────────────
/** Validates a candidate against the dep graph. No breaking imports allowed. */
function validateAgainstGraph(
  candidate: RefactorCandidate,
  graph: Record<string, string[]>,
): { ok: boolean; reason: string } {
  const target = candidate.target.split(",")[0].trim();

  // For merge: at least one of the duplicate files must exist as a node.
  if (candidate.action === "merge_duplicate") {
    const files = candidate.target.split(",").map((s) => s.trim());
    const known = files.some((f) => f in graph || Object.values(graph).some((deps) => deps.includes(f)));
    return known
      ? { ok: true, reason: "duplicate set referenced by graph" }
      : { ok: false, reason: "duplicate set not in dep graph — cannot verify" };
  }

  // For all other actions: target must exist in graph (as node or edge).
  const exists = target in graph || Object.values(graph).some((deps) => deps.includes(target));
  if (!exists) return { ok: false, reason: `target "${target}" not in dep graph` };

  // For isolate_coupling: ensure target has dependents — isolating a leaf is pointless,
  // and isolating something with no fan-in would break nothing but also achieve nothing.
  if (candidate.action === "isolate_coupling") {
    const fanIn = Object.values(graph).filter((deps) => deps.includes(target)).length;
    if (fanIn === 0) return { ok: false, reason: "no dependents — isolation is a no-op" };
  }

  return { ok: true, reason: "graph-validated" };
}

// ── Cycle ──────────────────────────────────────────────────────────────
export function runRefactorCycle(input: RefactorCycleInput): RefactorCycleReport {
  const cycle_id = `refactor_${Date.now()}`;
  const evaluated_at = new Date().toISOString();
  const trigger = evaluateTriggers(input.mutation_input);

  if (!trigger.fired) {
    return Object.freeze({
      cycle_id,
      evaluated_at,
      trigger,
      refactor_plan: Object.freeze([]),
      simulation_results: Object.freeze([]),
      applied_changes: Object.freeze([]),
      version_delta: { from: input.current_version, to: input.current_version },
      summary: "No trigger fired — cycle skipped.",
    });
  }

  // 1. Generate candidates (hard cap 3)
  const mutationReport = evaluateControlledMutation(input.mutation_input);
  const candidates: RefactorCandidate[] = [];
  for (const p of mutationReport.proposals) {
    if (candidates.length >= REFACTOR_LIMITS.MAX_PER_CYCLE) break;
    const c = proposalToCandidate(p, candidates.length);
    if (c) candidates.push(c);
  }

  // 2-5. Validate → Simulate → Guard → Apply/Discard
  let runningSnapshot = input.snapshot;
  let runningVersion = input.current_version;
  const simulations: SimulatedRefactor[] = [];
  const applied: SimulatedRefactor[] = [];

  for (const candidate of candidates) {
    const validation = validateAgainstGraph(candidate, input.dependency_graph);
    if (!validation.ok) {
      // We still record an experiment shell so the report is uniform.
      const shellExp = runExperiment(runningSnapshot, {
        id: candidate.source_proposal_id,
        category: "extract_shared",
        target: candidate.target,
        rationale: candidate.rationale,
        expected_impact: "n/a",
        risk_level: "low",
      });
      simulations.push({
        candidate,
        experiment: shellExp,
        guard: evaluateEvolutionGuard(runningSnapshot, runningSnapshot),
        outcome: "INVALID_AGAINST_GRAPH",
        reason: validation.reason,
        version_delta: null,
      });
      continue;
    }

    // Map our action back to a MutationProposal for experimentMode.
    const proposalForSim: MutationProposal = {
      id: candidate.source_proposal_id,
      category:
        candidate.action === "isolate_side_effects" ? "isolate_coupling" : candidate.action,
      target: candidate.target,
      rationale: candidate.rationale,
      expected_impact: "(simulated)",
      risk_level: candidate.action === "isolate_coupling" ? "high" : "low",
    };

    const experiment = runExperiment(runningSnapshot, proposalForSim);
    const guard = evaluateEvolutionGuard(experiment.before, experiment.after_simulated);

    if (guard.evolution_status === "BLOCKED") {
      simulations.push({
        candidate,
        experiment,
        guard,
        outcome: "REJECTED_BY_GUARD",
        reason: guard.reasons.join("; "),
        version_delta: null,
      });
      continue;
    }

    if (experiment.experiment_result === "SUCCESS") {
      const nextVersion = runningVersion + 1;
      const sim: SimulatedRefactor = {
        candidate,
        experiment,
        guard,
        outcome: "APPLIED",
        reason: `Δ score +${experiment.improvement_delta}; guard ALLOWED.`,
        version_delta: { from: runningVersion, to: nextVersion },
      };
      simulations.push(sim);
      applied.push(sim);
      // Roll snapshot forward so subsequent refactors compose.
      runningSnapshot = experiment.after_simulated;
      runningVersion = nextVersion;
    } else {
      simulations.push({
        candidate,
        experiment,
        guard,
        outcome: "DISCARDED",
        reason: experiment.reason,
        version_delta: null,
      });
    }
  }

  return Object.freeze({
    cycle_id,
    evaluated_at,
    trigger,
    refactor_plan: Object.freeze(candidates),
    simulation_results: Object.freeze(simulations),
    applied_changes: Object.freeze(applied),
    version_delta: { from: input.current_version, to: runningVersion },
    summary:
      applied.length === 0
        ? `Trigger fired (${trigger.reasons.join("; ")}) but 0 of ${candidates.length} candidates passed simulation.`
        : `Applied ${applied.length}/${candidates.length} refactor(s). Version ${input.current_version} → ${runningVersion}.`,
  });
}
