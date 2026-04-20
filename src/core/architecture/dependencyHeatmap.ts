/**
 * DEPENDENCY HEATMAP — pure rule-based static analysis.
 *
 * NO AI. NO inference. Only counting + graph construction from import statements.
 * Input: raw sources from fileSystemMap.
 * Output: nodes, edges, deterministic metrics.
 */

import { fileSystemMap, getRawSources } from "@/lib/fileSystemMap";

export type NodeKind = "component" | "page" | "route" | "utility" | "service" | "other";

export interface DepNode {
  id: string;            // file path
  kind: NodeKind;
  imports_out: number;   // edges leaving this node
  imports_in: number;    // edges entering this node
  coupling_score: number;// imports_out + imports_in (pure math)
  is_isolated: boolean;  // 0 in / 0 out
  in_cycle: boolean;
}

export interface DepEdge {
  from: string;
  to: string;
}

export interface HeatmapReport {
  generated_at: string;
  nodes: DepNode[];
  edges: DepEdge[];
  circular_dependencies: string[][]; // each cycle = list of file paths
  high_coupling: DepNode[];          // top 10 by coupling_score
  isolated_nodes: DepNode[];
  metrics: {
    total_nodes: number;
    total_edges: number;
    cycles: number;
    isolated: number;
    avg_coupling: number;
    max_coupling: number;
  };
}

const IMPORT_RE = /(?:import|from)\s+['"]([^'"]+)['"]/g;

function classifyKind(path: string): NodeKind {
  if (path.startsWith("src/pages/")) return "page";
  if (path.startsWith("src/components/")) return "component";
  if (path.includes("supabase/functions/")) return "service";
  if (
    path.startsWith("src/lib/") ||
    path.startsWith("src/utils/") ||
    path.startsWith("src/stores/") ||
    path.startsWith("src/hooks/")
  ) return "utility";
  if (path.startsWith("src/routes/") || path.startsWith("src/architecture/route")) return "route";
  return "other";
}

function resolveImport(spec: string): string | null {
  if (spec.startsWith("@/")) return "src/" + spec.slice(2);
  return null; // relative + node_modules ignored
}

function matchPath(target: string, candidates: Set<string>): string | null {
  if (candidates.has(target)) return target;
  for (const ext of [".ts", ".tsx", ".js", ".jsx"]) {
    if (candidates.has(target + ext)) return target + ext;
    if (candidates.has(target + "/index" + ext)) return target + "/index" + ext;
  }
  return null;
}

/** Tarjan SCC — deterministic cycle detection. */
function findCycles(nodes: string[], adj: Map<string, string[]>): string[][] {
  let index = 0;
  const idx = new Map<string, number>();
  const low = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const cycles: string[][] = [];

  function strong(v: string) {
    idx.set(v, index);
    low.set(v, index);
    index++;
    stack.push(v);
    onStack.add(v);
    for (const w of adj.get(v) || []) {
      if (!idx.has(w)) {
        strong(w);
        low.set(v, Math.min(low.get(v)!, low.get(w)!));
      } else if (onStack.has(w)) {
        low.set(v, Math.min(low.get(v)!, idx.get(w)!));
      }
    }
    if (low.get(v) === idx.get(v)) {
      const scc: string[] = [];
      let w: string;
      do {
        w = stack.pop()!;
        onStack.delete(w);
        scc.push(w);
      } while (w !== v);
      // Only record true cycles (size >1 OR self-loop)
      if (scc.length > 1 || (adj.get(v) || []).includes(v)) cycles.push(scc);
    }
  }
  for (const n of nodes) if (!idx.has(n)) strong(n);
  return cycles;
}

export function runDependencyHeatmap(): HeatmapReport {
  const generated_at = new Date().toISOString();
  const sources = getRawSources();
  const allPaths = fileSystemMap.map((f) => f.path);
  const pathSet = new Set(allPaths);

  const adj = new Map<string, string[]>();
  const inDeg = new Map<string, number>();
  const outDeg = new Map<string, number>();
  for (const p of allPaths) {
    adj.set(p, []);
    inDeg.set(p, 0);
    outDeg.set(p, 0);
  }

  const edges: DepEdge[] = [];

  for (const [rawKey, src] of Object.entries(sources)) {
    if (typeof src !== "string") continue;
    const from = rawKey.startsWith("/") ? rawKey.slice(1) : rawKey;
    if (!pathSet.has(from)) continue;
    const seen = new Set<string>();
    let m: RegExpExecArray | null;
    IMPORT_RE.lastIndex = 0;
    while ((m = IMPORT_RE.exec(src)) !== null) {
      const resolved = resolveImport(m[1]);
      if (!resolved) continue;
      const target = matchPath(resolved, pathSet);
      if (!target || target === from) continue;
      if (seen.has(target)) continue;
      seen.add(target);
      adj.get(from)!.push(target);
      edges.push({ from, to: target });
      outDeg.set(from, (outDeg.get(from) || 0) + 1);
      inDeg.set(target, (inDeg.get(target) || 0) + 1);
    }
  }

  const cycles = findCycles(allPaths, adj);
  const inCycle = new Set<string>();
  for (const c of cycles) for (const n of c) inCycle.add(n);

  const nodes: DepNode[] = allPaths.map((p) => {
    const out = outDeg.get(p) || 0;
    const inn = inDeg.get(p) || 0;
    return {
      id: p,
      kind: classifyKind(p),
      imports_out: out,
      imports_in: inn,
      coupling_score: out + inn,
      is_isolated: out === 0 && inn === 0,
      in_cycle: inCycle.has(p),
    };
  });

  const sortedByCoupling = [...nodes].sort((a, b) => b.coupling_score - a.coupling_score);
  const totalCoupling = nodes.reduce((s, n) => s + n.coupling_score, 0);

  return {
    generated_at,
    nodes,
    edges,
    circular_dependencies: cycles,
    high_coupling: sortedByCoupling.slice(0, 10),
    isolated_nodes: nodes.filter((n) => n.is_isolated),
    metrics: {
      total_nodes: nodes.length,
      total_edges: edges.length,
      cycles: cycles.length,
      isolated: nodes.filter((n) => n.is_isolated).length,
      avg_coupling: nodes.length > 0 ? Math.round((totalCoupling / nodes.length) * 100) / 100 : 0,
      max_coupling: sortedByCoupling[0]?.coupling_score || 0,
    },
  };
}
