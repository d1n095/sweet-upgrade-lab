/**
 * SYNTHETIC UNIVERSE LAYER
 *
 * Simulate complete frontend architectures BEFORE they are implemented.
 * Pure deterministic generation: same input → same output. No filesystem,
 * no randomness, no AI inference.
 *
 * Pipeline per variant:
 *   1. Generate virtual file tree (/pages, /components, /core, /services, /routes)
 *   2. Build virtual dependency graph following layer rules
 *   3. Apply pattern sets (prefer stable, avoid unstable)
 *   4. Run virtual dependency scan + rule engine + failure simulation
 *   5. Compute architecture_score, resilience_score, complexity_score
 */

export type VirtualLayer = "pages" | "components" | "core" | "services" | "routes";

export interface ArchitectureRule {
  /** Stable identifier (e.g. "layer.pages-imports-components-only"). */
  id: string;
  /** Disallowed import direction, e.g. { from: "core", to: "pages" }. */
  forbid?: { from: VirtualLayer; to: VirtualLayer };
  /** Hard cap on outgoing imports per file in a layer. */
  max_imports_per_file?: { layer: VirtualLayer; limit: number };
}

export interface DependencyConstraint {
  /** Allowed import direction. */
  from: VirtualLayer;
  to: VirtualLayer;
}

export interface KnownPattern {
  id: string;
  /** Higher = more stable historically (from pattern_memory). */
  stability_score: number;
  /** Layer this pattern operates in. */
  layer: VirtualLayer;
  /** Average fan-out this pattern produces. */
  fan_out: number;
}

export interface SyntheticUniverseInput {
  architecture_rules: ReadonlyArray<ArchitectureRule>;
  dependency_constraints: ReadonlyArray<DependencyConstraint>;
  known_patterns: ReadonlyArray<KnownPattern>;
  /** Number of files per layer to generate. Defaults: pages 6, components 12, core 6, services 4, routes 1. */
  layer_sizes?: Partial<Record<VirtualLayer, number>>;
}

export interface VirtualFile {
  path: string;
  layer: VirtualLayer;
  pattern_id: string;
  imports_out: string[];
}

export interface VirtualEdge {
  from: string;
  to: string;
}

export interface VirtualDependencyGraph {
  files: VirtualFile[];
  edges: VirtualEdge[];
}

export interface RuleViolation {
  rule_id: string;
  file: string;
  detail: string;
}

export interface FailureSimResult {
  removed_node: string;
  reachable_loss: number; // count of nodes that become unreachable from /routes
}

export interface VariantScore {
  architecture_score: number; // 0-100, higher = better
  resilience_score: number;   // 0-100, higher = better
  complexity_score: number;   // 0-100, lower = simpler/better
}

export type VariantKind = "low_coupling" | "high_modularity" | "performance";

export interface SyntheticArchitecture {
  variant: VariantKind;
  graph: VirtualDependencyGraph;
  violations: RuleViolation[];
  failure_simulations: FailureSimResult[];
  scores: VariantScore;
  /** Composite ranking score (higher = better). */
  composite: number;
}

export interface SyntheticUniverseReport {
  generated_at: string;
  input_fingerprint: string;
  synthetic_architectures: SyntheticArchitecture[];
  best_variant: VariantKind;
  score_comparison: ReadonlyArray<{ variant: VariantKind; composite: number; scores: VariantScore }>;
}

/* -------------------------------------------------------------------------- */
/*  Deterministic helpers                                                     */
/* -------------------------------------------------------------------------- */

const DEFAULT_SIZES: Record<VirtualLayer, number> = {
  pages: 6,
  components: 12,
  core: 6,
  services: 4,
  routes: 1,
};

const LAYER_ORDER: VirtualLayer[] = ["routes", "pages", "components", "core", "services"];

/** Stable hash → small int. djb2 style, deterministic. */
function hash(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h >>> 0;
}

function fingerprint(input: SyntheticUniverseInput): string {
  const rules = [...input.architecture_rules].map((r) => r.id).sort().join("|");
  const cons = [...input.dependency_constraints].map((c) => `${c.from}>${c.to}`).sort().join("|");
  const pats = [...input.known_patterns]
    .map((p) => `${p.id}:${p.layer}:${p.stability_score}:${p.fan_out}`)
    .sort()
    .join("|");
  return `r=${hash(rules)};c=${hash(cons)};p=${hash(pats)}`;
}

/* -------------------------------------------------------------------------- */
/*  Pattern selection per variant (deterministic)                             */
/* -------------------------------------------------------------------------- */

