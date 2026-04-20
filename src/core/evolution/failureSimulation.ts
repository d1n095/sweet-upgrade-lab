/**
 * FAILURE SIMULATION LAYER
 *
 * Stress-tests the architecture using deterministic scenario injection.
 * Pure simulation — never mutates real state. Every scenario is reproducible
 * (no randomness, no time-based input).
 *
 * SIMULATION TYPES:
 *   1. NODE_FAILURE       — remove a critical module, measure impact spread
 *   2. DEPENDENCY_BREAK   — break a single import edge, trace cascade
 *   3. HIGH_LOAD          — mark a hot module re-rendering, find unstable clusters
 *   4. ROUTE_FAILURE      — remove a route mapping, detect unreachable UI
 *
 * Returns frozen report with: simulation_results, weak_points,
 * failure_chains, mitigation_suggestions.
 */

export type SimulationType = "NODE_FAILURE" | "DEPENDENCY_BREAK" | "HIGH_LOAD" | "ROUTE_FAILURE";

export interface FailureScenario {
  id: string;
  type: SimulationType;
  /** For NODE_FAILURE / HIGH_LOAD: target module. */
  target?: string;
  /** For DEPENDENCY_BREAK: edge to remove. */
  edge?: { from: string; to: string };
  /** For ROUTE_FAILURE: route path. */
  route?: string;
  description: string;
}

export interface FailureSimulationInput {
  /** Adjacency: file → files it imports. */
  dependency_graph: Record<string, string[]>;
  /** cluster_id → file ids in cluster. */
  cluster_map: Record<string, string[]>;
  /** route path → component file. */
  route_map: Record<string, string>;
  /** Active architecture rules (rule id → enabled). */
  architecture_rules: ReadonlyArray<{ id: string; enabled: boolean }>;
  scenarios: ReadonlyArray<FailureScenario>;
}

export interface ScenarioResult {
  scenario: FailureScenario;
  affected_nodes: ReadonlyArray<string>;
  broken_paths: ReadonlyArray<{ from: string; to: string }>;
  propagation_depth: number;
  unreachable_routes: ReadonlyArray<string>;
  unstable_clusters: ReadonlyArray<string>;
  failure_impact_score: number;   // 0-100, higher = more damage
  resilience_score: number;       // 0-100, higher = system absorbed it
  failure_chain: ReadonlyArray<string>;
}

export interface WeakPoint {
  node: string;
  reason: string;
  exposure_score: number;
}

export interface MitigationSuggestion {
  for_scenario_id: string;
  action: string;
  rationale: string;
}

export interface FailureSimulationReport {
  generated_at: string;
  totals: { nodes: number; edges: number; routes: number; clusters: number };
  simulation_results: ReadonlyArray<ScenarioResult>;
  weak_points: ReadonlyArray<WeakPoint>;
  failure_chains: ReadonlyArray<{ scenario_id: string; chain: ReadonlyArray<string> }>;
  mitigation_suggestions: ReadonlyArray<MitigationSuggestion>;
  summary: string;
}

// ── Pure helpers ───────────────────────────────────────────────────────

/** Build reverse adjacency (file → files that import it). */
function buildReverse(graph: Record<string, string[]>): Record<string, string[]> {
  const rev: Record<string, string[]> = {};
  for (const [from, deps] of Object.entries(graph)) {
    for (const to of deps) {
      (rev[to] ??= []).push(from);
    }
  }
  return rev;
}

/** Deterministic BFS from a node along given adjacency. Returns visited + max depth. */
function bfs(
  start: string,
  adj: Record<string, string[]>,
): { visited: string[]; depth: number; chain: string[] } {
  const visited = new Set<string>([start]);
  const order: string[] = [start];
  const chain: string[] = [start];
  let queue: Array<{ node: string; d: number }> = [{ node: start, d: 0 }];
  let depth = 0;

  while (queue.length > 0) {
    const next: Array<{ node: string; d: number }> = [];
    // Sort for deterministic order
    queue.sort((a, b) => (a.node < b.node ? -1 : 1));
    for (const { node, d } of queue) {
      const neighbors = (adj[node] ?? []).slice().sort();
      for (const n of neighbors) {
        if (!visited.has(n)) {
          visited.add(n);
          order.push(n);
          if (d + 1 > depth) {
            depth = d + 1;
            chain.push(n);
          }
          next.push({ node: n, d: d + 1 });
        }
      }
    }
    queue = next;
  }
  return { visited: order, depth, chain };
}

