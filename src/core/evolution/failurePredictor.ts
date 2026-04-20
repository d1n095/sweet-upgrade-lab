/**
 * FAILURE PREDICTOR
 *
 * Predicts likely failures before they happen using:
 *   - dependency stress       (in/out degree of edited file)
 *   - recent changes          (change_log freq per file)
 *   - historical break pattern (functional_failure_memory occurrences)
 *
 * Outputs "if you change X → Y will break" predictions, suggest-only.
 */

export interface FailurePredictorInput {
  edges: Record<string, string[]>;
  change_counts?: Record<string, number>;
  failure_counts?: Record<string, number>; // file → historical failure occurrences
}

export interface RiskEdit {
  file: string;
  stress: number;
  recent_changes: number;
  past_failures: number;
  risk_score: number;
  reason: string;
}

export interface CascadeChain {
  source: string;
  predicted_breakage: ReadonlyArray<string>;
  hops: number;
  confidence: "low" | "medium" | "high";
}

export interface FailurePrediction {
  if_change: string;
  then_break: string;
  why: string;
}

export interface FailurePredictorReport {
  generated_at: string;
  high_risk_edits: ReadonlyArray<RiskEdit>;
  cascading_zones: ReadonlyArray<CascadeChain>;
  predictions: ReadonlyArray<FailurePrediction>;
  notes: string;
}

function reverseIndex(edges: Record<string, string[]>): Record<string, string[]> {
  const rev: Record<string, string[]> = {};
  for (const [from, deps] of Object.entries(edges)) {
    for (const to of deps) (rev[to] ??= []).push(from);
  }
  return rev;
}

export function predictFailures(input: FailurePredictorInput): FailurePredictorReport {
  const edges = input.edges ?? {};
  const change = input.change_counts ?? {};
  const fail = input.failure_counts ?? {};

  const reverse = reverseIndex(edges);

  const allFiles = new Set<string>(Object.keys(edges));
  for (const deps of Object.values(edges)) for (const d of deps) allFiles.add(d);

  const inDeg: Record<string, number> = {};
  const outDeg: Record<string, number> = {};
  for (const [from, deps] of Object.entries(edges)) {
    outDeg[from] = deps.length;
    for (const to of deps) inDeg[to] = (inDeg[to] ?? 0) + 1;
  }

  const high_risk_edits: RiskEdit[] = [];
  for (const f of allFiles) {
    const stress = (inDeg[f] ?? 0) + (outDeg[f] ?? 0);
    const recent = change[f] ?? 0;
    const past = fail[f] ?? 0;
    const risk = stress + recent * 4 + past * 6;
    if (risk >= 12) {
      high_risk_edits.push({
        file: f,
        stress,
        recent_changes: recent,
        past_failures: past,
        risk_score: risk,
        reason:
          (recent >= 3 ? `${recent} recent edits. ` : "") +
          (past > 0 ? `${past} historical failure(s). ` : "") +
          (stress >= 8 ? `${stress} dependency edges.` : ""),
      });
    }
  }
  high_risk_edits.sort((a, b) => b.risk_score - a.risk_score);

  const cascading_zones: CascadeChain[] = [];
  for (const edit of high_risk_edits.slice(0, 5)) {
    const visited = new Set<string>([edit.file]);
    const queue: Array<[string, number]> = [[edit.file, 0]];
    const breaks: string[] = [];
    let maxHops = 0;
    while (queue.length) {
      const [n, d] = queue.shift()!;
      if (d >= 3) continue;
      for (const up of reverse[n] ?? []) {
        if (visited.has(up)) continue;
        visited.add(up);
        breaks.push(up);
        maxHops = Math.max(maxHops, d + 1);
        queue.push([up, d + 1]);
      }
    }
    if (breaks.length === 0) continue;
    const confidence: "low" | "medium" | "high" =
      edit.past_failures > 0 ? "high" : edit.recent_changes >= 3 ? "medium" : "low";
    cascading_zones.push({
      source: edit.file,
      predicted_breakage: breaks.slice(0, 8),
      hops: maxHops,
      confidence,
    });
  }

  const predictions: FailurePrediction[] = [];
  for (const z of cascading_zones) {
    for (const target of z.predicted_breakage.slice(0, 3)) {
      predictions.push({
        if_change: z.source,
        then_break: target,
        why: `${target} imports (transitively) from ${z.source}; ${z.confidence} confidence based on history + stress.`,
      });
    }
  }

  return Object.freeze({
    generated_at: new Date().toISOString(),
    high_risk_edits: Object.freeze(high_risk_edits.slice(0, 10)),
    cascading_zones: Object.freeze(cascading_zones),
    predictions: Object.freeze(predictions.slice(0, 12)),
    notes:
      high_risk_edits.length === 0
        ? "No high-risk edit candidates identified."
        : `${high_risk_edits.length} risky file(s); ${predictions.length} cascade prediction(s).`,
  });
}
