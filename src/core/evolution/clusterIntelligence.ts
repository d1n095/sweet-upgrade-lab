/**
 * CLUSTER INTELLIGENCE
 *
 * Groups files into clusters by directory + dependency overlap.
 * Pure derivation from a dependency graph snapshot.
 *
 * Each cluster exposes:
 *   - dependency map (in/out cluster edges)
 *   - render heat score (component count proxy)
 *   - failure risk score (violations + coupling proxy)
 *
 * Detects:
 *   - orphan components
 *   - circular cluster dependencies
 *   - over-centralized clusters (one cluster pulled by everyone)
 */

export interface DepGraphSnapshot {
  /** path → list of imported paths (relative to repo) */
  edges: Record<string, string[]>;
  /** files reported as having violations */
  violation_files: ReadonlyArray<string>;
}

export interface Cluster {
  id: string;
  files: ReadonlyArray<string>;
  in_edges: number;
  out_edges: number;
  render_heat: number;
  failure_risk: number;
}

export interface ClusterRegistry {
  generated_at: string;
  clusters: ReadonlyArray<Cluster>;
  cluster_edges: ReadonlyArray<{ from: string; to: string; weight: number }>;
  orphans: ReadonlyArray<string>;
  circular_clusters: ReadonlyArray<ReadonlyArray<string>>;
  overcentralized: ReadonlyArray<string>;
  suggestions: ReadonlyArray<string>;
}

function clusterIdFor(path: string): string {
  // group by top 2 path segments inside src/
  const m = path.match(/^src\/([^/]+)(?:\/([^/]+))?/);
  if (!m) return "root";
  return m[2] ? `${m[1]}/${m[2]}` : m[1];
}

function findCycles(adj: Record<string, Set<string>>): string[][] {
  const cycles: string[][] = [];
  const visiting = new Set<string>();
  const visited = new Set<string>();

  function dfs(node: string, stack: string[]) {
    if (visiting.has(node)) {
      const idx = stack.indexOf(node);
      if (idx >= 0) cycles.push(stack.slice(idx).concat(node));
      return;
    }
    if (visited.has(node)) return;
    visiting.add(node);
    stack.push(node);
    for (const nb of adj[node] ?? []) dfs(nb, stack);
    stack.pop();
    visiting.delete(node);
    visited.add(node);
  }

  for (const n of Object.keys(adj)) dfs(n, []);
  return cycles;
}

export function buildClusterRegistry(snapshot: DepGraphSnapshot): ClusterRegistry {
  const fileToCluster: Record<string, string> = {};
  const clusterFiles: Record<string, string[]> = {};

  for (const file of Object.keys(snapshot.edges)) {
    const cid = clusterIdFor(file);
    fileToCluster[file] = cid;
    (clusterFiles[cid] ??= []).push(file);
  }

  const violationSet = new Set(snapshot.violation_files);
  const adj: Record<string, Set<string>> = {};
  const edgeWeights: Record<string, number> = {};
  const inDeg: Record<string, number> = {};
  const outDeg: Record<string, number> = {};

  for (const [from, deps] of Object.entries(snapshot.edges)) {
    const fromCluster = fileToCluster[from];
    for (const to of deps) {
      const toCluster = fileToCluster[to] ?? clusterIdFor(to);
      if (!fromCluster || fromCluster === toCluster) continue;
      const key = `${fromCluster}→${toCluster}`;
      edgeWeights[key] = (edgeWeights[key] ?? 0) + 1;
      (adj[fromCluster] ??= new Set()).add(toCluster);
      outDeg[fromCluster] = (outDeg[fromCluster] ?? 0) + 1;
      inDeg[toCluster] = (inDeg[toCluster] ?? 0) + 1;
    }
  }

  const clusters: Cluster[] = Object.entries(clusterFiles).map(([id, files]) => {
    const violationsInCluster = files.filter((f) => violationSet.has(f)).length;
    const out = outDeg[id] ?? 0;
    const inc = inDeg[id] ?? 0;
    return {
      id,
      files,
      in_edges: inc,
      out_edges: out,
      render_heat: files.length,
      failure_risk: violationsInCluster * 5 + Math.max(0, out - 10),
    };
  });

  const cluster_edges = Object.entries(edgeWeights).map(([k, weight]) => {
    const [from, to] = k.split("→");
    return { from, to, weight };
  });

  const orphans = clusters
    .filter((c) => c.in_edges === 0 && c.out_edges === 0)
    .map((c) => c.id);

  const circular_clusters = findCycles(adj);

  const totalIn = Object.values(inDeg).reduce((a, b) => a + b, 0) || 1;
  const overcentralized = clusters
    .filter((c) => (c.in_edges / totalIn) > 0.25 && c.in_edges > 5)
    .map((c) => c.id);

  const suggestions: string[] = [];
  for (const o of orphans) suggestions.push(`Orphan cluster "${o}" — verify usage or remove.`);
  for (const c of circular_clusters)
    suggestions.push(`Break circular cluster chain: ${c.join(" → ")}`);
  for (const oc of overcentralized)
    suggestions.push(`Cluster "${oc}" is over-centralized — split into smaller modules.`);

  return Object.freeze({
    generated_at: new Date().toISOString(),
    clusters: Object.freeze(clusters.sort((a, b) => b.failure_risk - a.failure_risk)),
    cluster_edges: Object.freeze(cluster_edges),
    orphans: Object.freeze(orphans),
    circular_clusters: Object.freeze(circular_clusters),
    overcentralized: Object.freeze(overcentralized),
    suggestions: Object.freeze(suggestions),
  });
}