function selectPatternForLayer(
  layer: VirtualLayer,
  patterns: ReadonlyArray<KnownPattern>,
  variant: VariantKind,
  fileIndex: number,
): KnownPattern {
  const pool = patterns.filter((p) => p.layer === layer);
  if (pool.length === 0) {
    // Synthesize neutral fallback so generation is total.
    return { id: `${layer}.fallback`, layer, stability_score: 50, fan_out: 2 };
  }
  // Sort deterministically by variant priority.
  const sorted = [...pool].sort((a, b) => {
    if (variant === "low_coupling") {
      return a.fan_out - b.fan_out || b.stability_score - a.stability_score || a.id.localeCompare(b.id);
    }
    if (variant === "high_modularity") {
      return b.stability_score - a.stability_score || a.fan_out - b.fan_out || a.id.localeCompare(b.id);
    }
    // performance: prefer low fan_out then stability then id
    return a.fan_out - b.fan_out || b.stability_score - a.stability_score || a.id.localeCompare(b.id);
  });
  // Strong bias to top of sorted list, but rotate by index for diversity (deterministic).
  const cap = Math.max(1, Math.min(sorted.length, variant === "high_modularity" ? sorted.length : 2));
  return sorted[fileIndex % cap];
}

/* -------------------------------------------------------------------------- */
/*  File tree generation                                                      */
/* -------------------------------------------------------------------------- */

function generateFiles(
  sizes: Record<VirtualLayer, number>,
  patterns: ReadonlyArray<KnownPattern>,
  variant: VariantKind,
): VirtualFile[] {
  const files: VirtualFile[] = [];
  for (const layer of LAYER_ORDER) {
    const n = sizes[layer];
    for (let i = 0; i < n; i++) {
      const pattern = selectPatternForLayer(layer, patterns, variant, i);
      files.push({
        path: `/${layer}/${layer}_${String(i).padStart(2, "0")}.ts`,
        layer,
        pattern_id: pattern.id,
        imports_out: [],
      });
    }
  }
  return files;
}

/* -------------------------------------------------------------------------- */
/*  Dependency graph: enforce pages → components → core → services            */
/* -------------------------------------------------------------------------- */

const ALLOWED_FALLBACK: Record<VirtualLayer, VirtualLayer[]> = {
  routes: ["pages"],
  pages: ["components", "core"],
  components: ["core"],
  core: ["services"],
  services: [],
};

function allowedTargets(
  from: VirtualLayer,
  constraints: ReadonlyArray<DependencyConstraint>,
): VirtualLayer[] {
  const declared = constraints.filter((c) => c.from === from).map((c) => c.to);
  return declared.length > 0 ? declared : ALLOWED_FALLBACK[from];
}

function buildEdges(
  files: VirtualFile[],
  patterns: ReadonlyArray<KnownPattern>,
  constraints: ReadonlyArray<DependencyConstraint>,
  variant: VariantKind,
): VirtualEdge[] {
  const byLayer = new Map<VirtualLayer, VirtualFile[]>();
  for (const f of files) {
    if (!byLayer.has(f.layer)) byLayer.set(f.layer, []);
    byLayer.get(f.layer)!.push(f);
  }

  const fanOutMultiplier =
    variant === "low_coupling" ? 0.5 : variant === "high_modularity" ? 0.85 : 0.7;

  const edges: VirtualEdge[] = [];
  for (const file of files) {
    const targetLayers = allowedTargets(file.layer, constraints);
    if (targetLayers.length === 0) continue;
    const pat = patterns.find((p) => p.id === file.pattern_id);
    const baseFan = pat ? pat.fan_out : 2;
    const fanOut = Math.max(0, Math.round(baseFan * fanOutMultiplier));
    if (fanOut === 0) continue;

    // Deterministic target picking: round-robin across allowed layers, then files in that layer.
    for (let k = 0; k < fanOut; k++) {
      const layer = targetLayers[k % targetLayers.length];
      const pool = byLayer.get(layer) || [];
      if (pool.length === 0) continue;
      const idx = (hash(file.path) + k) % pool.length;
      const target = pool[idx];
      if (target.path === file.path) continue;
      if (file.imports_out.includes(target.path)) continue;
      file.imports_out.push(target.path);
      edges.push({ from: file.path, to: target.path });
    }
  }
  return edges;
}

/* -------------------------------------------------------------------------- */
/*  Rule engine                                                               */
/* -------------------------------------------------------------------------- */

function runRuleEngine(
  graph: VirtualDependencyGraph,
  rules: ReadonlyArray<ArchitectureRule>,
): RuleViolation[] {
  const violations: RuleViolation[] = [];
  const fileByPath = new Map(graph.files.map((f) => [f.path, f]));

  for (const rule of rules) {
    if (rule.forbid) {
      const { from, to } = rule.forbid;
      for (const edge of graph.edges) {
        const a = fileByPath.get(edge.from);
        const b = fileByPath.get(edge.to);
        if (a && b && a.layer === from && b.layer === to) {
          violations.push({
            rule_id: rule.id,
            file: edge.from,
            detail: `${edge.from} (${from}) → ${edge.to} (${to}) is forbidden`,
          });
        }
      }
    }
    if (rule.max_imports_per_file) {
      const { layer, limit } = rule.max_imports_per_file;
      for (const f of graph.files) {
        if (f.layer === layer && f.imports_out.length > limit) {
          violations.push({
            rule_id: rule.id,
            file: f.path,
            detail: `imports_out=${f.imports_out.length} exceeds limit ${limit}`,
          });
        }
      }
    }
  }
  return violations;
}

