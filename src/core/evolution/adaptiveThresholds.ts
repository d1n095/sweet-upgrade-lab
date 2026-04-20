/**
 * ADAPTIVE THRESHOLDS
 *
 * Adjusts strictness based on architecture_score history.
 *   IF score improves over 3 versions → tighten thresholds
 *   IF score drops                    → loosen temporarily
 *
 * Pure-read. Outputs new_thresholds + change_reason. Does NOT mutate
 * any other engine — engines that opt in must read these values.
 */

export interface ThresholdSet {
  allowed_orphans: number;
  allowed_coupling: number;
  allowed_violations: number;
}

export interface AdaptiveThresholdReport {
  evaluated_at: string;
  current: ThresholdSet;
  previous: ThresholdSet;
  change_reason: string;
  trend: "improving" | "declining" | "stable" | "insufficient_data";
  history_used: number;
}

const BASELINE: ThresholdSet = {
  allowed_orphans: 10,
  allowed_coupling: 20,
  allowed_violations: 5,
};

const MIN: ThresholdSet = {
  allowed_orphans: 2,
  allowed_coupling: 8,
  allowed_violations: 0,
};

const MAX: ThresholdSet = {
  allowed_orphans: 25,
  allowed_coupling: 40,
  allowed_violations: 15,
};

let LAST: ThresholdSet = { ...BASELINE };

const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

export function evaluateAdaptiveThresholds(
  scoreHistory: ReadonlyArray<number>
): AdaptiveThresholdReport {
  const previous = { ...LAST };
  const evaluated_at = new Date().toISOString();

  if (scoreHistory.length < 3) {
    return Object.freeze({
      evaluated_at,
      current: previous,
      previous,
      change_reason: "Need at least 3 versions of scoring history.",
      trend: "insufficient_data",
      history_used: scoreHistory.length,
    });
  }

  const last3 = scoreHistory.slice(0, 3);
  const improving = last3[0] > last3[1] && last3[1] > last3[2];
  const declining = last3[0] < last3[1] && last3[1] < last3[2];

  let next = { ...previous };
  let change_reason = "Score is stable — thresholds unchanged.";
  let trend: AdaptiveThresholdReport["trend"] = "stable";

  if (improving) {
    next = {
      allowed_orphans: clamp(previous.allowed_orphans - 1, MIN.allowed_orphans, MAX.allowed_orphans),
      allowed_coupling: clamp(previous.allowed_coupling - 2, MIN.allowed_coupling, MAX.allowed_coupling),
      allowed_violations: clamp(previous.allowed_violations - 1, MIN.allowed_violations, MAX.allowed_violations),
    };
    change_reason = `Score improved across 3 versions (${last3.join(" → ")}) — strictness increased.`;
    trend = "improving";
  } else if (declining) {
    next = {
      allowed_orphans: clamp(previous.allowed_orphans + 2, MIN.allowed_orphans, MAX.allowed_orphans),
      allowed_coupling: clamp(previous.allowed_coupling + 3, MIN.allowed_coupling, MAX.allowed_coupling),
      allowed_violations: clamp(previous.allowed_violations + 2, MIN.allowed_violations, MAX.allowed_violations),
    };
    change_reason = `Score declined across 3 versions (${last3.join(" → ")}) — strictness loosened temporarily.`;
    trend = "declining";
  }

  LAST = next;

  return Object.freeze({
    evaluated_at,
    current: next,
    previous,
    change_reason,
    trend,
    history_used: last3.length,
  });
}

export function getCurrentThresholds(): ThresholdSet {
  return { ...LAST };
}

export function resetAdaptiveThresholds() {
  LAST = { ...BASELINE };
}
