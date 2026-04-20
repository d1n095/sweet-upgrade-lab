/**
 * EVOLUTION GUARD
 *
 * Blocks evolution if:
 *   - architecture_score decreases
 *   - new violations appear
 *   - dependency graph worsens (more cycles or isolated nodes)
 */
import type { ExperimentSnapshot } from "./experimentMode";

export interface EvolutionGuardReport {
  evaluated_at: string;
  evolution_status: "ALLOWED" | "BLOCKED";
  reasons: ReadonlyArray<string>;
  before: ExperimentSnapshot;
  after: ExperimentSnapshot;
}

export function evaluateEvolutionGuard(
  before: ExperimentSnapshot,
  after: ExperimentSnapshot
): EvolutionGuardReport {
  const reasons: string[] = [];

  if (after.architecture_score < before.architecture_score) {
    reasons.push(
      `Score regressed (${before.architecture_score} → ${after.architecture_score}).`
    );
  }
  if (after.violation_count > before.violation_count) {
    reasons.push(
      `New violations introduced (${before.violation_count} → ${after.violation_count}).`
    );
  }
  if (after.circular_dependencies > before.circular_dependencies) {
    reasons.push(
      `New circular dependency chain(s): ${before.circular_dependencies} → ${after.circular_dependencies}.`
    );
  }
  if (after.isolated_nodes > before.isolated_nodes) {
    reasons.push(
      `More isolated modules: ${before.isolated_nodes} → ${after.isolated_nodes}.`
    );
  }

  return Object.freeze({
    evaluated_at: new Date().toISOString(),
    evolution_status: reasons.length === 0 ? "ALLOWED" : "BLOCKED",
    reasons: Object.freeze(reasons),
    before,
    after,
  });
}
