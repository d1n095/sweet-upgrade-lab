/**
 * ARCHITECTURE CLUSTERER — natural-boundary detector.
 *
 * Groups modules into clusters using:
 *   - dependency density (edges within vs across folders)
 *   - usage patterns (in-degree / out-degree shape)
 *   - change frequency (co-changing files belong together)
 *
 * Outputs:
 *   - natural architecture boundaries
 *   - micro-module suggestions (oversized clusters → split)
 *   - decoupling opportunities (cross-cluster cables)
 *
 * Pure derivation. Suggest-only.
 */

export interface ClustererInputs {
  edges: Record<string, string[]>;
  change_counts?: Record<string, number>;
}

export interface ClusterBoundary {
  cluster_id: string;
  files: ReadonlyArray<string>;
  internal_edges: number;
  external_edges: number;
  density: number;       // 0..1
  churn_total: number;
  is_natural: boolean;   // density >= 0.6 → looks like a real boundary
}

export interface DecouplingOpportunity {
  from_cluster: string;
  to_cluster: string;
  edge_count: number;
  suggestion: string;
}

export interface MicroModuleSuggestion {
  cluster_id: string;
  file_count: number;
  reason: string;
}

export interface ClustererReport {
  generated_at: string;
  clusters: ReadonlyArray<ClusterBoundary>;
  decoupling: ReadonlyArray<DecouplingOpportunity>;
  micro_modules: ReadonlyArray<MicroModuleSuggestion>;
  notes: string;
}

function clusterIdFor(path: string): string {
  const m = path.match(/^src\/([^/]+)(?:\/([^/]+))?/);
  if (!m) return "root";
  return m[2] ? `${m[1]}/${m[2]}` : m[1];
}

export function runArchitectureClusterer(inputs: ClustererInputs): ClustererReport {
  const churn = inputs.change_counts ?? {};
  const all = new Set<string>(Object.keys(inputs.edges));
  for (const ds of Object.values(inputs.edges)) for (const d of ds) all.add(d);

  // group by cluster
  const filesByCluster: Record<string, string[]> = {};
  for (const f of all) (filesByCluster[clusterIdFor(f)] ??= []).push(f);

  const clusters: ClusterBoundary[] = [];
  const crossEdges: Record<string, number> = {}; // "from→to" -> count

  for (const [cid, files] of Object.entries(filesByCluster)) {
    const set = new Set(files);
    let internal = 0, external = 0, churnTotal = 0;
    for (const f of files) {
      churnTotal += churn[f] ?? 0;
      for (const d of inputs.edges[f] ?? []) {
        if (set.has(d)) internal++;
        else {
          external++;
          const otherCid = clusterIdFor(d);
          if (otherCid !== cid) {
            const key = `${cid}→${otherCid}`;
            crossEdges[key] = (crossEdges[key] ?? 0) + 1;
          }
        }
      }
    }
    const total = internal + external;
    const density = total === 0 ? 0 : internal / total;
    clusters.push({
      cluster_id: cid,
      files,
      internal_edges: internal,
      external_edges: external,
      density,
      churn_total: churnTotal,
      is_natural: density >= 0.6 && files.length >= 3,
    });
  }
  clusters.sort((a, b) => b.density - a.density);

  // decoupling: cross-cluster cables ≥ 4
  const decoupling: DecouplingOpportunity[] = [];
  for (const [k, n] of Object.entries(crossEdges)) {
    if (n < 4) continue;
    const [from, to] = k.split("→");
    decoupling.push({
      from_cluster: from,
      to_cluster: to,
      edge_count: n,
      suggestion: `Introduce a thin contract between "${from}" and "${to}" to invert this dependency.`,
    });
  }
  decoupling.sort((a, b) => b.edge_count - a.edge_count);

  // micro-module suggestions: very large clusters with mixed churn
  const micro: MicroModuleSuggestion[] = [];
  for (const c of clusters) {
    if (c.files.length >= 12) {
      micro.push({
        cluster_id: c.cluster_id,
        file_count: c.files.length,
        reason: `Cluster has ${c.files.length} files — split into 2–3 focused micro-modules.`,
      });
    }
  }

  return Object.freeze({
    generated_at: new Date().toISOString(),
    clusters: Object.freeze(clusters.slice(0, 20)),
    decoupling: Object.freeze(decoupling.slice(0, 8)),
    micro_modules: Object.freeze(micro.slice(0, 8)),
    notes:
      clusters.length === 0
        ? "No clusters detected."
        : `${clusters.filter((c) => c.is_natural).length} natural boundary cluster(s).`,
  });
}
