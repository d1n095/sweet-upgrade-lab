/**
 * CHANGE SIMULATOR
 *
 * Simulates "what happens if file X changes" before applying it.
 * Pure derivation from the dep graph + history signals.
 *
 * Outputs:
 *   - what breaks   → transitive importers (with depth)
 *   - what improves → decoupling gain if file shrinks/splits
 *   - what stays stable → unrelated clusters
 */

export interface ChangeSimInput {
  target_file: string;
  edges: Record<string, string[]>;
  change_counts?: Record<string, number>;
  failure_counts?: Record<string, number>;
}

export interface BreakImpact {
  file: string;
  hops: number;
  reason: string;
}

export interface ChangeSimReport {
  generated_at: string;
  target: string;
  exists: boolean;
  what_breaks: ReadonlyArray<BreakImpact>;
  what_improves: ReadonlyArray<string>;
  what_stays_stable: ReadonlyArray<string>;
  risk_level: "low" | "medium" | "high" | "critical";
  notes: string;
}

function clusterIdFor(path: string): string {
  const m = path.match(/^src\/([^/]+)(?:\/([^/]+))?/);
  if (!m) return "root";
  return m[2] ? `${m[1]}/${m[2]}` : m[1];
}

export function simulateChange(input: ChangeSimInput): ChangeSimReport {
  const target = input.target_file.trim();
  const edges = input.edges ?? {};
  const change = input.change_counts ?? {};
  const fail = input.failure_counts ?? {};

  const allFiles = new Set<string>(Object.keys(edges));
  for (const deps of Object.values(edges)) for (const d of deps) allFiles.add(d);
  const exists = allFiles.has(target);

  if (!exists || !target) {
    return Object.freeze({
      generated_at: new Date().toISOString(),
      target,
      exists: false,
      what_breaks: [],
      what_improves: [],
      what_stays_stable: [],
      risk_level: "low",
      notes: target ? `Unknown file: ${target}` : "Provide a target file path to simulate.",
    });
  }

  // Build reverse adjacency
  const reverse: Record<string, string[]> = {};
  for (const [from, deps] of Object.entries(edges)) {
    for (const to of deps) (reverse[to] ??= []).push(from);
  }

  // BFS upstream up to 4 hops
  const what_breaks: BreakImpact[] = [];
  const visited = new Set<string>([target]);
  const queue: Array<[string, number]> = [[target, 0]];
  while (queue.length) {
    const [n, d] = queue.shift()!;
    if (d >= 4) continue;
    for (const up of reverse[n] ?? []) {
      if (visited.has(up)) continue;
      visited.add(up);
      const hops = d + 1;
      const isHot = (change[up] ?? 0) >= 3;
      const hasBugs = (fail[up] ?? 0) > 0;
      what_breaks.push({
        file: up,
        hops,
        reason: `Imports ${n}${hops > 1 ? ` (transitively, ${hops} hop(s))` : ""}${
          isHot ? " · hot file" : ""
        }${hasBugs ? " · prior bugs" : ""}`,
      });
      queue.push([up, hops]);
    }
  }
  what_breaks.sort((a, b) => a.hops - b.hops || b.reason.length - a.reason.length);

  // Improvements: if target is hub, splitting it decouples X clusters
  const targetOut = (edges[target] ?? []).length;
  const targetIn = (reverse[target] ?? []).length;
  const what_improves: string[] = [];
  if (targetOut >= 8)
    what_improves.push(`Target imports ${targetOut} module(s) — splitting can reduce its fan-out.`);
  if (targetIn >= 8)
    what_improves.push(`Target is imported by ${targetIn} module(s) — facade or interface seam can stabilize callers.`);
  if ((change[target] ?? 0) >= 4)
    what_improves.push(`Target has ${change[target]} recent edits — refactor reduces future churn.`);

  // Stays stable: clusters not touched
  const affectedClusters = new Set<string>();
  for (const f of [target, ...what_breaks.map((b) => b.file)])
    affectedClusters.add(clusterIdFor(f));
  const allClusters = new Set<string>();
  for (const f of allFiles) allClusters.add(clusterIdFor(f));
  const stable: string[] = [];
  for (const c of allClusters) if (!affectedClusters.has(c)) stable.push(c);

  // Risk level
  const past = fail[target] ?? 0;
  const stress = targetIn + targetOut;
  const score = what_breaks.length + stress + past * 4 + (change[target] ?? 0) * 2;
  let risk: ChangeSimReport["risk_level"] = "low";
  if (score >= 40) risk = "critical";
  else if (score >= 20) risk = "high";
  else if (score >= 10) risk = "medium";

  return Object.freeze({
    generated_at: new Date().toISOString(),
    target,
    exists: true,
    what_breaks: Object.freeze(what_breaks.slice(0, 12)),
    what_improves: Object.freeze(what_improves),
    what_stays_stable: Object.freeze(stable.slice(0, 12)),
    risk_level: risk,
    notes: `${what_breaks.length} downstream effect(s); ${stable.length} cluster(s) unaffected; risk ${risk}.`,
  });
}
