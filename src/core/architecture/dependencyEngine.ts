/**
 * DEPENDENCY ENGINE — deterministic, import-driven, no AI.
 *
 * RULES:
 *   - Scan IMPORT statements only (no string heuristics, no inferred edges)
 *   - Resolve every specifier against fileSystemMap (real on-disk paths only)
 *   - External (npm) imports are excluded from the graph
 *
 * OUTPUTS:
 *   - dependency graph (nodes + directed edges)
 *   - circular dependencies (Tarjan SCC)
 *   - orphan files (no inbound edges + not a route entry)
 *   - coupling score (simple count math, per file and global)
 *
 * Coupling math (no AI, pure arithmetic):
 *   fan_out      = number of distinct local files this file imports
 *   fan_in       = number of distinct local files that import this file
 *   instability  = fan_out / (fan_in + fan_out)        // 0 = stable, 1 = unstable
 *   coupling     = fan_in + fan_out                    // raw count
 *   global_score = round(100 * (1 - avg_instability))  // higher = more stable
 */

import { fileSystemMap, getRawSources } from "@/lib/fileSystemMap";
import { ROUTE_REGISTRY } from "@/architecture/routeRegistry";

// ---------- types ----------

export interface DependencyNode {
  path: string;
  fan_in: number;
  fan_out: number;
  coupling: number;
  instability: number; // 0..1
}

export interface DependencyEdge {
  from: string;
  to: string;
  /** raw import specifier as it appeared in source */
  via: string;
}

export interface CircularGroup {
  /** Files participating in the cycle, in SCC order */
  files: string[];
  size: number;
}

export interface DependencyReport {
  generated_at: string;
  truth_source: "fileSystemMap (import.meta.glob)";

  totals: {
    files: number;
    nodes: number;
    edges: number;
    external_imports_skipped: number;
    unresolved_imports: number;
  };

  graph: {
    nodes: DependencyNode[]; // sorted by coupling desc
    edges: DependencyEdge[];
  };

  circular_dependencies: CircularGroup[];
  orphan_files: string[];

  coupling: {
    /** Hottest 25 files by raw coupling (fan_in + fan_out) */
    hottest: DependencyNode[];
    /** Most unstable 25 files (instability nearest 1.0) */
    most_unstable: DependencyNode[];
    average_coupling: number;
    average_instability: number;
    /** 0..100 — higher = more stable system */
    global_stability_score: number;
  };

  unresolved_samples: { file: string; specifier: string }[]; // first 25
}

// ---------- import extraction ----------