function clusterOfNode(node: string, clusterMap: Record<string, string[]>): string | null {
  for (const [cid, members] of Object.entries(clusterMap)) {
    if (members.includes(node)) return cid;
  }
  return null;
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

// ── Per-scenario runners ───────────────────────────────────────────────

function runNodeFailure(
  scenario: FailureScenario,
  input: FailureSimulationInput,
): ScenarioResult {
  const target = scenario.target ?? "";
  const reverse = buildReverse(input.dependency_graph);
  const { visited, depth, chain } = bfs(target, reverse);
  const affected = visited.filter((n) => n !== target);

  const broken_paths = affected.map((n) => ({ from: n, to: target }));
  const unreachable_routes = Object.entries(input.route_map)
    .filter(([, comp]) => comp === target || affected.includes(comp))
    .map(([route]) => route);

  const totalNodes = Object.keys(input.dependency_graph).length || 1;
  const failure_impact_score = clamp(Math.round((affected.length / totalNodes) * 100), 0, 100);
  const resilience_score = 100 - failure_impact_score;

  const clusters = new Set<string>();
  for (const n of affected) {
    const c = clusterOfNode(n, input.cluster_map);
    if (c) clusters.add(c);
  }

  return {
    scenario,
    affected_nodes: Object.freeze(affected),
    broken_paths: Object.freeze(broken_paths),
    propagation_depth: depth,
    unreachable_routes: Object.freeze(unreachable_routes),
    unstable_clusters: Object.freeze([...clusters]),
    failure_impact_score,
    resilience_score,
    failure_chain: Object.freeze(chain),
  };
}

function runDependencyBreak(
  scenario: FailureScenario,
  input: FailureSimulationInput,
): ScenarioResult {
  const edge = scenario.edge;
  if (!edge) {
    return {
      scenario,
      affected_nodes: Object.freeze([]),
      broken_paths: Object.freeze([]),
      propagation_depth: 0,
      unreachable_routes: Object.freeze([]),
      unstable_clusters: Object.freeze([]),
      failure_impact_score: 0,
      resilience_score: 100,
      failure_chain: Object.freeze([]),
    };
  }

  // Clone graph minus the broken edge
  const cloned: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(input.dependency_graph)) {
    cloned[k] = k === edge.from ? v.filter((d) => d !== edge.to) : v.slice();
  }

  // Anything that transitively depended on edge.to via edge.from is now affected
  const reverse = buildReverse(cloned);
  const { visited, depth, chain } = bfs(edge.from, reverse);
  const affected = visited;

  const totalEdges = Object.values(input.dependency_graph).reduce((a, b) => a + b.length, 0) || 1;
  const failure_impact_score = clamp(Math.round((affected.length / totalEdges) * 100), 0, 100);
  const resilience_score = 100 - failure_impact_score;

  const unreachable_routes = Object.entries(input.route_map)
    .filter(([, comp]) => affected.includes(comp))
    .map(([route]) => route);

  const clusters = new Set<string>();
  for (const n of affected) {
    const c = clusterOfNode(n, input.cluster_map);
    if (c) clusters.add(c);
  }

  return {
    scenario,
    affected_nodes: Object.freeze(affected),
    broken_paths: Object.freeze([{ from: edge.from, to: edge.to }]),
    propagation_depth: depth,
    unreachable_routes: Object.freeze(unreachable_routes),
    unstable_clusters: Object.freeze([...clusters]),
    failure_impact_score,
    resilience_score,
    failure_chain: Object.freeze(chain),
  };
}

function runHighLoad(
  scenario: FailureScenario,
  input: FailureSimulationInput,
): ScenarioResult {
  const target = scenario.target ?? "";
  // Walk forward (deps), excessive re-renders propagate to children
  const { visited, depth, chain } = bfs(target, input.dependency_graph);
  const affected = visited.filter((n) => n !== target);

  // Cluster is unstable if >40% of its members are in the affected set
  const unstable_clusters: string[] = [];
  for (const [cid, members] of Object.entries(input.cluster_map)) {
    const hits = members.filter((m) => affected.includes(m) || m === target).length;
    if (members.length > 0 && hits / members.length >= 0.4) unstable_clusters.push(cid);
  }

  const totalNodes = Object.keys(input.dependency_graph).length || 1;
  const failure_impact_score = clamp(Math.round((affected.length / totalNodes) * 80), 0, 100);
  const resilience_score = 100 - failure_impact_score;

  return {
    scenario,
    affected_nodes: Object.freeze(affected),
    broken_paths: Object.freeze([]),
    propagation_depth: depth,
    unreachable_routes: Object.freeze([]),
    unstable_clusters: Object.freeze(unstable_clusters),
    failure_impact_score,
    resilience_score,
    failure_chain: Object.freeze(chain),
  };
}

