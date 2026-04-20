/**
 * LIVE SYSTEM MODEL
 *
 * Maintains a derived "live model" of the entire system from existing signals:
 *   - what depends on what       → dep graph adjacency + reverse adjacency
 *   - critical paths             → high-fanout chains (modules many things lead through)
 *   - fragile zones              → high churn × high coupling × bug density
 *
 * Pure derivation. No DOM, no network. Returns a frozen snapshot.
 */

export interface LiveModelInput {
  edges: Record<string, string[]>;
  change_counts?: Record<string, number>;
  bug_counts?: Record<string, number>;
}

export interface CriticalPath {
  hub: string;
  fanout: number;
  fanin: number;
  reach_score: number;
  reason: string;
}

export interface FragileZone {
  file: string;
  coupling: number;
  churn: number;
  bugs: number;
  fragility: number;
  reason: string;
}

export interface LiveModelReport {
  generated_at: string;
  totals: { nodes: number; edges: number };
  critical_paths: ReadonlyArray<CriticalPath>;
  fragile_zones: ReadonlyArray<FragileZone>;
  notes: string;
}

export function buildLiveSystemModel(input: LiveModelInput): LiveModelReport {
  const edges = input.edges ?? {};
  const change = input.change_counts ?? {};
  const bugs = input.bug_counts ?? {};

  const allFiles = new Set<string>(Object.keys(edges));
  for (const deps of Object.values(edges)) for (const d of deps) allFiles.add(d);

  const inDeg: Record<string, number> = {};
  const outDeg: Record<string, number> = {};
  for (const [from, deps] of Object.entries(edges)) {
    outDeg[from] = (outDeg[from] ?? 0) + deps.length;
    for (const to of deps) inDeg[to] = (inDeg[to] ?? 0) + 1;
  }
  let edgeCount = 0;
  for (const v of Object.values(outDeg)) edgeCount += v;

  const critical_paths: CriticalPath[] = [];
  for (const f of allFiles) {
    const i = inDeg[f] ?? 0;
    const o = outDeg[f] ?? 0;
    const reach = i * 2 + o;
    if (i >= 5 && reach >= 12) {
      critical_paths.push({
        hub: f,
        fanout: o,
        fanin: i,
        reach_score: reach,
        reason: `Module sits on ${i} import path(s); change here propagates broadly.`,
      });
    }
  }
  critical_paths.sort((a, b) => b.reach_score - a.reach_score);

  const fragile_zones: FragileZone[] = [];
  for (const f of allFiles) {
    const coupling = (inDeg[f] ?? 0) + (outDeg[f] ?? 0);
    const churn = change[f] ?? 0;
    const bug = bugs[f] ?? 0;
    const fragility = coupling * 1 + churn * 3 + bug * 5;
    if (fragility >= 15) {
      fragile_zones.push({
        file: f,
        coupling,
        churn,
        bugs: bug,
        fragility,
        reason:
          (churn >= 4 ? "High churn. " : "") +
          (coupling >= 8 ? "High coupling. " : "") +
          (bug > 0 ? `${bug} bug(s) on this surface.` : ""),
      });
    }
  }
  fragile_zones.sort((a, b) => b.fragility - a.fragility);

  return Object.freeze({
    generated_at: new Date().toISOString(),
    totals: { nodes: allFiles.size, edges: edgeCount },
    critical_paths: Object.freeze(critical_paths.slice(0, 10)),
    fragile_zones: Object.freeze(fragile_zones.slice(0, 10)),
    notes:
      critical_paths.length === 0 && fragile_zones.length === 0
        ? "No critical paths or fragile zones detected."
        : `${critical_paths.length} critical path(s), ${fragile_zones.length} fragile zone(s).`,
  });
}
