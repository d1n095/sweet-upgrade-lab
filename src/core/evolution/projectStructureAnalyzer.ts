/**
 * PROJECT STRUCTURE ANALYZER
 *
 * Real-time, suggestion-only structural analyzer over the dep graph.
 * Detects:
 *   - circular dependencies (file-level cycles)
 *   - orphan modules (no in/out edges, no entrypoint)
 *   - duplicated logic (basename collisions across folders)
 *   - broken import paths (target file unknown to graph)
 *   - inconsistent folder patterns (naming + casing drift)
 *
 * Produces diff-style suggestions for:
 *   - folder restructuring
 *   - naming normalization
 *   - safe import refactors
 *   - layer collapse
 *
 * Constraints (hard):
 *   - never write files (suggestion only)
 *   - never introduce new abstractions
 *   - preserve developer intent
 *   - output is diff-shaped text the dev can apply manually
 */

export interface StructureGraphInput {
  edges: Record<string, string[]>;
  /** optional list of files known to exist; defaults to keys of edges */
  known_files?: ReadonlyArray<string>;
}

export type StructureFindingKind =
  | "circular_dependency"
  | "orphan_module"
  | "duplicated_logic"
  | "broken_import"
  | "inconsistent_pattern";

export interface StructureFinding {
  kind: StructureFindingKind;
  severity: "info" | "warn" | "critical";
  files: ReadonlyArray<string>;
  detail: string;
}

export interface StructureSuggestion {
  id: string;
  category: "restructure" | "rename" | "refactor_import" | "collapse_layer";
  rationale: string;
  diff: string; // unified-diff-style preview
  safe: boolean;
}

export interface StructureReport {
  generated_at: string;
  status: "OK" | "WARN" | "DEGRADED";
  files_scanned: number;
  findings: ReadonlyArray<StructureFinding>;
  suggestions: ReadonlyArray<StructureSuggestion>;
  summary: Record<StructureFindingKind, number>;
  notes: string;
}

const ENTRYPOINT_HINTS = ["src/main.tsx", "src/App.tsx", "index.html"];

function findCycles(edges: Record<string, string[]>): string[][] {
  const cycles: string[][] = [];
  const visiting = new Set<string>();
  const visited = new Set<string>();

  function dfs(node: string, stack: string[]) {
    if (visiting.has(node)) {
      const idx = stack.indexOf(node);
      if (idx >= 0) cycles.push(stack.slice(idx).concat(node));
      return;
    }
    if (visited.has(node)) return;
    visiting.add(node);
    stack.push(node);
    for (const nb of edges[node] ?? []) dfs(nb, stack);
    stack.pop();
    visiting.delete(node);
    visited.add(node);
  }

  for (const n of Object.keys(edges)) dfs(n, []);
  return cycles.slice(0, 10);
}

function basename(p: string): string {
  return p.split("/").pop() ?? p;
}

function camelize(s: string): string {
  return s
    .replace(/[-_]([a-z])/g, (_, c) => c.toUpperCase())
    .replace(/^[a-z]/, (c) => c.toUpperCase());
}

function diffLine(from: string, to: string): string {
  return `--- ${from}\n+++ ${to}`;
}