const IMPORT_RE =
  /(?:^|\n)\s*(?:import\s[^'"\n]*from\s+|export\s[^'"\n]*from\s+|import\s*\(\s*)['"]([^'"]+)['"]/g;

function listImports(source: string): string[] {
  const out: string[] = [];
  let m: RegExpExecArray | null;
  IMPORT_RE.lastIndex = 0;
  while ((m = IMPORT_RE.exec(source)) !== null) out.push(m[1]);
  return out;
}

function isExternal(spec: string): boolean {
  if (spec.startsWith("@/")) return false;
  if (spec.startsWith("src/")) return false;
  if (spec.startsWith("/src/")) return false;
  if (spec.startsWith(".") || spec.startsWith("/")) return false;
  return true;
}

function normalizeRelative(fromFile: string, spec: string): string {
  const fromDir = fromFile.split("/").slice(0, -1);
  const stack = [...fromDir];
  for (const p of spec.split("/")) {
    if (p === "" || p === ".") continue;
    if (p === "..") stack.pop();
    else stack.push(p);
  }
  return stack.join("/");
}

function resolveTarget(spec: string, fromFile: string): string | null {
  if (isExternal(spec)) return null;
  if (spec.startsWith("@/")) return "src/" + spec.slice(2);
  if (spec.startsWith("src/")) return spec;
  if (spec.startsWith("/src/")) return spec.slice(1);
  if (spec.startsWith(".") || spec.startsWith("/")) return normalizeRelative(fromFile, spec);
  return null;
}

function resolveAgainstMap(target: string, paths: Set<string>): string | null {
  if (paths.has(target)) return target;
  const candidates = [
    `${target}.ts`,
    `${target}.tsx`,
    `${target}.js`,
    `${target}.jsx`,
    `${target}/index.ts`,
    `${target}/index.tsx`,
    `${target}/index.js`,
    `${target}/index.jsx`,
  ];
  for (const c of candidates) if (paths.has(c)) return c;
  return null;
}

// ---------- Tarjan SCC for cycle detection ----------

function tarjanSCC(nodes: string[], adj: Map<string, string[]>): string[][] {
  const indexMap = new Map<string, number>();
  const lowMap = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const result: string[][] = [];
  let idx = 0;

  function strongConnect(v: string) {
    indexMap.set(v, idx);
    lowMap.set(v, idx);
    idx++;
    stack.push(v);
    onStack.add(v);

    const successors = adj.get(v) ?? [];
    for (const w of successors) {
      if (!indexMap.has(w)) {
        strongConnect(w);
        lowMap.set(v, Math.min(lowMap.get(v)!, lowMap.get(w)!));
      } else if (onStack.has(w)) {
        lowMap.set(v, Math.min(lowMap.get(v)!, indexMap.get(w)!));
      }
    }

    if (lowMap.get(v) === indexMap.get(v)) {
      const comp: string[] = [];
      while (true) {
        const w = stack.pop()!;
        onStack.delete(w);
        comp.push(w);
        if (w === v) break;
      }
      // Real cycles: SCC size > 1, or self-loop
      if (comp.length > 1 || (adj.get(v)?.includes(v) ?? false)) {
        result.push(comp);
      }
    }
  }

  for (const v of nodes) if (!indexMap.has(v)) strongConnect(v);
  return result;
}

// ---------- entrypoint ----------

export function runDependencyEngine(): DependencyReport {
  const generated_at = new Date().toISOString();
  const sources = getRawSources();
  const allFiles = fileSystemMap.map((f) => f.path);
  const pathSet = new Set<string>(allFiles);

  const edges: DependencyEdge[] = [];
  const adj = new Map<string, Set<string>>();
  const reverseAdj = new Map<string, Set<string>>();
  let external_skipped = 0;
  let unresolved = 0;
  const unresolved_samples: { file: string; specifier: string }[] = [];

  for (const path of allFiles) {
    const src = sources["/" + path];
    if (!src) continue;
    const specs = listImports(src);
    for (const spec of specs) {
      if (isExternal(spec)) {
        external_skipped++;
        continue;
      }
      const target = resolveTarget(spec, path);
      const resolved = target ? resolveAgainstMap(target, pathSet) : null;
      if (!resolved) {
        unresolved++;
        if (unresolved_samples.length < 25) {
          unresolved_samples.push({ file: path, specifier: spec });
        }
        continue;
      }
      // Skip self-edges from re-export aliases pointing to the same file
      if (resolved === path) continue;
      edges.push({ from: path, to: resolved, via: spec });
      if (!adj.has(path)) adj.set(path, new Set());
      adj.get(path)!.add(resolved);
      if (!reverseAdj.has(resolved)) reverseAdj.set(resolved, new Set());
      reverseAdj.get(resolved)!.add(path);
    }
  }

  // Build nodes (every file is a node, even if no edges — needed for orphan list)
  const nodes: DependencyNode[] = allFiles.map((p) => {
    const fan_out = adj.get(p)?.size ?? 0;
    const fan_in = reverseAdj.get(p)?.size ?? 0;
    const coupling = fan_in + fan_out;
    const instability = coupling === 0 ? 0 : fan_out / coupling;
    return { path: p, fan_in, fan_out, coupling, instability };
  });

  // Cycles
  const adjArr = new Map<string, string[]>();
  for (const [k, v] of adj) adjArr.set(k, Array.from(v));
  const sccs = tarjanSCC(allFiles, adjArr);
  const circular_dependencies: CircularGroup[] = sccs
    .map((files) => ({ files: files.slice().sort(), size: files.length }))
    .sort((a, b) => b.size - a.size);

  // Orphans: no inbound edges AND not a route file AND not the app entry
  const routeFiles = new Set<string>(
    ROUTE_REGISTRY.filter((r) => r.file !== "(redirect)").map((r) => r.file)
  );
  const ENTRY_FILES = new Set<string>([
    "src/main.tsx",
    "src/App.tsx",
    "src/vite-env.d.ts",
  ]);
  const orphan_files = nodes
    .filter(
      (n) =>
        n.fan_in === 0 &&
        !routeFiles.has(n.path) &&
        !ENTRY_FILES.has(n.path) &&
        !n.path.startsWith("src/test/") &&
        !/\.(test|spec)\.[tj]sx?$/.test(n.path)
    )
    .map((n) => n.path)
    .sort();

  // Coupling stats
  const sortedByCoupling = [...nodes].sort((a, b) => b.coupling - a.coupling);
  const sortedByInstability = [...nodes]
    .filter((n) => n.coupling > 0)
    .sort((a, b) => b.instability - a.instability);

  const totalCoupling = nodes.reduce((s, n) => s + n.coupling, 0);
  const nonzero = nodes.filter((n) => n.coupling > 0);
  const totalInstability = nonzero.reduce((s, n) => s + n.instability, 0);
  const average_coupling = nodes.length > 0 ? totalCoupling / nodes.length : 0;
  const average_instability = nonzero.length > 0 ? totalInstability / nonzero.length : 0;
  const global_stability_score = Math.round(100 * (1 - average_instability));

  return {
    generated_at,
    truth_source: "fileSystemMap (import.meta.glob)",
    totals: {
      files: allFiles.length,
      nodes: nodes.length,
      edges: edges.length,
      external_imports_skipped: external_skipped,
      unresolved_imports: unresolved,
    },
    graph: {
      nodes: sortedByCoupling,
      edges,
    },
    circular_dependencies,
    orphan_files,
    coupling: {
      hottest: sortedByCoupling.slice(0, 25),
      most_unstable: sortedByInstability.slice(0, 25),
      average_coupling: Math.round(average_coupling * 100) / 100,
      average_instability: Math.round(average_instability * 1000) / 1000,
      global_stability_score,
    },
    unresolved_samples,
  };
}
