/**
 * RISK HEATMAP — visual risk overlay derived from existing signals.
 *
 * Color logic (pure function of inputs, no thresholds smuggled in):
 *   - red    = frequently changing AND high dependency weight
 *   - orange = medium risk on either axis
 *   - green  = stable, low coupling
 *
 * Inputs are intentionally optional / soft — engine never crashes if a
 * signal is missing. Pure derivation, no mutation.
 */

export type RiskColor = "red" | "orange" | "green" | "grey";

export interface RiskInputs {
  /** edge map: file -> imported files */
  edges: Record<string, string[]>;
  /** how many times each file appears in the change_log (0 if unknown) */
  change_frequency?: Record<string, number>;
  /** how many bug reports / failures reference each file */
  bug_density?: Record<string, number>;
}

export interface RiskNode {
  file: string;
  dep_weight: number;        // in_degree + out_degree
  change_count: number;
  bug_count: number;
  risk_score: number;        // 0..100
  color: RiskColor;
  reason: string;
}

export interface RiskHeatmapReport {
  generated_at: string;
  nodes: ReadonlyArray<RiskNode>;
  totals: { red: number; orange: number; green: number; grey: number };
  hotspots: ReadonlyArray<RiskNode>;   // top-10 red
  notes: string;
}

function colorFor(score: number, dep: number, changes: number): { c: RiskColor; r: string } {
  if (dep === 0 && changes === 0) return { c: "grey", r: "Untouched + unconnected." };
  if (score >= 60) return { c: "red", r: "High change frequency × high dependency weight." };
  if (score >= 30) return { c: "orange", r: "Medium risk on at least one axis." };
  return { c: "green", r: "Stable + low coupling." };
}

export function buildRiskHeatmap(inputs: RiskInputs): RiskHeatmapReport {
  const edges = inputs.edges;
  const cf = inputs.change_frequency ?? {};
  const bd = inputs.bug_density ?? {};

  const all = new Set<string>(Object.keys(edges));
  for (const ds of Object.values(edges)) for (const d of ds) all.add(d);
  for (const k of Object.keys(cf)) all.add(k);
  for (const k of Object.keys(bd)) all.add(k);

  const inDeg: Record<string, number> = {};
  const outDeg: Record<string, number> = {};
  for (const [f, ds] of Object.entries(edges)) {
    outDeg[f] = (outDeg[f] ?? 0) + ds.length;
    for (const d of ds) inDeg[d] = (inDeg[d] ?? 0) + 1;
  }

  // normalize axes (0..1) using max-found values to avoid magic numbers
  let maxDep = 0, maxChange = 0, maxBug = 0;
  for (const f of all) {
    const dep = (inDeg[f] ?? 0) + (outDeg[f] ?? 0);
    if (dep > maxDep) maxDep = dep;
    if ((cf[f] ?? 0) > maxChange) maxChange = cf[f] ?? 0;
    if ((bd[f] ?? 0) > maxBug) maxBug = bd[f] ?? 0;
  }

  const nodes: RiskNode[] = [];
  const totals = { red: 0, orange: 0, green: 0, grey: 0 };

  for (const f of all) {
    const dep = (inDeg[f] ?? 0) + (outDeg[f] ?? 0);
    const ch = cf[f] ?? 0;
    const bg = bd[f] ?? 0;
    const depN = maxDep ? dep / maxDep : 0;
    const chN = maxChange ? ch / maxChange : 0;
    const bgN = maxBug ? bg / maxBug : 0;
    // weighted: dependency 40, change 40, bug 20
    const score = Math.round((depN * 0.4 + chN * 0.4 + bgN * 0.2) * 100);
    const { c, r } = colorFor(score, dep, ch);
    totals[c]++;
    nodes.push({
      file: f,
      dep_weight: dep,
      change_count: ch,
      bug_count: bg,
      risk_score: score,
      color: c,
      reason: r,
    });
  }

  nodes.sort((a, b) => b.risk_score - a.risk_score);
  const hotspots = nodes.filter((n) => n.color === "red").slice(0, 10);

  return Object.freeze({
    generated_at: new Date().toISOString(),
    nodes: Object.freeze(nodes),
    totals,
    hotspots: Object.freeze(hotspots),
    notes:
      hotspots.length === 0
        ? "No red hotspots — codebase risk profile looks healthy."
        : `${hotspots.length} red hotspot(s) — review before large refactors.`,
  });
}
