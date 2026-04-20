/**
 * INTEGRITY MONITOR — silent background watcher.
 *
 * Continuously checks 4 invariants:
 *   - no broken imports
 *   - no circular dependencies
 *   - no unused exports (proxied via orphan modules)
 *   - no uncontrolled side effects (top-level non-import statements
 *     that run code at module load — naive heuristic)
 *
 * Surface-only when CRITICAL. Suggest-only. Never stops real builds.
 */

export type IntegrityRule =
  | "broken_imports"
  | "circular_dependencies"
  | "unused_exports"
  | "uncontrolled_side_effects";

export type IntegritySeverity = "ok" | "warn" | "critical";

export interface IntegrityViolation {
  rule: IntegrityRule;
  severity: IntegritySeverity;
  file: string;
  detail: string;
  fix: string;
}

export interface IntegrityInputs {
  edges: Record<string, string[]>;
  known_files: ReadonlyArray<string>;
  /** raw source map (path -> source) for side-effect heuristic */
  sources: Record<string, string>;
  /** orphan list from projectStructureAnalyzer (proxy for unused exports) */
  orphans: ReadonlyArray<string>;
  /** circular dep file groups */
  cycles: ReadonlyArray<ReadonlyArray<string>>;
}

export interface IntegrityReport {
  generated_at: string;
  status: IntegritySeverity;
  would_stop_build: boolean;
  violations: ReadonlyArray<IntegrityViolation>;
  summary: Record<IntegrityRule, number>;
  notes: string;
}

const SAFE_TOP_LEVEL = /^(import\b|export\b|\/\/|\/\*|\*|type\b|interface\b|const\b|let\b|var\b|function\b|class\b|enum\b|declare\b|namespace\b|\}|\)|;|$)/;

function detectSideEffects(path: string, src: string): string | null {
  // Only check .ts/.tsx modules in src/
  if (!/^src\/.+\.(ts|tsx)$/.test(path)) return null;
  const lines = src.split("\n");
  let depth = 0;
  for (let i = 0; i < lines.length && i < 400; i++) {
    const raw = lines[i];
    const line = raw.trim();
    // track {} depth roughly to skip nested code
    for (const ch of line) {
      if (ch === "{") depth++;
      else if (ch === "}") depth = Math.max(0, depth - 1);
    }
    if (depth > 0) continue;
    if (!line) continue;
    if (SAFE_TOP_LEVEL.test(line)) continue;
    // function call at top level → likely side effect
    if (/^[A-Za-z_$][\w$.]*\s*\(/.test(line)) {
      return `Top-level call at line ${i + 1}: "${line.slice(0, 60)}"`;
    }
  }
  return null;
}

export function runIntegrityMonitor(inputs: IntegrityInputs): IntegrityReport {
  const known = new Set(inputs.known_files);
  const violations: IntegrityViolation[] = [];

  // broken imports
  for (const [from, deps] of Object.entries(inputs.edges)) {
    for (const to of deps) {
      if (!known.has(to)) {
        violations.push({
          rule: "broken_imports",
          severity: "critical",
          file: from,
          detail: `Imports unknown path: ${to}`,
          fix: `Update the import in ${from} or remove the dead reference.`,
        });
      }
    }
  }

  // cycles
  for (const c of inputs.cycles.slice(0, 8)) {
    if (c.length < 2) continue;
    violations.push({
      rule: "circular_dependencies",
      severity: "critical",
      file: c[0],
      detail: `Cycle: ${c.join(" → ")}`,
      fix: `Extract shared symbols into a neutral module both files can import.`,
    });
  }

  // unused exports (proxy: orphans)
  for (const f of inputs.orphans.slice(0, 12)) {
    violations.push({
      rule: "unused_exports",
      severity: "warn",
      file: f,
      detail: "Module has no incoming or outgoing imports.",
      fix: "Inline or delete if no longer needed; otherwise wire it into a consumer.",
    });
  }

  // side effects
  let sideChecked = 0;
  for (const [path, src] of Object.entries(inputs.sources)) {
    if (sideChecked > 60) break;
    sideChecked++;
    const issue = detectSideEffects(path.replace(/^\//, ""), src);
    if (issue) {
      violations.push({
        rule: "uncontrolled_side_effects",
        severity: "warn",
        file: path.replace(/^\//, ""),
        detail: issue,
        fix: "Wrap the side effect in a function the caller invokes explicitly.",
      });
    }
  }

  const summary: Record<IntegrityRule, number> = {
    broken_imports: 0,
    circular_dependencies: 0,
    unused_exports: 0,
    uncontrolled_side_effects: 0,
  };
  for (const v of violations) summary[v.rule]++;

  const status: IntegritySeverity =
    summary.broken_imports > 0 || summary.circular_dependencies > 0
      ? "critical"
      : violations.length > 0
        ? "warn"
        : "ok";

  return Object.freeze({
    generated_at: new Date().toISOString(),
    status,
    would_stop_build: status === "critical",
    violations: Object.freeze(violations.slice(0, 30)),
    summary,
    notes:
      status === "ok"
        ? "Integrity clean — silent."
        : `${violations.length} violation(s). Critical issues would stop build (suggest-only here).`,
  });
}