/* -------------------------------------------------------------------------- */
/*  Failure simulation: remove each /core node, count unreachable from routes */
/* -------------------------------------------------------------------------- */

function reachableFromRoutes(graph: VirtualDependencyGraph, removed: Set<string>): Set<string> {
  const adj = new Map<string, string[]>();
  for (const f of graph.files) adj.set(f.path, []);
  for (const e of graph.edges) {
    if (removed.has(e.from) || removed.has(e.to)) continue;
    adj.get(e.from)!.push(e.to);
  }
  const seeds = graph.files.filter((f) => f.layer === "routes" && !removed.has(f.path)).map((f) => f.path);
  const visited = new Set<string>();
  const stack = [...seeds];
  while (stack.length) {
    const cur = stack.pop()!;
    if (visited.has(cur)) continue;
    visited.add(cur);
    for (const next of adj.get(cur) || []) if (!visited.has(next)) stack.push(next);
  }
  return visited;
}

function runFailureSim(graph: VirtualDependencyGraph): FailureSimResult[] {
  const baseline = reachableFromRoutes(graph, new Set()).size;
  const targets = graph.files.filter((f) => f.layer === "core" || f.layer === "services");
  const out: FailureSimResult[] = [];
  for (const t of targets) {
    const after = reachableFromRoutes(graph, new Set([t.path])).size;
    out.push({ removed_node: t.path, reachable_loss: Math.max(0, baseline - after) });
  }
  // Stable order
  out.sort((a, b) => b.reachable_loss - a.reachable_loss || a.removed_node.localeCompare(b.removed_node));
  return out;
}

/* -------------------------------------------------------------------------- */
/*  Scoring                                                                   */
/* -------------------------------------------------------------------------- */

function clamp(n: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

function scoreVariant(
  graph: VirtualDependencyGraph,
  violations: RuleViolation[],
  failures: FailureSimResult[],
  patterns: ReadonlyArray<KnownPattern>,
): VariantScore {
  const fileCount = graph.files.length || 1;
  const edgeCount = graph.edges.length;
  const avgFanOut = edgeCount / fileCount;

  // Architecture: penalize violations + reward stable pattern usage.
  const stabilityAvg =
    graph.files.reduce((sum, f) => {
      const p = patterns.find((x) => x.id === f.pattern_id);
      return sum + (p ? p.stability_score : 50);
    }, 0) / fileCount;
  const architecture_score = clamp(stabilityAvg - violations.length * 4);

  // Resilience: lower max single-node loss = more resilient.
  const maxLoss = failures.reduce((m, f) => Math.max(m, f.reachable_loss), 0);
  const resilience_score = clamp(100 - (maxLoss / fileCount) * 100);

  // Complexity: based on avg fan-out + edges per file. Higher = more complex.
  const complexity_score = clamp(avgFanOut * 20 + (edgeCount / fileCount) * 5);

  return { architecture_score, resilience_score, complexity_score };
}

function compositeScore(s: VariantScore): number {
  // Weighted: architecture 50%, resilience 35%, simplicity (inverse complexity) 15%.
  return Math.round(s.architecture_score * 0.5 + s.resilience_score * 0.35 + (100 - s.complexity_score) * 0.15);
}

/* -------------------------------------------------------------------------- */
/*  Public entry point                                                        */
/* -------------------------------------------------------------------------- */

const VARIANTS: VariantKind[] = ["low_coupling", "high_modularity", "performance"];

export function generateSyntheticUniverse(input: SyntheticUniverseInput): SyntheticUniverseReport {
  const sizes: Record<VirtualLayer, number> = { ...DEFAULT_SIZES, ...(input.layer_sizes || {}) };
  const variants: SyntheticArchitecture[] = VARIANTS.map((variant) => {
    const files = generateFiles(sizes, input.known_patterns, variant);
    const edges = buildEdges(files, input.known_patterns, input.dependency_constraints, variant);
    const graph: VirtualDependencyGraph = { files, edges };
    const violations = runRuleEngine(graph, input.architecture_rules);
    const failure_simulations = runFailureSim(graph);
    const scores = scoreVariant(graph, violations, failure_simulations, input.known_patterns);
    const composite = compositeScore(scores);
    return { variant, graph, violations, failure_simulations, scores, composite };
  });

  const best = [...variants].sort(
    (a, b) => b.composite - a.composite || a.variant.localeCompare(b.variant),
  )[0];

  return Object.freeze({
    generated_at: new Date().toISOString(),
    input_fingerprint: fingerprint(input),
    synthetic_architectures: variants,
    best_variant: best.variant,
    score_comparison: variants
      .map((v) => ({ variant: v.variant, composite: v.composite, scores: v.scores }))
      .sort((a, b) => b.composite - a.composite || a.variant.localeCompare(b.variant)),
  });
}
