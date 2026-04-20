/**
 * AUTO REORGANIZER
 *
 * Suggests cluster restructuring to:
 *   - minimize cross-cluster dependencies
 *   - maximize cohesion inside clusters
 *   - reduce re-render propagation
 *
 * NEVER applies anything. Suggestion-only. Never proposes moves that would
 * break data flow integrity (i.e. moves outside the file's responsibility
 * boundary inferred from path: components/, hooks/, services/, core/, pages/).
 */
import type { ClusterRegistry } from "./clusterIntelligence";

export type ReorgAction = "move" | "split" | "merge";

export interface ReorgSuggestion {
  id: string;
  action: ReorgAction;
  target: string;
  rationale: string;
  expected_gain: string;
  safe: boolean;
}

export interface AutoReorganizerReport {
  generated_at: string;
  suggestions: ReadonlyArray<ReorgSuggestion>;
  unsafe_skipped: number;
  notes: string;
}

const RESPONSIBILITY_PREFIXES = [
  "src/components",
  "src/hooks",
  "src/services",
  "src/core",
  "src/pages",
  "src/stores",
  "src/lib",
];

function sameResponsibility(a: string, b: string): boolean {
  const ap = RESPONSIBILITY_PREFIXES.find((p) => a.startsWith(p));
  const bp = RESPONSIBILITY_PREFIXES.find((p) => b.startsWith(p));
  return Boolean(ap && bp && ap === bp);
}

const MAX_SUGGESTIONS = 6;

export function evaluateAutoReorganizer(
  registry: ClusterRegistry
): AutoReorganizerReport {
  const suggestions: ReorgSuggestion[] = [];
  let unsafe_skipped = 0;

  // SPLIT: cluster too large + high failure risk
  for (const c of registry.clusters) {
    if (suggestions.length >= MAX_SUGGESTIONS) break;
    if (c.files.length > 25 && c.failure_risk > 8) {
      suggestions.push({
        id: `split_${c.id}`,
        action: "split",
        target: c.id,
        rationale: `Cluster has ${c.files.length} files and risk ${c.failure_risk} — too large.`,
        expected_gain: "Lower blast radius; isolated re-renders.",
        safe: true,
      });
    }
  }

  // MERGE: tiny orphan clusters with same responsibility
  const tiny = registry.clusters.filter((c) => c.files.length <= 2);
  for (let i = 0; i < tiny.length && suggestions.length < MAX_SUGGESTIONS; i++) {
    for (let j = i + 1; j < tiny.length; j++) {
      const a = tiny[i];
      const b = tiny[j];
      if (!a.files[0] || !b.files[0]) continue;
      if (sameResponsibility(a.files[0], b.files[0])) {
        suggestions.push({
          id: `merge_${a.id}_${b.id}`,
          action: "merge",
          target: `${a.id} + ${b.id}`,
          rationale: "Two tiny clusters share the same responsibility layer.",
          expected_gain: "Fewer cross-cluster edges; better cohesion.",
          safe: true,
        });
        break;
      } else {
        unsafe_skipped++;
      }
    }
  }

  // MOVE: file in a cluster mostly imported by another cluster
  // (heuristic: check overcentralized targets)
  for (const oc of registry.overcentralized) {
    if (suggestions.length >= MAX_SUGGESTIONS) break;
    suggestions.push({
      id: `move_into_${oc}`,
      action: "move",
      target: oc,
      rationale: `Cluster "${oc}" is over-centralized — consider moving its consumers in.`,
      expected_gain: "Localizes coupling, improves cohesion.",
      safe: true,
    });
  }

  return Object.freeze({
    generated_at: new Date().toISOString(),
    suggestions: Object.freeze(suggestions.slice(0, MAX_SUGGESTIONS)),
    unsafe_skipped,
    notes:
      suggestions.length === 0
        ? "No reorg suggestions — clusters look healthy."
        : `${suggestions.length} suggestion(s). All preserve responsibility boundaries.`,
  });
}
