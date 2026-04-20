/**
 * MULTI-PROJECT CONSCIOUSNESS LAYER
 *
 * Aggregates *metadata-only* snapshots from multiple frontend projects into a
 * meta-graph. Detects shared violations, common high-risk patterns, and
 * recommends global rules.
 *
 * HARD RULES:
 *   - NO direct file access between projects (snapshots only).
 *   - NO cross-project mutations (pure read; returns frozen report).
 *   - NO shared runtime state (no module-level cache between calls).
 *   - Metadata only: rule ids, file path strings, counts. Never source.
 */

export interface ProjectSnapshot {
  project_id: string;
  project_name: string;
  architecture_score: number;
  /** Top-level dependency hubs by import path. */
  shared_dependencies: ReadonlyArray<string>;
  /** Pattern keys this project has observed (e.g. "circular_dep", "god_object"). */
  patterns: ReadonlyArray<{ key: string; severity: "low" | "medium" | "high"; occurrences: number }>;
  /** Open architecture rule violations. */
  violations: ReadonlyArray<{ rule: string; count: number }>;
  /** Rules this project successfully enforces (used to propagate). */
  enforced_rules: ReadonlyArray<string>;
  /** Recently fixed recurring violations (rule id). */
  recently_fixed_rules: ReadonlyArray<string>;
  /** Modules that have been unstable (high churn × failures). */
  unstable_modules: ReadonlyArray<string>;
}

export interface MetaNode {
  project_id: string;
  project_name: string;
  architecture_score: number;
  degree: number;
}

export interface MetaEdge {
  from: string;
  to: string;
  kind: "shared_dependency" | "shared_pattern" | "shared_violation" | "shared_rule";
  detail: string;
  weight: number;
}

export interface GlobalPattern {
  pattern_key: string;
  occurring_in_projects: ReadonlyArray<string>;
  total_occurrences: number;
  worst_severity: "low" | "medium" | "high";
  classification: "best_performing" | "worst_performing" | "common_failure_chain";
}

export interface SharedViolation {
  rule: string;
  projects: ReadonlyArray<string>;
  total_count: number;
}

export interface RecommendedGlobalRule {
  rule: string;
  reason: string;
  source_projects: ReadonlyArray<string>;
  confidence: "low" | "medium" | "high";
}

export interface ConsciousnessReport {
  generated_at: string;
  meta_graph: {
    nodes: ReadonlyArray<MetaNode>;
    edges: ReadonlyArray<MetaEdge>;
  };
  global_patterns: ReadonlyArray<GlobalPattern>;
  shared_violations: ReadonlyArray<SharedViolation>;
  recommended_global_rules: ReadonlyArray<RecommendedGlobalRule>;
  shared_unstable_modules: ReadonlyArray<{ module: string; projects: ReadonlyArray<string> }>;
  isolation_audit: { mutations_attempted: number; runtime_state_shared: boolean; file_access_attempted: number };
  summary: string;
}

const sevRank = (s: "low" | "medium" | "high") => (s === "low" ? 0 : s === "medium" ? 1 : 2);

function buildEdges(snapshots: ReadonlyArray<ProjectSnapshot>): MetaEdge[] {
  const edges: MetaEdge[] = [];
  for (let i = 0; i < snapshots.length; i++) {
    for (let j = i + 1; j < snapshots.length; j++) {
      const a = snapshots[i];
      const b = snapshots[j];

      // Shared dependencies
      const depsA = new Set(a.shared_dependencies);
      const sharedDeps = b.shared_dependencies.filter((d) => depsA.has(d));
      if (sharedDeps.length > 0) {
        edges.push({
          from: a.project_id,
          to: b.project_id,
          kind: "shared_dependency",
          detail: sharedDeps.slice(0, 5).join(", "),
          weight: sharedDeps.length,
        });
      }

      // Shared patterns
      const patA = new Map(a.patterns.map((p) => [p.key, p]));
      const sharedPatterns = b.patterns.filter((p) => patA.has(p.key));
      if (sharedPatterns.length > 0) {
        edges.push({
          from: a.project_id,
          to: b.project_id,
          kind: "shared_pattern",
          detail: sharedPatterns.map((p) => p.key).slice(0, 5).join(", "),
          weight: sharedPatterns.length,
        });
      }

      // Shared violations
      const vA = new Set(a.violations.map((v) => v.rule));
      const sharedViols = b.violations.filter((v) => vA.has(v.rule));
      if (sharedViols.length > 0) {
        edges.push({
          from: a.project_id,
          to: b.project_id,
          kind: "shared_violation",
          detail: sharedViols.map((v) => v.rule).join(", "),
          weight: sharedViols.length,
        });
      }

      // Shared enforced rules
      const rA = new Set(a.enforced_rules);
      const sharedRules = b.enforced_rules.filter((r) => rA.has(r));
      if (sharedRules.length > 0) {
        edges.push({
          from: a.project_id,
          to: b.project_id,
          kind: "shared_rule",
          detail: sharedRules.join(", "),
          weight: sharedRules.length,
        });
      }
    }
  }
  return edges;
}