export function analyzeProjectStructure(
  input: StructureGraphInput
): StructureReport {
  const known = new Set(input.known_files ?? Object.keys(input.edges));
  const edges = input.edges;
  const allFiles = Object.keys(edges);

  const findings: StructureFinding[] = [];
  const suggestions: StructureSuggestion[] = [];

  // --- circular deps ---
  const cycles = findCycles(edges);
  for (const c of cycles) {
    findings.push({
      kind: "circular_dependency",
      severity: "critical",
      files: c,
      detail: `Cycle: ${c.join(" → ")}`,
    });
    suggestions.push({
      id: `cycle_${c[0]}`,
      category: "refactor_import",
      rationale: `Break the cycle by extracting shared types/constants from "${c[0]}".`,
      diff: `${diffLine(c[0], c[0])}\n- import { X } from "${c[1]}"\n+ // move X to a shared module both files can import`,
      safe: false,
    });
  }

  // --- orphans ---
  const inDeg: Record<string, number> = {};
  for (const deps of Object.values(edges)) {
    for (const d of deps) inDeg[d] = (inDeg[d] ?? 0) + 1;
  }
  for (const f of allFiles) {
    const incoming = inDeg[f] ?? 0;
    const outgoing = (edges[f] ?? []).length;
    const isEntry = ENTRYPOINT_HINTS.some((h) => f.endsWith(h));
    if (incoming === 0 && outgoing === 0 && !isEntry) {
      findings.push({
        kind: "orphan_module",
        severity: "warn",
        files: [f],
        detail: "No incoming or outgoing imports.",
      });
    }
  }

  // --- duplicated logic (basename collision) ---
  const byBase: Record<string, string[]> = {};
  for (const f of allFiles) {
    const b = basename(f).replace(/\.(t|j)sx?$/, "");
    (byBase[b] ??= []).push(f);
  }
  for (const [b, files] of Object.entries(byBase)) {
    if (files.length >= 2 && b.length > 2) {
      findings.push({
        kind: "duplicated_logic",
        severity: "info",
        files,
        detail: `${files.length} files share basename "${b}".`,
      });
    }
  }

  // --- broken imports ---
  for (const [from, deps] of Object.entries(edges)) {
    for (const to of deps) {
      if (!known.has(to)) {
        findings.push({
          kind: "broken_import",
          severity: "critical",
          files: [from],
          detail: `Imports unknown path: ${to}`,
        });
        const candidate = [...known].find((k) => k.endsWith("/" + basename(to)));
        if (candidate) {
          suggestions.push({
            id: `fix_import_${from}_${to}`,
            category: "refactor_import",
            rationale: "Same basename exists at a different path.",
            diff: `${diffLine(from, from)}\n- import ... from "${to}"\n+ import ... from "${candidate}"`,
            safe: true,
          });
        }
      }
    }
  }

  // --- inconsistent patterns (PascalCase vs kebab in components) ---
  for (const f of allFiles) {
    if (!f.startsWith("src/components/")) continue;
    const b = basename(f);
    const stem = b.replace(/\.(t|j)sx?$/, "");
    if (/[-_]/.test(stem) && /^[a-z]/.test(stem)) {
      const newStem = camelize(stem);
      const newPath = f.replace(stem, newStem);
      findings.push({
        kind: "inconsistent_pattern",
        severity: "info",
        files: [f],
        detail: `Component file is not PascalCase ("${stem}").`,
      });
      suggestions.push({
        id: `rename_${f}`,
        category: "rename",
        rationale: "Components should use PascalCase basenames.",
        diff: `${diffLine(f, newPath)}\n- // file: ${b}\n+ // file: ${basename(newPath)}`,
        safe: false,
      });
    }
  }

  const summary: Record<StructureFindingKind, number> = {
    circular_dependency: 0,
    orphan_module: 0,
    duplicated_logic: 0,
    broken_import: 0,
    inconsistent_pattern: 0,
  };
  for (const f of findings) summary[f.kind]++;

  const status: StructureReport["status"] =
    summary.broken_import > 0 || summary.circular_dependency > 0
      ? "DEGRADED"
      : findings.length > 0
        ? "WARN"
        : "OK";

  return Object.freeze({
    generated_at: new Date().toISOString(),
    status,
    files_scanned: allFiles.length,
    findings: Object.freeze(findings.slice(0, 30)),
    suggestions: Object.freeze(suggestions.slice(0, 12)),
    summary,
    notes:
      findings.length === 0
        ? "Structure is clean."
        : `${findings.length} finding(s). Suggestions are diff-style and never auto-applied.`,
  });
}
