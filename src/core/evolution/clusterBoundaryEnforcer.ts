/**
 * CLUSTER BOUNDARY ENFORCER
 *
 * Prevents architecture fragmentation by enforcing strict cluster rules:
 *   R1 — every component file must belong to a cluster
 *   R2 — clusters cannot depend on undefined / unknown structure
 *   R3 — cross-cluster edges must respect responsibility direction
 *        (pages → components/hooks/stores/lib, components → hooks/stores/lib,
 *         hooks → stores/lib, stores → lib, lib → lib, core → lib/core)
 *
 * Auto-fix is SUGGESTION-ONLY (no file mutation):
 *   - assigns orphan components to the most likely cluster (by import affinity)
 *   - rebuilds broken cluster links by proposing the canonical target path
 *
 * Pure derivation. Safe to run on every render.
 */
import type { ClusterRegistry } from "./clusterIntelligence";

export type BoundaryRuleId = "R1" | "R2" | "R3";

export interface BoundaryViolation {
  rule: BoundaryRuleId;
  file: string;
  cluster_id: string | null;
  detail: string;
  evidence?: string;
}

export interface OrphanAssignment {
  file: string;
  suggested_cluster: string;
  reason: string;
  confidence: "low" | "medium" | "high";
}

export interface BrokenLinkFix {
  from: string;
  broken_target: string;
  suggested_target: string | null;
  reason: string;
}

export interface BoundaryReport {
  generated_at: string;
  status: "OK" | "WARN" | "FRAGMENTED";
  files_scanned: number;
  violations: ReadonlyArray<BoundaryViolation>;
  orphan_assignments: ReadonlyArray<OrphanAssignment>;
  broken_link_fixes: ReadonlyArray<BrokenLinkFix>;
  summary: {
    R1: number;
    R2: number;
    R3: number;
  };
  notes: string;
}

const RESPONSIBILITY_RANK: Record<string, number> = {
  "src/pages": 5,
  "src/components": 4,
  "src/hooks": 3,
  "src/stores": 2,
  "src/core": 2,
  "src/lib": 1,
  "src/services": 1,
  "src/utils": 1,
};

function responsibilityOf(path: string): string | null {
  for (const prefix of Object.keys(RESPONSIBILITY_RANK)) {
    if (path.startsWith(prefix)) return prefix;
  }
  return null;
}

function clusterIdFor(path: string): string {
  const m = path.match(/^src\/([^/]+)(?:\/([^/]+))?/);
  if (!m) return "root";
  return m[2] ? `${m[1]}/${m[2]}` : m[1];
}

export interface BoundaryInput {
  edges: Record<string, string[]>;
  registry: ClusterRegistry;
  /** files known to exist (used for R2 — undefined-target detection). */
  known_files?: ReadonlyArray<string>;
}

export function enforceClusterBoundaries(input: BoundaryInput): BoundaryReport {
  const { edges, registry } = input;
  const known = new Set(input.known_files ?? Object.keys(edges));
  const fileToCluster: Record<string, string> = {};
  for (const c of registry.clusters) {
    for (const f of c.files) fileToCluster[f] = c.id;
  }

  const violations: BoundaryViolation[] = [];
  const orphan_assignments: OrphanAssignment[] = [];
  const broken_link_fixes: BrokenLinkFix[] = [];

  const allFiles = Object.keys(edges);

  // R1 — orphan detection
  for (const file of allFiles) {
    if (!fileToCluster[file]) {
      violations.push({
        rule: "R1",
        file,
        cluster_id: null,
        detail: "File exists outside any registered cluster.",
      });
      // Suggest a cluster: count how many of its imports go to a single cluster
      const tally: Record<string, number> = {};
      for (const dep of edges[file] ?? []) {
        const cid = fileToCluster[dep];
        if (cid) tally[cid] = (tally[cid] ?? 0) + 1;
      }
      const ranked = Object.entries(tally).sort((a, b) => b[1] - a[1]);
      const guess = ranked[0]?.[0] ?? clusterIdFor(file);
      const total = ranked.reduce((a, b) => a + b[1], 0);
      const top = ranked[0]?.[1] ?? 0;
      const conf: OrphanAssignment["confidence"] =
        total >= 4 && top / Math.max(1, total) > 0.6
          ? "high"
          : total >= 2
            ? "medium"
            : "low";
      orphan_assignments.push({
        file,
        suggested_cluster: guess,
        reason:
          total > 0
            ? `Most imports (${top}/${total}) point to "${guess}".`
            : `No imports — fall back to path-derived cluster "${guess}".`,
        confidence: conf,
      });
    }
  }

  // R2 — undefined target detection
  for (const [from, deps] of Object.entries(edges)) {
    for (const to of deps) {
      if (!known.has(to)) {
        violations.push({
          rule: "R2",
          file: from,
          cluster_id: fileToCluster[from] ?? null,
          detail: `Imports undefined structure: ${to}`,
          evidence: to,
        });
        // Suggest a canonical target if the basename matches a known file
        const base = to.split("/").pop() ?? "";
        const candidate =
          [...known].find((k) => k.endsWith("/" + base)) ?? null;
        broken_link_fixes.push({
          from,
          broken_target: to,
          suggested_target: candidate,
          reason: candidate
            ? `Found a file with the same basename: ${candidate}`
            : "No same-name file in registry — verify path or remove import.",
        });
      }
    }
  }

  // R3 — responsibility direction
  for (const [from, deps] of Object.entries(edges)) {
    const fromR = responsibilityOf(from);
    if (!fromR) continue;
    const fromRank = RESPONSIBILITY_RANK[fromR];
    for (const to of deps) {
      const toR = responsibilityOf(to);
      if (!toR) continue;
      const toRank = RESPONSIBILITY_RANK[toR];
      // Lower-layer files cannot import higher-layer files
      if (toRank > fromRank) {
        violations.push({
          rule: "R3",
          file: from,
          cluster_id: fileToCluster[from] ?? null,
          detail: `Layer "${fromR}" must not import from higher layer "${toR}".`,
          evidence: to,
        });
      }
    }
  }

  const summary = {
    R1: violations.filter((v) => v.rule === "R1").length,
    R2: violations.filter((v) => v.rule === "R2").length,
    R3: violations.filter((v) => v.rule === "R3").length,
  };

  const total = summary.R1 + summary.R2 + summary.R3;
  const status: BoundaryReport["status"] =
    total === 0 ? "OK" : total > 20 || summary.R2 > 5 ? "FRAGMENTED" : "WARN";

  return Object.freeze({
    generated_at: new Date().toISOString(),
    status,
    files_scanned: allFiles.length,
    violations: Object.freeze(violations),
    orphan_assignments: Object.freeze(orphan_assignments),
    broken_link_fixes: Object.freeze(broken_link_fixes),
    summary,
    notes:
      total === 0
        ? "All cluster boundaries intact."
        : `${total} boundary issue(s). Auto-fix is suggestion-only — review before applying.`,
  });
}
