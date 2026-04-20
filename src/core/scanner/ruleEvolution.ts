/**
 * RULE EVOLUTION ENGINE
 *
 * GOAL: Improve rules based on historical patterns.
 *
 * INPUT (read-only):
 *   - patternMemory.getState()    → repeated_violations, stable_files,
 *                                   frequently_moved_files, entries[]
 *   - regressionGuard.getState()  → history of regression evaluations
 *
 * RULES (pure counting, deterministic — NO interpretation):
 *   R1. IF same violation key (rule::file) appears in ≥ UPGRADE_THRESHOLD
 *       distinct versions   → mark as CRITICAL RULE ("upgraded").
 *   R2. IF a previously-seen violation key is ABSENT in the latest
 *       DOWNGRADE_THRESHOLD consecutive observations → mark as
 *       "downgraded" severity.
 *   R3. IF a file is present in EVERY observation (stable_files) AND has
 *       NEVER appeared in any violation → mark as "ENFORCED_STANDARD".
 *
 * OUTPUT:
 *   - evolved_rules          : all rule states after evolution
 *   - upgraded_rules         : rules whose severity just rose to CRITICAL
 *   - downgraded_rules       : rules whose severity was lowered
 *   - enforced_standards     : stable, violation-free files
 *
 * AUTHORITY: READ_ONLY_REPORTER. Cannot stop execution, cannot mutate
 * patternMemory or regressionGuard. Pure derivation from their state.
 */
import { patternMemory, type PatternMemoryEntry } from "@/core/scanner/patternMemory";
import { regressionGuard } from "@/core/scanner/regressionGuard";

export const UPGRADE_THRESHOLD = 3;
export const DOWNGRADE_THRESHOLD = 3;

export type RuleSeverity = "INFO" | "WARNING" | "CRITICAL" | "DOWNGRADED";
export type RuleChange = "UPGRADED" | "DOWNGRADED" | "UNCHANGED" | "NEW";

export interface EvolvedRule {
  readonly key: string; // rule::file
  readonly rule: string;
  readonly file: string;
  readonly severity: RuleSeverity;
  readonly change: RuleChange;
  readonly occurrences: number;
  readonly versions_seen: ReadonlyArray<string>;
  readonly absent_streak: number; // consecutive latest versions without this violation
  readonly reason: string;
}

export interface EnforcedStandard {
  readonly file: string;
  readonly observations_present: number;
  readonly reason: string;
}

export interface RuleEvolutionReport {
  readonly generated_at: string;
  readonly observations_considered: number;
  readonly upgrade_threshold: number;
  readonly downgrade_threshold: number;
  readonly evolved_rules: ReadonlyArray<EvolvedRule>;
  readonly upgraded_rules: ReadonlyArray<EvolvedRule>;
  readonly downgraded_rules: ReadonlyArray<EvolvedRule>;
  readonly enforced_standards: ReadonlyArray<EnforcedStandard>;
  readonly regression_history_length: number;
}

function computeAbsentStreak(
  entries: ReadonlyArray<PatternMemoryEntry>,
  key: string
): number {
  // entries are newest-first. Count leading entries where key is absent.
  let streak = 0;
  for (const e of entries) {
    const present = e.violations.some((v) => v.key === key);
    if (present) break;
    streak++;
  }
  return streak;
}

export function runRuleEvolution(): RuleEvolutionReport {
  const pm = patternMemory.getState();
  const rg = regressionGuard.getState();

  const evolved: EvolvedRule[] = [];
  const upgraded: EvolvedRule[] = [];
  const downgraded: EvolvedRule[] = [];

  for (const rv of pm.repeated_violations) {
    const absent_streak = computeAbsentStreak(pm.entries, rv.key);
    let severity: RuleSeverity;
    let change: RuleChange;
    let reason: string;

    if (rv.occurrences >= UPGRADE_THRESHOLD) {
      severity = "CRITICAL";
      change = "UPGRADED";
      reason = `seen in ${rv.occurrences} versions (≥ ${UPGRADE_THRESHOLD})`;
      upgraded.push(
        Object.freeze({
          key: rv.key,
          rule: rv.rule,
          file: rv.file,
          severity,
          change,
          occurrences: rv.occurrences,
          versions_seen: [...rv.versions],
          absent_streak,
          reason,
        })
      );
    } else if (absent_streak >= DOWNGRADE_THRESHOLD) {
      severity = "DOWNGRADED";
      change = "DOWNGRADED";
      reason = `absent in last ${absent_streak} observations (≥ ${DOWNGRADE_THRESHOLD})`;
      downgraded.push(
        Object.freeze({
          key: rv.key,
          rule: rv.rule,
          file: rv.file,
          severity,
          change,
          occurrences: rv.occurrences,
          versions_seen: [...rv.versions],
          absent_streak,
          reason,
        })
      );
    } else {
      severity = rv.occurrences >= 2 ? "WARNING" : "INFO";
      change = pm.entries.length === 1 ? "NEW" : "UNCHANGED";
      reason = `seen in ${rv.occurrences} version(s); absent streak ${absent_streak}`;
    }

    evolved.push(
      Object.freeze({
        key: rv.key,
        rule: rv.rule,
        file: rv.file,
        severity,
        change,
        occurrences: rv.occurrences,
        versions_seen: [...rv.versions],
        absent_streak,
        reason,
      })
    );
  }

  evolved.sort((a, b) => {
    const order: Record<RuleSeverity, number> = {
      CRITICAL: 0,
      WARNING: 1,
      INFO: 2,
      DOWNGRADED: 3,
    };
    return order[a.severity] - order[b.severity] || b.occurrences - a.occurrences;
  });

  // ENFORCED STANDARDS: stable files that never appeared in any violation.
  const violatedFiles = new Set<string>();
  for (const rv of pm.repeated_violations) violatedFiles.add(rv.file);
  const enforced: EnforcedStandard[] = pm.stable_files
    .filter((f) => !violatedFiles.has(f))
    .map((f) =>
      Object.freeze({
        file: f,
        observations_present: pm.total_observations,
        reason: `present in all ${pm.total_observations} observations and never violated`,
      })
    );

  return Object.freeze({
    generated_at: new Date().toISOString(),
    observations_considered: pm.total_observations,
    upgrade_threshold: UPGRADE_THRESHOLD,
    downgrade_threshold: DOWNGRADE_THRESHOLD,
    evolved_rules: Object.freeze(evolved),
    upgraded_rules: Object.freeze(upgraded),
    downgraded_rules: Object.freeze(downgraded),
    enforced_standards: Object.freeze(enforced),
    regression_history_length: rg.history.length,
  });
}
