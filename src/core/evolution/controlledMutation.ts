/**
 * CONTROLLED MUTATION
 *
 * Proposes ≤3 safe structural improvements per cycle.
 * Read-only — produces proposals, never applies anything.
 *
 * Categories:
 *   - move file to correct layer
 *   - extract shared logic
 *   - merge duplicates
 *   - isolate high-coupling node
 */

export type MutationCategory =
  | "move_to_layer"
  | "extract_shared"
  | "merge_duplicate"
  | "isolate_coupling";

export type MutationRisk = "low" | "medium" | "high";

export interface MutationProposal {
  id: string;
  category: MutationCategory;
  target: string;
  rationale: string;
  expected_impact: string;
  risk_level: MutationRisk;
}

export interface ControlledMutationInput {
  violations: ReadonlyArray<{ rule: string; file: string }>;
  isolated_nodes: ReadonlyArray<string>;
  high_coupling: ReadonlyArray<{ file: string; degree: number }>;
  duplicates: ReadonlyArray<{ files: string[] }>;
}

export interface ControlledMutationReport {
  evaluated_at: string;
  proposals: ReadonlyArray<MutationProposal>;
  overall_risk: MutationRisk;
  notes: string;
}

const MAX_MUTATIONS = 3;

const riskRank = (r: MutationRisk) =>
  r === "low" ? 0 : r === "medium" ? 1 : 2;

export function evaluateControlledMutation(
  input: ControlledMutationInput
): ControlledMutationReport {
  const proposals: MutationProposal[] = [];

  // Layer violations → propose move
  for (const v of input.violations) {
    if (proposals.length >= MAX_MUTATIONS) break;
    if (v.rule === "A1" || v.rule === "A2" || v.rule === "A3" || v.rule === "A4") {
      proposals.push({
        id: `mv_${proposals.length}`,
        category: "move_to_layer",
        target: v.file,
        rationale: `Violates ${v.rule} — wrong architectural layer.`,
        expected_impact: "Restores layer boundaries; no behavior change.",
        risk_level: "low",
      });
    }
  }

  // Duplicates → merge
  for (const d of input.duplicates) {
    if (proposals.length >= MAX_MUTATIONS) break;
    if (d.files.length >= 2) {
      proposals.push({
        id: `mg_${proposals.length}`,
        category: "merge_duplicate",
        target: d.files.join(", "),
        rationale: `Duplicate logic across ${d.files.length} files.`,
        expected_impact: "Single source of truth; reduced surface area.",
        risk_level: "medium",
      });
    }
  }

  // High coupling → isolate
  for (const c of input.high_coupling) {
    if (proposals.length >= MAX_MUTATIONS) break;
    if (c.degree >= 15) {
      proposals.push({
        id: `is_${proposals.length}`,
        category: "isolate_coupling",
        target: c.file,
        rationale: `Coupling degree ${c.degree} — too central.`,
        expected_impact: "Lower blast radius for changes.",
        risk_level: "high",
      });
    }
  }

  // Isolated → extract shared (gentle suggestion)
  for (const n of input.isolated_nodes) {
    if (proposals.length >= MAX_MUTATIONS) break;
    proposals.push({
      id: `ex_${proposals.length}`,
      category: "extract_shared",
      target: n,
      rationale: "Orphan module — likely dead or shareable.",
      expected_impact: "Either delete or promote to shared layer.",
      risk_level: "low",
    });
  }

  const overall_risk: MutationRisk =
    proposals.length === 0
      ? "low"
      : proposals.reduce<MutationRisk>(
          (acc, p) => (riskRank(p.risk_level) > riskRank(acc) ? p.risk_level : acc),
          "low"
        );

  return Object.freeze({
    evaluated_at: new Date().toISOString(),
    proposals: Object.freeze(proposals.slice(0, MAX_MUTATIONS)),
    overall_risk,
    notes:
      proposals.length === 0
        ? "No safe mutations available."
        : `${proposals.length} proposal(s). Must pass pipeline before apply.`,
  });
}
