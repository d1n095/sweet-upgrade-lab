/**
 * CROSS-SYSTEM EVOLUTION LOOP
 *
 * Evolves architecture across multiple projects using shared learnings.
 *
 * 6-STEP LOOP (deterministic, no forced changes):
 *   1. accept per-project pipeline reports
 *   2. collect pattern_memory per project
 *   3. aggregate global patterns (via multiProjectConsciousness)
 *   4. evolve global rules from recurring fixed-violations + shared patterns
 *   5. distribute rules → each project validates locally and decides adoption
 *   6. compute adoption_rate + improvement_metrics
 *
 * RULES:
 *   - no forced changes (every project votes ACCEPT/REJECT/DEFER)
 *   - each project validates independently (local compatibility check)
 *   - rules must be deterministic (same input → same output)
 */
import {
  buildConsciousness,
  type ProjectSnapshot,
  type ConsciousnessReport,
  type RecommendedGlobalRule,
} from "./multiProjectConsciousness";

export interface ProjectPipelineReport {
  snapshot: ProjectSnapshot;
  /** Architecture score before this evolution loop ran. */
  baseline_score: number;
  /** Score after applying its own pipeline this cycle. */
  post_pipeline_score: number;
  /** Rules this project's local validator considers compatible. */
  locally_compatible_rules: ReadonlyArray<string>;
}

export interface CrossSystemEvolutionInput {
  cycle_id?: string;
  reports: ReadonlyArray<ProjectPipelineReport>;
  /** Rules already adopted globally — used to skip duplicates. */
  existing_global_rules: ReadonlyArray<string>;
}

export type AdoptionVote = "ACCEPTED" | "REJECTED" | "DEFERRED";

export interface ProjectAdoptionDecision {
  project_id: string;
  rule: string;
  vote: AdoptionVote;
  reason: string;
}

export interface EvolvedGlobalRule {
  rule: string;
  source_projects: ReadonlyArray<string>;
  reason: string;
  is_new: boolean;
  adoption: ReadonlyArray<ProjectAdoptionDecision>;
  adoption_rate: number; // 0..1
}

export interface ImprovementMetric {
  project_id: string;
  baseline: number;
  post_pipeline: number;
  delta: number;
}

export interface CrossSystemEvolutionReport {
  cycle_id: string;
  generated_at: string;
  consciousness: ConsciousnessReport;
  evolved_global_rules: ReadonlyArray<EvolvedGlobalRule>;
  improvement_metrics: ReadonlyArray<ImprovementMetric>;
  overall_adoption_rate: number;
  summary: string;
}

// ── Local validation (deterministic) ───────────────────────────────────

/**
 * A project ACCEPTS a rule when:
 *   - it's already in their locally_compatible_rules list, OR
 *   - it appears in their enforced_rules (already aligned)
 * REJECTS when:
 *   - they have an open violation of this exact rule (would block CI)
 * DEFERS otherwise (they need to assess; not a hard no).
 */
function decideAdoption(
  rule: string,
  report: ProjectPipelineReport,
): ProjectAdoptionDecision {
  const { snapshot } = report;
  const enforced = new Set(snapshot.enforced_rules);
  const locallyOk = new Set(report.locally_compatible_rules);
  const violating = snapshot.violations.some((v) => v.rule === rule);

  if (locallyOk.has(rule) || enforced.has(rule)) {
    return {
      project_id: snapshot.project_id,
      rule,
      vote: "ACCEPTED",
      reason: enforced.has(rule)
        ? "Already enforced locally."
        : "Marked locally compatible.",
    };
  }
  if (violating) {
    return {
      project_id: snapshot.project_id,
      rule,
      vote: "REJECTED",
      reason: "Open violation would block adoption — fix locally first.",
    };
  }
  return {
    project_id: snapshot.project_id,
    rule,
    vote: "DEFERRED",
    reason: "No conflict, but no explicit local compatibility signal yet.",
  };
}

// ── Rule evolution ─────────────────────────────────────────────────────

function evolveRules(
  recommended: ReadonlyArray<RecommendedGlobalRule>,
  reports: ReadonlyArray<ProjectPipelineReport>,
  existing: ReadonlyArray<string>,
): EvolvedGlobalRule[] {
  const existingSet = new Set(existing);
  const evolved: EvolvedGlobalRule[] = [];

  for (const rec of recommended) {
    const decisions = reports.map((r) => decideAdoption(rec.rule, r));
    const accepted = decisions.filter((d) => d.vote === "ACCEPTED").length;
    const adoption_rate = decisions.length === 0 ? 0 : accepted / decisions.length;

    evolved.push({
      rule: rec.rule,
      source_projects: rec.source_projects,
      reason: rec.reason,
      is_new: !existingSet.has(rec.rule),
      adoption: Object.freeze(decisions),
      adoption_rate,
    });
  }

  // Stable order: new rules first, then highest adoption first
  evolved.sort((a, b) => {
    if (a.is_new !== b.is_new) return a.is_new ? -1 : 1;
    return b.adoption_rate - a.adoption_rate;
  });
  return evolved;
}

// ── Public API ─────────────────────────────────────────────────────────

export function runCrossSystemEvolution(
  input: CrossSystemEvolutionInput,
): CrossSystemEvolutionReport {
  const cycle_id = input.cycle_id ?? `xse_${Date.now()}`;
  const generated_at = new Date().toISOString();

  // Steps 1-3: pipeline reports already provided; aggregate via consciousness layer.
  const consciousness = buildConsciousness(input.reports.map((r) => r.snapshot));

  // Step 4: evolve rules from consciousness recommendations.
  const evolved_global_rules = evolveRules(
    consciousness.recommended_global_rules,
    input.reports,
    input.existing_global_rules,
  );

  // Step 5: distribution + local validation already encoded in adoption votes.

  // Step 6: improvement metrics per project.
  const improvement_metrics: ImprovementMetric[] = input.reports.map((r) => ({
    project_id: r.snapshot.project_id,
    baseline: r.baseline_score,
    post_pipeline: r.post_pipeline_score,
    delta: r.post_pipeline_score - r.baseline_score,
  }));

  const totalDecisions = evolved_global_rules.reduce((a, r) => a + r.adoption.length, 0);
  const totalAccepted = evolved_global_rules.reduce(
    (a, r) => a + r.adoption.filter((d) => d.vote === "ACCEPTED").length,
    0,
  );
  const overall_adoption_rate = totalDecisions === 0 ? 0 : totalAccepted / totalDecisions;

  const newRuleCount = evolved_global_rules.filter((r) => r.is_new).length;

  return Object.freeze({
    cycle_id,
    generated_at,
    consciousness,
    evolved_global_rules: Object.freeze(evolved_global_rules),
    improvement_metrics: Object.freeze(improvement_metrics),
    overall_adoption_rate,
    summary:
      input.reports.length === 0
        ? "No project reports — nothing to evolve."
        : `${input.reports.length} project(s) · ${evolved_global_rules.length} rule candidate(s) (${newRuleCount} new) · adoption ${(overall_adoption_rate * 100).toFixed(0)}%.`,
  });
}
