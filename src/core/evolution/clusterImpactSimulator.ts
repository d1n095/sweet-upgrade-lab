/**
 * CLUSTER IMPACT SIMULATOR
 *
 * Given a changed file, estimates:
 *   - which clusters are affected (direct + transitive)
 *   - re-render spread (number of consumer files)
 *   - risk of breakage (cluster health-weighted)
 *
 * Pure derivation from the dep graph + cluster registry. Read-only.
 */
import type { ClusterRegistry } from "./clusterIntelligence";

export type ImpactRisk = "low" | "medium" | "high" | "critical";

export interface ImpactReport {
  generated_at: string;
  changed_file: string;
  affected_clusters: ReadonlyArray<{ cluster_id: string; depth: number }>;
  affected_components: ReadonlyArray<string>;
  rerender_spread: number;
  risk_level: ImpactRisk;
  reason: string;
}

export interface ImpactInput {
  edges: Record<string, string[]>; // file → imports
  registry: ClusterRegistry;
}

/** Reverse the import graph: file → list of files that import it. */
function reverseEdges(edges: Record<string, string[]>): Record<string, string[]> {
  const rev: Record<string, string[]> = {};
  for (const [from, deps] of Object.entries(edges)) {
    for (const to of deps) (rev[to] ??= []).push(from);
  }
  return rev;
}

export function simulateImpact(
  changedFile: string,
  input: ImpactInput
): ImpactReport {
  const rev = reverseEdges(input.edges);
  const visited = new Set<string>();
  const queue: Array<{ file: string; depth: number }> = [{ file: changedFile, depth: 0 }];
  const affectedDepth = new Map<string, number>();

  while (queue.length) {
    const { file, depth } = queue.shift()!;
    if (visited.has(file) || depth > 6) continue;
    visited.add(file);
    affectedDepth.set(file, depth);
    for (const consumer of rev[file] ?? []) {
      if (!visited.has(consumer)) queue.push({ file: consumer, depth: depth + 1 });
    }
  }

  visited.delete(changedFile);
  const affected_components = Array.from(visited).slice(0, 100);

  // Map files to clusters
  const fileToCluster: Record<string, string> = {};
  for (const c of input.registry.clusters)
    for (const f of c.files) fileToCluster[f] = c.id;

  const clusterDepth = new Map<string, number>();
  for (const f of affected_components) {
    const cid = fileToCluster[f];
    if (!cid) continue;
    const d = affectedDepth.get(f) ?? 99;
    if (!clusterDepth.has(cid) || (clusterDepth.get(cid) ?? 99) > d) {
      clusterDepth.set(cid, d);
    }
  }

  const affected_clusters = Array.from(clusterDepth.entries())
    .map(([cluster_id, depth]) => ({ cluster_id, depth }))
    .sort((a, b) => a.depth - b.depth);

  const rerender_spread = affected_components.length;
  const failureSum = affected_clusters.reduce((acc, ac) => {
    const cluster = input.registry.clusters.find((c) => c.id === ac.cluster_id);
    return acc + (cluster?.failure_risk ?? 0);
  }, 0);

  let risk_level: ImpactRisk = "low";
  if (rerender_spread > 50 || failureSum > 30) risk_level = "critical";
  else if (rerender_spread > 25 || failureSum > 15) risk_level = "high";
  else if (rerender_spread > 10 || failureSum > 5) risk_level = "medium";

  return Object.freeze({
    generated_at: new Date().toISOString(),
    changed_file: changedFile,
    affected_clusters: Object.freeze(affected_clusters),
    affected_components: Object.freeze(affected_components),
    rerender_spread,
    risk_level,
    reason:
      risk_level === "low"
        ? "Change is well-contained."
        : `${rerender_spread} consumer file(s) across ${affected_clusters.length} cluster(s); risk-weighted total ${failureSum}.`,
  });
}
