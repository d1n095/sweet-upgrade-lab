/**
 * EVOLUTION TRACKER — long-term refactor pattern detector.
 *
 * Inputs:
 *   - change_log entries (file -> change count over a window)
 *   - dep graph (coupling per file)
 *   - failure memory (instability counts per file/component)
 *
 * Output:
 *   - unstable modules (high churn × high failures)
 *   - frequently rewritten files (top churn)
 *   - recurring refactor patterns (folders where churn is broadly distributed)
 *   - abstraction / modularization suggestions
 *
 * Goal: lower future complexity, not just current. Suggest-only.
 */

export interface EvolutionInputs {
  /** file path -> # of times mentioned in change_log within the window */
  change_counts: Record<string, number>;
  /** file path -> coupling score (in_degree + out_degree) */
  coupling: Record<string, number>;
  /** file path -> failure occurrences (functional_failure_memory) */
  failures?: Record<string, number>;
}

export type EvolutionFindingKind =
  | "unstable_module"
  | "frequent_rewrite"
  | "recurring_pattern"
  | "abstraction_opportunity"
  | "modularization_point";

export interface EvolutionFinding {
  kind: EvolutionFindingKind;
  target: string;
  metric: string;
  suggestion: string;
}

export interface EvolutionReport {
  generated_at: string;
  window_size: number;
  findings: ReadonlyArray<EvolutionFinding>;
  hot_files: ReadonlyArray<{ file: string; changes: number; coupling: number; failures: number }>;
  hot_folders: ReadonlyArray<{ folder: string; changes: number; files: number }>;
  notes: string;
}

function folderOf(p: string): string {
  const parts = p.split("/");
  return parts.slice(0, Math.min(3, parts.length - 1)).join("/") || "root";
}

export function runEvolutionTracker(inputs: EvolutionInputs): EvolutionReport {
  const failures = inputs.failures ?? {};
  const all = new Set<string>([
    ...Object.keys(inputs.change_counts),
    ...Object.keys(inputs.coupling),
    ...Object.keys(failures),
  ]);

  const rows = [...all].map((f) => ({
    file: f,
    changes: inputs.change_counts[f] ?? 0,
    coupling: inputs.coupling[f] ?? 0,
    failures: failures[f] ?? 0,
  }));

  const totalChanges = rows.reduce((s, r) => s + r.changes, 0);

  const findings: EvolutionFinding[] = [];

  // unstable: high churn × high failures
  for (const r of rows) {
    if (r.changes >= 5 && r.failures >= 2) {
      findings.push({
        kind: "unstable_module",
        target: r.file,
        metric: `changes=${r.changes}, failures=${r.failures}`,
        suggestion: "Treat as quarantined — write characterization tests before next change.",
      });
    }
  }

  // frequent_rewrite: top churn
  const byChurn = [...rows].sort((a, b) => b.changes - a.changes).filter((r) => r.changes >= 4);
  for (const r of byChurn.slice(0, 6)) {
    findings.push({
      kind: "frequent_rewrite",
      target: r.file,
      metric: `${r.changes} edits in window`,
      suggestion: "Likely missing the right abstraction — extract the volatile concept.",
    });
  }

  // abstraction opportunity: high coupling + high churn
  for (const r of rows) {
    if (r.coupling >= 8 && r.changes >= 4) {
      findings.push({
        kind: "abstraction_opportunity",
        target: r.file,
        metric: `coupling=${r.coupling}, changes=${r.changes}`,
        suggestion: "Hide behind a stable interface; let consumers depend on the contract, not the file.",
      });
    }
  }

  // modularization: oversized + churning
  for (const r of rows) {
    if (r.coupling >= 12) {
      findings.push({
        kind: "modularization_point",
        target: r.file,
        metric: `coupling=${r.coupling}`,
        suggestion: "Split this module along its responsibilities — one reason to change per file.",
      });
    }
  }

  // recurring pattern: folder where many files churn
  const folderAgg: Record<string, { changes: number; files: Set<string> }> = {};
  for (const r of rows) {
    if (r.changes === 0) continue;
    const fld = folderOf(r.file);
    (folderAgg[fld] ??= { changes: 0, files: new Set() }).changes += r.changes;
    folderAgg[fld].files.add(r.file);
  }
  const hotFolders = Object.entries(folderAgg)
    .map(([folder, v]) => ({ folder, changes: v.changes, files: v.files.size }))
    .sort((a, b) => b.changes - a.changes);
  for (const f of hotFolders.slice(0, 3)) {
    if (f.files >= 4 && f.changes >= 10) {
      findings.push({
        kind: "recurring_pattern",
        target: f.folder,
        metric: `${f.changes} edits across ${f.files} files`,
        suggestion: "Recurring churn here — consider a small shared layer or rename to clarify intent.",
      });
    }
  }

  return Object.freeze({
    generated_at: new Date().toISOString(),
    window_size: totalChanges,
    findings: Object.freeze(findings.slice(0, 25)),
    hot_files: Object.freeze(byChurn.slice(0, 8)),
    hot_folders: Object.freeze(hotFolders.slice(0, 5)),
    notes:
      findings.length === 0
        ? "No long-term complexity signals — codebase is evolving cleanly."
        : `${findings.length} long-term signal(s). All suggestions are advisory.`,
  });
}
