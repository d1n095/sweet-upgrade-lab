/**
 * INTENT ALIGNMENT
 *
 * Compares actual code structure to intended architecture:
 *   - layer rules (pages > components > hooks > stores/core > lib/utils)
 *   - accidental complexity (newly very-coupled files)
 *   - misaligned implementations (recent edits crossing layer boundaries)
 *
 * Produces a per-cluster verdict: matches intent? yes / partial / no.
 * Suggest-only.
 */

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

export interface IntentAlignmentInput {
  edges: Record<string, string[]>;
  change_counts?: Record<string, number>;
  /** files reported as having coupling/violations from existing engines */
  high_coupling_files?: ReadonlyArray<string>;
}

export type Verdict = "matches" | "partial" | "misaligned";

export interface Deviation {
  file: string;
  kind: "layer_violation" | "accidental_complexity" | "recent_misalignment";
  detail: string;
  fix: string;
}

export interface ClusterVerdict {
  cluster_id: string;
  verdict: Verdict;
  reason: string;
}

export interface IntentAlignmentReport {
  generated_at: string;
  deviations: ReadonlyArray<Deviation>;
  cluster_verdicts: ReadonlyArray<ClusterVerdict>;
  summary: { matches: number; partial: number; misaligned: number };
  notes: string;
}

function layerOf(path: string): { name: string; rank: number } | null {
  for (const k of Object.keys(LAYER_RANK))
    if (path.startsWith(k)) return { name: k, rank: LAYER_RANK[k] };
  return null;
}

function clusterIdFor(path: string): string {
  const m = path.match(/^src\/([^/]+)(?:\/([^/]+))?/);
  if (!m) return "root";
  return m[2] ? `${m[1]}/${m[2]}` : m[1];
}

export function evaluateIntentAlignment(
  input: IntentAlignmentInput
): IntentAlignmentReport {
  const edges = input.edges ?? {};
  const change = input.change_counts ?? {};
  const couplingSet = new Set(input.high_coupling_files ?? []);

  const deviations: Deviation[] = [];

  for (const [from, deps] of Object.entries(edges)) {
    const fromL = layerOf(from);
    if (!fromL) continue;
    for (const to of deps) {
      const toL = layerOf(to);
      if (!toL) continue;
      if (toL.rank > fromL.rank) {
        deviations.push({
          file: from,
          kind: "layer_violation",
          detail: `${fromL.name} imports from higher layer ${toL.name} (${to})`,
          fix: `Move shared logic into a lower layer (lib/utils) or invert the dependency.`,
        });
      }
    }
  }

  for (const f of couplingSet) {
    if ((change[f] ?? 0) >= 3) {
      deviations.push({
        file: f,
        kind: "accidental_complexity",
        detail: `Hot file (${change[f]} recent edits) with high coupling — likely accumulated unintended responsibilities.`,
        fix: `Extract one cohesive concern into a new module; keep public API stable.`,
      });
    }
  }

  for (const [from, deps] of Object.entries(edges)) {
    if ((change[from] ?? 0) < 2) continue;
    const fromL = layerOf(from);
    if (!fromL) continue;
    const distinctLayers = new Set<string>();
    for (const to of deps) {
      const toL = layerOf(to);
      if (toL) distinctLayers.add(toL.name);
    }
    if (distinctLayers.size >= 4) {
      deviations.push({
        file: from,
        kind: "recent_misalignment",
        detail: `Recent edit reaches across ${distinctLayers.size} layers — drift from cohesive design.`,
        fix: `Split by responsibility or move cross-cutting logic into a thin coordinator.`,
      });
    }
  }

  const byCluster: Record<string, { violations: number; total: number }> = {};
  for (const f of new Set([...Object.keys(edges), ...Object.values(edges).flat()])) {
    const cid = clusterIdFor(f);
    (byCluster[cid] ??= { violations: 0, total: 0 }).total += 1;
  }
  for (const d of deviations) {
    const cid = clusterIdFor(d.file);
    (byCluster[cid] ??= { violations: 0, total: 0 }).violations += 1;
  }

  const cluster_verdicts: ClusterVerdict[] = [];
  let matches = 0,
    partial = 0,
    misaligned = 0;
  for (const [cid, c] of Object.entries(byCluster)) {
    const ratio = c.total === 0 ? 0 : c.violations / c.total;
    let v: Verdict;
    if (ratio === 0) {
      v = "matches";
      matches++;
    } else if (ratio < 0.15) {
      v = "partial";
      partial++;
    } else {
      v = "misaligned";
      misaligned++;
    }
    cluster_verdicts.push({
      cluster_id: cid,
      verdict: v,
      reason: `${c.violations} deviation(s) over ${c.total} file(s) (${(ratio * 100).toFixed(0)}%)`,
    });
  }
  cluster_verdicts.sort((a, b) => {
    const order = { misaligned: 0, partial: 1, matches: 2 };
    return order[a.verdict] - order[b.verdict];
  });

  return Object.freeze({
    generated_at: new Date().toISOString(),
    deviations: Object.freeze(deviations.slice(0, 20)),
    cluster_verdicts: Object.freeze(cluster_verdicts.slice(0, 12)),
    summary: { matches, partial, misaligned },
    notes:
      deviations.length === 0
        ? "All clusters match intended architecture."
        : `${deviations.length} deviation(s) across ${misaligned + partial} cluster(s).`,
  });
}