function runRouteFailure(
  scenario: FailureScenario,
  input: FailureSimulationInput,
): ScenarioResult {
  const route = scenario.route ?? "";
  const target = input.route_map[route];
  const unreachable_routes: string[] = [];

  if (target) unreachable_routes.push(route);
  // Any other route pointing to the same file is also unreachable if the file is "removed".
  for (const [r, comp] of Object.entries(input.route_map)) {
    if (r !== route && comp === target) unreachable_routes.push(r);
  }

  const totalRoutes = Object.keys(input.route_map).length || 1;
  const failure_impact_score = clamp(Math.round((unreachable_routes.length / totalRoutes) * 100), 0, 100);
  const resilience_score = 100 - failure_impact_score;

  return {
    scenario,
    affected_nodes: target ? Object.freeze([target]) : Object.freeze([]),
    broken_paths: Object.freeze([]),
    propagation_depth: target ? 1 : 0,
    unreachable_routes: Object.freeze(unreachable_routes),
    unstable_clusters: Object.freeze([]),
    failure_impact_score,
    resilience_score,
    failure_chain: target ? Object.freeze([route, target]) : Object.freeze([route]),
  };
}

// ── Aggregations ───────────────────────────────────────────────────────

function deriveWeakPoints(results: ReadonlyArray<ScenarioResult>): WeakPoint[] {
  const exposure = new Map<string, { count: number; reasons: Set<string> }>();
  for (const r of results) {
    for (const n of r.affected_nodes) {
      const cur = exposure.get(n) ?? { count: 0, reasons: new Set() };
      cur.count += 1;
      cur.reasons.add(r.scenario.type);
      exposure.set(n, cur);
    }
  }
  return [...exposure.entries()]
    .map(([node, v]) => ({
      node,
      reason: `Affected by ${v.count} scenario(s): ${[...v.reasons].join(", ")}`,
      exposure_score: v.count * 10,
    }))
    .sort((a, b) => b.exposure_score - a.exposure_score)
    .slice(0, 15);
}

function deriveMitigations(results: ReadonlyArray<ScenarioResult>): MitigationSuggestion[] {
  const out: MitigationSuggestion[] = [];
  for (const r of results) {
    if (r.failure_impact_score < 20) continue;
    switch (r.scenario.type) {
      case "NODE_FAILURE":
        out.push({
          for_scenario_id: r.scenario.id,
          action: `Add error boundary around "${r.scenario.target}" and isolate consumers via interface.`,
          rationale: `Removing it cascades to ${r.affected_nodes.length} node(s).`,
        });
        break;
      case "DEPENDENCY_BREAK":
        out.push({
          for_scenario_id: r.scenario.id,
          action: `Introduce a thin adapter for ${r.scenario.edge?.from} → ${r.scenario.edge?.to}.`,
          rationale: `Direct edge break propagates ${r.propagation_depth} level(s) deep.`,
        });
        break;
      case "HIGH_LOAD":
        out.push({
          for_scenario_id: r.scenario.id,
          action: `Memoize "${r.scenario.target}" outputs; split unstable cluster(s): ${r.unstable_clusters.join(", ")}.`,
          rationale: `${r.unstable_clusters.length} cluster(s) became unstable under load.`,
        });
        break;
      case "ROUTE_FAILURE":
        out.push({
          for_scenario_id: r.scenario.id,
          action: `Add fallback route or 404 boundary for "${r.scenario.route}".`,
          rationale: `${r.unreachable_routes.length} route(s) became unreachable.`,
        });
        break;
    }
  }
  return out;
}

// ── Public API ─────────────────────────────────────────────────────────

export function runFailureSimulation(
  input: FailureSimulationInput,
): FailureSimulationReport {
  const results: ScenarioResult[] = [];
  for (const scenario of input.scenarios) {
    switch (scenario.type) {
      case "NODE_FAILURE":
        results.push(runNodeFailure(scenario, input));
        break;
      case "DEPENDENCY_BREAK":
        results.push(runDependencyBreak(scenario, input));
        break;
      case "HIGH_LOAD":
        results.push(runHighLoad(scenario, input));
        break;
      case "ROUTE_FAILURE":
        results.push(runRouteFailure(scenario, input));
        break;
    }
  }

  const weak_points = deriveWeakPoints(results);
  const mitigation_suggestions = deriveMitigations(results);
  const failure_chains = results.map((r) => ({
    scenario_id: r.scenario.id,
    chain: r.failure_chain,
  }));

  const totalEdges = Object.values(input.dependency_graph).reduce((a, b) => a + b.length, 0);
  const avgImpact =
    results.length === 0
      ? 0
      : Math.round(results.reduce((a, b) => a + b.failure_impact_score, 0) / results.length);

  return Object.freeze({
    generated_at: new Date().toISOString(),
    totals: {
      nodes: Object.keys(input.dependency_graph).length,
      edges: totalEdges,
      routes: Object.keys(input.route_map).length,
      clusters: Object.keys(input.cluster_map).length,
    },
    simulation_results: Object.freeze(results),
    weak_points: Object.freeze(weak_points),
    failure_chains: Object.freeze(failure_chains),
    mitigation_suggestions: Object.freeze(mitigation_suggestions),
    summary:
      results.length === 0
        ? "No scenarios provided."
        : `${results.length} scenario(s) · avg impact ${avgImpact}/100 · ${weak_points.length} weak point(s).`,
  });
}
