/**
 * LIVE DEPENDENCY GRAPH
 *
 * Pure derivation of a renderable dep graph from the existing edge map:
 *   - nodes  = files
 *   - edges  = imports
 *   - colors = coupling tier (red / green / grey)
 *   - chains = transitive upstream / downstream
 *   - flags  = tight-coupling clusters + architecture violations
 *
 * No layout engine, no DOM. UI tiles can render it however they want.
 * Re-runs on demand — suitable for "real-time on code change" if the
 * caller passes in a fresh edges map.
 */

export type NodeColor = "red" | "green" | "grey" | "neutral";

export interface DepNode {
  id: string;
  in_degree: number;
  out_degree: number;
  color: NodeColor;
  reason: string;
  cluster_id: string;
}

export interface DepEdge {
  from: string;
  to: string;
}

export interface CouplingCluster {
  cluster_id: string;
  files: ReadonlyArray<string>;
  internal_edges: number;
  external_edges: number;
  tightness: number; // 0..1
}

export interface ArchitectureViolation {
  from: string;
  to: string;
  detail: string;
}

export interface DepGraphReport {
  generated_at: string;
  nodes: ReadonlyArray<DepNode>;
  edges: ReadonlyArray<DepEdge>;
  tight_clusters: ReadonlyArray<CouplingCluster>;
  violations: ReadonlyArray<ArchitectureViolation>;
  totals: {
    nodes: number;
    edges: number;
    red: number;
    green: number;
    grey: number;
  };
  notes: string;
}

export interface ChainResult {
  upstream: ReadonlyArray<string>;
  downstream: ReadonlyArray<string>;
}

const HIGH_COUPLING_DEG = 8;
const REUSABLE_IN_DEG = 5;

const LAYER_RANK: Record<string, number> = {
  "src/pages": 5,
  "src/components": 4,
  "src/hooks": 3,
  "src/stores": 2,
  "src/core": 2,
  "src/lib": 1,
  "src/services": 1,
  "src/utils": 1,
};

function clusterIdFor(path: string): string {
  const m = path.match(/^src\/([^/]+)(?:\/([^/]+))?/);
  if (!m) return "root";
  return m[2] ? `${m[1]}/${m[2]}` : m[1];
}

function layerOf(path: string): string | null {
  for (const k of Object.keys(LAYER_RANK)) if (path.startsWith(k)) return k;
  return null;
}

export function buildDepGraph(
  edges: Record<string, string[]>
): DepGraphReport {
  const allFiles = new Set<string>(Object.keys(edges));
  for (const deps of Object.values(edges)) for (const d of deps) allFiles.add(d);

  const inDeg: Record<string, number> = {};
  const outDeg: Record<string, number> = {};
  const flatEdges: DepEdge[] = [];
  for (const [from, deps] of Object.entries(edges)) {
    outDeg[from] = (outDeg[from] ?? 0) + deps.length;
    for (const to of deps) {
      inDeg[to] = (inDeg[to] ?? 0) + 1;
      flatEdges.push({ from, to });
    }
  }

  const nodes: DepNode[] = [];
  let red = 0, green = 0, grey = 0;
  for (const id of allFiles) {
    const i = inDeg[id] ?? 0;
    const o = outDeg[id] ?? 0;
    let color: NodeColor = "neutral";
    let reason = "";
    if (i + o === 0) {
      color = "grey";
      reason = "Dead node — no imports either way.";
      grey++;
    } else if (i + o >= HIGH_COUPLING_DEG) {
      color = "red";
      reason = `High coupling (in: ${i}, out: ${o}).`;
      red++;
    } else if (i >= REUSABLE_IN_DEG && o <= 2) {
      color = "green";
      reason = `Reusable module — used by ${i} files, depends on ${o}.`;
      green++;
    } else {
      reason = "Normal connectivity.";
    }
    nodes.push({
      id,
      in_degree: i,
      out_degree: o,
      color,
      reason,
      cluster_id: clusterIdFor(id),
    });
  }

  // Tight-coupling clusters: density of internal edges
  const filesByCluster: Record<string, string[]> = {};
  for (const n of nodes) (filesByCluster[n.cluster_id] ??= []).push(n.id);

  const tight_clusters: CouplingCluster[] = [];
  for (const [cid, files] of Object.entries(filesByCluster)) {
    if (files.length < 3) continue;
    const set = new Set(files);
    let internal = 0, external = 0;
    for (const f of files) {
      for (const d of edges[f] ?? []) {
        if (set.has(d)) internal++;
        else external++;
      }
    }
    const total = internal + external;
    if (total === 0) continue;
    const tightness = internal / total;
    if (tightness >= 0.7 && files.length >= 4) {
      tight_clusters.push({
        cluster_id: cid,
        files,
        internal_edges: internal,
        external_edges: external,
        tightness,
      });
    }
  }
  tight_clusters.sort((a, b) => b.tightness - a.tightness);

  // Architecture violations: lower-layer importing higher-layer
  const violations: ArchitectureViolation[] = [];
  for (const [from, deps] of Object.entries(edges)) {
    const fromL = layerOf(from);
    if (!fromL) continue;
    const fromR = LAYER_RANK[fromL];
    for (const to of deps) {
      const toL = layerOf(to);
      if (!toL) continue;
      const toR = LAYER_RANK[toL];
      if (toR > fromR) {
        violations.push({
          from,
          to,
          detail: `Layer "${fromL}" imports from higher layer "${toL}".`,
        });
      }
    }
  }

  return Object.freeze({
    generated_at: new Date().toISOString(),
    nodes: Object.freeze(nodes),
    edges: Object.freeze(flatEdges),
    tight_clusters: Object.freeze(tight_clusters.slice(0, 8)),
    violations: Object.freeze(violations.slice(0, 20)),
    totals: {
      nodes: nodes.length,
      edges: flatEdges.length,
      red,
      green,
      grey,
    },
    notes:
      violations.length === 0 && tight_clusters.length === 0
        ? "Graph clean — no high-coupling clusters or layer violations."
        : `${tight_clusters.length} tight cluster(s), ${violations.length} layer violation(s).`,
  });
}

/**
 * Trace upstream (who imports me, transitively)
 * and downstream (what I import, transitively).
 */
export function traceChain(
  fileId: string,
  edges: Record<string, string[]>,
  maxDepth = 20
): ChainResult {
  const downstream = new Set<string>();
  const upstream = new Set<string>();

  // downstream: walk edges
  const dq: Array<[string, number]> = [[fileId, 0]];
  while (dq.length) {
    const [n, d] = dq.shift()!;
    if (d >= maxDepth) continue;
    for (const nb of edges[n] ?? []) {
      if (!downstream.has(nb) && nb !== fileId) {
        downstream.add(nb);
        dq.push([nb, d + 1]);
      }
    }
  }

  // upstream: build reverse edge index
  const reverse: Record<string, string[]> = {};
  for (const [from, deps] of Object.entries(edges)) {
    for (const to of deps) (reverse[to] ??= []).push(from);
  }
  const uq: Array<[string, number]> = [[fileId, 0]];
  while (uq.length) {
    const [n, d] = uq.shift()!;
    if (d >= maxDepth) continue;
    for (const nb of reverse[n] ?? []) {
      if (!upstream.has(nb) && nb !== fileId) {
        upstream.add(nb);
        uq.push([nb, d + 1]);
      }
    }
  }

  return {
    upstream: [...upstream],
    downstream: [...downstream],
  };
}
