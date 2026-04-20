/**
 * CODE QUARANTINE
 *
 * Treats bad code as infections. Combines existing signals to flag modules
 * that should be isolated to prevent further "spread":
 *   - anti-patterns        → high coupling
 *   - unstable modules     → high churn
 *   - fragile logic        → historical bug occurrences on this surface
 *
 * Suggests isolation boundaries + healing actions. No auto-quarantine.
 */

export interface QuarantineInput {
  edges: Record<string, string[]>;
  change_counts?: Record<string, number>;
  bug_counts?: Record<string, number>;
}

export type Severity = "watch" | "isolate" | "critical";

export interface InfectedModule {
  file: string;
  coupling: number;
  churn: number;
  bugs: number;
  infection_score: number;
  severity: Severity;
  reasons: ReadonlyArray<string>;
}

export interface HealingAction {
  file: string;
  action: "extract_pure_core" | "wrap_with_facade" | "split_responsibilities" | "add_tests" | "freeze_api";
  rationale: string;
}

export interface QuarantineReport {
  generated_at: string;
  totals: { watch: number; isolate: number; critical: number };
  infected: ReadonlyArray<InfectedModule>;
  isolation_boundaries: ReadonlyArray<{ file: string; isolate_from: ReadonlyArray<string> }>;
  healing: ReadonlyArray<HealingAction>;
  notes: string;
}

export function runCodeQuarantine(input: QuarantineInput): QuarantineReport {
  const edges = input.edges ?? {};
  const change = input.change_counts ?? {};
  const bugs = input.bug_counts ?? {};

  const allFiles = new Set<string>(Object.keys(edges));
  for (const deps of Object.values(edges)) for (const d of deps) allFiles.add(d);

  const inDeg: Record<string, number> = {};
  const outDeg: Record<string, number> = {};
  for (const [from, deps] of Object.entries(edges)) {
    outDeg[from] = deps.length;
    for (const to of deps) inDeg[to] = (inDeg[to] ?? 0) + 1;
  }

  const infected: InfectedModule[] = [];
  for (const f of allFiles) {
    const coupling = (inDeg[f] ?? 0) + (outDeg[f] ?? 0);
    const churn = change[f] ?? 0;
    const bug = bugs[f] ?? 0;
    const score = coupling + churn * 3 + bug * 6;
    if (score < 12) continue;
    const reasons: string[] = [];
    if (coupling >= 8) reasons.push(`coupling ${coupling}`);
    if (churn >= 3) reasons.push(`churn ${churn}`);
    if (bug > 0) reasons.push(`${bug} historical bug(s)`);
    let severity: Severity = "watch";
    if (score >= 30) severity = "critical";
    else if (score >= 18) severity = "isolate";
    infected.push({
      file: f,
      coupling,
      churn,
      bugs: bug,
      infection_score: score,
      severity,
      reasons,
    });
  }
  infected.sort((a, b) => b.infection_score - a.infection_score);

  const isolation_boundaries: Array<{ file: string; isolate_from: string[] }> = [];
  for (const m of infected.slice(0, 8)) {
    if (m.severity === "watch") continue;
    const importedBy: string[] = [];
    for (const [from, deps] of Object.entries(edges)) {
      if (deps.includes(m.file)) importedBy.push(from);
    }
    if (importedBy.length === 0) continue;
    isolation_boundaries.push({
      file: m.file,
      isolate_from: importedBy.slice(0, 6),
    });
  }

  const healing: HealingAction[] = [];
  for (const m of infected.slice(0, 8)) {
    if (m.bugs > 0) {
      healing.push({
        file: m.file,
        action: "add_tests",
        rationale: `Lock current behavior before refactor (${m.bugs} historical bug(s)).`,
      });
    }
    if (m.coupling >= 8) {
      healing.push({
        file: m.file,
        action: m.severity === "critical" ? "split_responsibilities" : "wrap_with_facade",
        rationale: `Reduce blast radius — ${m.coupling} edges touch this file.`,
      });
    }
    if (m.churn >= 4) {
      healing.push({
        file: m.file,
        action: "freeze_api",
        rationale: `Stabilize public API; iterate internals only.`,
      });
    }
    if (healing.length >= 12) break;
  }

  const totals = {
    watch: infected.filter((i) => i.severity === "watch").length,
    isolate: infected.filter((i) => i.severity === "isolate").length,
    critical: infected.filter((i) => i.severity === "critical").length,
  };

  return Object.freeze({
    generated_at: new Date().toISOString(),
    totals,
    infected: Object.freeze(infected.slice(0, 12)),
    isolation_boundaries: Object.freeze(isolation_boundaries),
    healing: Object.freeze(healing.slice(0, 12)),
    notes:
      infected.length === 0
        ? "No infected modules detected."
        : `${totals.critical} critical, ${totals.isolate} to isolate, ${totals.watch} on watchlist.`,
  });
}
