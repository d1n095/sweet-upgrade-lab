/**
 * COMPLEXITY REDUCER
 *
 * Scans source files for:
 *   - deep nesting (>4 indent levels)
 *   - repeated patterns (same line ≥3 times within file)
 *   - unnecessary abstraction (single-export wrappers that just re-export)
 *
 * Outputs simplification suggestions only. No auto-rewrite.
 */

export interface ComplexityInput {
  sources: Record<string, string>;
}

export interface ComplexityFinding {
  file: string;
  kind: "deep_nesting" | "repeated_pattern" | "single_use_wrapper";
  detail: string;
  line_hint: number;
  suggestion: string;
}

export interface ComplexityReport {
  generated_at: string;
  files_scanned: number;
  summary: { deep_nesting: number; repeated_pattern: number; single_use_wrapper: number };
  findings: ReadonlyArray<ComplexityFinding>;
  notes: string;
}

const NEST_LIMIT = 4;
const REPEAT_LIMIT = 3;
const MIN_REPEAT_LEN = 25;

function maxIndentDepth(line: string): number {
  // 2-space indent or tab; cap to 12
  const m = line.match(/^(\s*)/);
  if (!m) return 0;
  const ws = m[1].replace(/\t/g, "  ");
  return Math.floor(ws.length / 2);
}

export function runComplexityReducer(input: ComplexityInput): ComplexityReport {
  const sources = input.sources ?? {};
  const findings: ComplexityFinding[] = [];
  let deep = 0,
    rep = 0,
    wrap = 0;
  let scanned = 0;

  for (const [file, src] of Object.entries(sources)) {
    if (typeof src !== "string" || !file.endsWith(".ts") && !file.endsWith(".tsx")) continue;
    scanned++;
    const lines = src.split("\n");

    // Deep nesting
    let maxDepth = 0;
    let maxLine = 0;
    for (let i = 0; i < lines.length; i++) {
      const d = maxIndentDepth(lines[i]);
      if (d > maxDepth) {
        maxDepth = d;
        maxLine = i + 1;
      }
    }
    if (maxDepth > NEST_LIMIT) {
      deep++;
      findings.push({
        file,
        kind: "deep_nesting",
        detail: `Indent depth ${maxDepth} exceeds limit of ${NEST_LIMIT}.`,
        line_hint: maxLine,
        suggestion: `Flatten with early returns / guard clauses / extracted helpers.`,
      });
    }

    // Repeated patterns
    const counts = new Map<string, number>();
    const firstSeen = new Map<string, number>();
    for (let i = 0; i < lines.length; i++) {
      const t = lines[i].trim();
      if (t.length < MIN_REPEAT_LEN) continue;
      if (t.startsWith("//") || t.startsWith("*") || t.startsWith("import ")) continue;
      counts.set(t, (counts.get(t) ?? 0) + 1);
      if (!firstSeen.has(t)) firstSeen.set(t, i + 1);
    }
    for (const [t, n] of counts.entries()) {
      if (n >= REPEAT_LIMIT) {
        rep++;
        findings.push({
          file,
          kind: "repeated_pattern",
          detail: `Line repeated ${n}× — "${t.slice(0, 60)}${t.length > 60 ? "…" : ""}"`,
          line_hint: firstSeen.get(t) ?? 1,
          suggestion: `Extract into a shared helper / constant / loop.`,
        });
        break; // one per file is enough
      }
    }

    // Single-use wrapper: file is small + only re-exports
    if (lines.length <= 6) {
      const reexportOnly = lines.every((l) => {
        const t = l.trim();
        return (
          t === "" ||
          t.startsWith("//") ||
          /^export\s+\{.*\}\s+from\s+/.test(t) ||
          /^export\s+\*\s+from\s+/.test(t) ||
          /^export\s+\{\s*default\s*\}\s+from\s+/.test(t)
        );
      });
      if (reexportOnly && lines.some((l) => /export/.test(l))) {
        wrap++;
        findings.push({
          file,
          kind: "single_use_wrapper",
          detail: `File only re-exports — adds an indirection layer.`,
          line_hint: 1,
          suggestion: `Import the underlying module directly and delete this file.`,
        });
      }
    }
  }

  return Object.freeze({
    generated_at: new Date().toISOString(),
    files_scanned: scanned,
    summary: { deep_nesting: deep, repeated_pattern: rep, single_use_wrapper: wrap },
    findings: Object.freeze(findings.slice(0, 20)),
    notes:
      findings.length === 0
        ? `Scanned ${scanned} file(s) — no simplification opportunities found.`
        : `${findings.length} simplification opportunity(ies) across ${scanned} file(s).`,
  });
}