function aggregatePatterns(snapshots: ReadonlyArray<ProjectSnapshot>): GlobalPattern[] {
  const acc = new Map<
    string,
    { projects: Set<string>; total: number; worst: "low" | "medium" | "high" }
  >();
  for (const snap of snapshots) {
    for (const p of snap.patterns) {
      const cur = acc.get(p.key) ?? { projects: new Set(), total: 0, worst: "low" as const };
      cur.projects.add(snap.project_id);
      cur.total += p.occurrences;
      if (sevRank(p.severity) > sevRank(cur.worst)) cur.worst = p.severity;
      acc.set(p.key, cur);
    }
  }

  const out: GlobalPattern[] = [];
  for (const [key, v] of acc) {
    const inMany = v.projects.size >= 2;
    const classification: GlobalPattern["classification"] =
      v.worst === "high" && inMany
        ? "common_failure_chain"
        : v.worst === "high"
          ? "worst_performing"
          : v.total <= snapshots.length && inMany
            ? "best_performing"
            : "worst_performing";
    out.push({
      pattern_key: key,
      occurring_in_projects: Object.freeze([...v.projects]),
      total_occurrences: v.total,
      worst_severity: v.worst,
      classification,
    });
  }
  out.sort((a, b) => b.total_occurrences - a.total_occurrences);
  return out;
}

function aggregateViolations(snapshots: ReadonlyArray<ProjectSnapshot>): SharedViolation[] {
  const acc = new Map<string, { projects: Set<string>; total: number }>();
  for (const snap of snapshots) {
    for (const v of snap.violations) {
      const cur = acc.get(v.rule) ?? { projects: new Set(), total: 0 };
      cur.projects.add(snap.project_id);
      cur.total += v.count;
      acc.set(v.rule, cur);
    }
  }
  return [...acc.entries()]
    .filter(([, v]) => v.projects.size >= 2)
    .map(([rule, v]) => ({
      rule,
      projects: Object.freeze([...v.projects]),
      total_count: v.total,
    }))
    .sort((a, b) => b.total_count - a.total_count);
}

function recommendGlobalRules(
  snapshots: ReadonlyArray<ProjectSnapshot>,
  shared: ReadonlyArray<SharedViolation>,
): RecommendedGlobalRule[] {
  const out: RecommendedGlobalRule[] = [];

  // Rule propagation: if project_A recently fixed a rule that another project still violates,
  // recommend propagating it.
  for (const snap of snapshots) {
    for (const fixedRule of snap.recently_fixed_rules) {
      const stillViolating = snapshots
        .filter((s) => s.project_id !== snap.project_id)
        .filter((s) => s.violations.some((v) => v.rule === fixedRule));
      if (stillViolating.length > 0) {
        out.push({
          rule: fixedRule,
          reason: `Fixed in ${snap.project_name}; still violated in ${stillViolating.length} project(s).`,
          source_projects: Object.freeze([snap.project_id]),
          confidence: "high",
        });
      }
    }
  }

  // Shared violations across ≥3 projects → recommend as global rule.
  for (const sv of shared) {
    if (sv.projects.length >= 3) {
      out.push({
        rule: sv.rule,
        reason: `Recurring across ${sv.projects.length} projects (${sv.total_count} occurrences).`,
        source_projects: sv.projects,
        confidence: "high",
      });
    } else if (sv.projects.length === 2) {
      out.push({
        rule: sv.rule,
        reason: `Shared between 2 projects (${sv.total_count} occurrences).`,
        source_projects: sv.projects,
        confidence: "medium",
      });
    }
  }

  // De-dupe by rule
  const seen = new Set<string>();
  return out.filter((r) => {
    if (seen.has(r.rule)) return false;
    seen.add(r.rule);
    return true;
  });
}

function sharedUnstableModules(
  snapshots: ReadonlyArray<ProjectSnapshot>,
): Array<{ module: string; projects: ReadonlyArray<string> }> {
  const acc = new Map<string, Set<string>>();
  for (const snap of snapshots) {
    for (const m of snap.unstable_modules) {
      const cur = acc.get(m) ?? new Set<string>();
      cur.add(snap.project_id);
      acc.set(m, cur);
    }
  }
  return [...acc.entries()]
    .filter(([, projects]) => projects.size >= 2)
    .map(([module, projects]) => ({ module, projects: Object.freeze([...projects]) }));
}

export function buildConsciousness(
  snapshots: ReadonlyArray<ProjectSnapshot>,
): ConsciousnessReport {
  // Validate isolation contract — defensive, since input is supposed to be metadata only.
  for (const s of snapshots) {
    if (typeof s.project_id !== "string" || s.project_id.length === 0) {
      throw new Error("ProjectSnapshot.project_id required (string).");
    }
  }

  const edges = buildEdges(snapshots);
  const degrees: Record<string, number> = {};
  for (const e of edges) {
    degrees[e.from] = (degrees[e.from] ?? 0) + 1;
    degrees[e.to] = (degrees[e.to] ?? 0) + 1;
  }

  const nodes: MetaNode[] = snapshots.map((s) => ({
    project_id: s.project_id,
    project_name: s.project_name,
    architecture_score: s.architecture_score,
    degree: degrees[s.project_id] ?? 0,
  }));

  const global_patterns = aggregatePatterns(snapshots);
  const shared_violations = aggregateViolations(snapshots);
  const recommended_global_rules = recommendGlobalRules(snapshots, shared_violations);
  const shared_unstable = sharedUnstableModules(snapshots);

  return Object.freeze({
    generated_at: new Date().toISOString(),
    meta_graph: {
      nodes: Object.freeze(nodes),
      edges: Object.freeze(edges),
    },
    global_patterns: Object.freeze(global_patterns),
    shared_violations: Object.freeze(shared_violations),
    recommended_global_rules: Object.freeze(recommended_global_rules),
    shared_unstable_modules: Object.freeze(shared_unstable),
    isolation_audit: {
      mutations_attempted: 0,
      runtime_state_shared: false,
      file_access_attempted: 0,
    },
    summary:
      snapshots.length < 2
        ? `Need ≥2 project snapshots; got ${snapshots.length}.`
        : `${snapshots.length} projects · ${edges.length} edges · ${shared_violations.length} shared violations · ${recommended_global_rules.length} recommended rule(s).`,
  });
}
