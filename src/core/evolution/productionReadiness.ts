/**
 * PRODUCTION READINESS — pre-deploy hygiene scan.
 *
 * Pure source scan over getRawSources() output:
 *   - console.log / debugger / TODO / FIXME
 *   - wildcard imports (`import *`)
 *   - large modules as a bundle-bloat proxy
 *   - declared dependencies never imported
 *
 * Suggest-only. No mutation. No real build blocking.
 */

export type ReadinessKind =
  | "console_log"
  | "debugger"
  | "todo_marker"
  | "wildcard_import"
  | "bundle_bloat"
  | "unused_dependency";

export interface ReadinessFinding {
  kind: ReadinessKind;
  file: string;
  line_hint: number;
  detail: string;
  fix: string;
}

export interface ReadinessInputs {
  /** path -> source code (already normalized) */
  sources: Record<string, string>;
  /** dependencies declared in package.json (name list) */
  declared_deps?: ReadonlyArray<string>;
}

export interface ReadinessReport {
  generated_at: string;
  status: "READY" | "NEEDS_CLEANUP" | "BLOCKED";
  total_files: number;
  total_bytes: number;
  findings: ReadonlyArray<ReadinessFinding>;
  summary: Record<ReadinessKind, number>;
  largest_modules: ReadonlyArray<{ file: string; bytes: number }>;
  unused_dependencies: ReadonlyArray<string>;
  notes: string;
}

const LARGE_MODULE_BYTES = 30_000;
const MAX_FINDINGS_PER_KIND = 8;

const RE_CONSOLE = /^(?!\s*\/\/).*\bconsole\.(log|debug|info|trace)\s*\(/;
const RE_DEBUGGER = /^\s*debugger\s*;?/;
const RE_TODO = /\b(TODO|FIXME|XXX|HACK)\b/;
const RE_WILDCARD = /^\s*import\s+\*\s+as\s+\w+/;
const RE_IMPORT_FROM = /from\s+['"]([^'"]+)['"]/g;

function pkgRoot(spec: string): string | null {
  if (spec.startsWith(".") || spec.startsWith("/") || spec.startsWith("@/")) return null;
  if (spec.startsWith("@")) {
    const [scope, name] = spec.split("/");
    return name ? `${scope}/${name}` : scope;
  }
  return spec.split("/")[0];
}

export function runProductionReadiness(inputs: ReadinessInputs): ReadinessReport {
  const findings: ReadinessFinding[] = [];
  const summary: Record<ReadinessKind, number> = {
    console_log: 0,
    debugger: 0,
    todo_marker: 0,
    wildcard_import: 0,
    bundle_bloat: 0,
    unused_dependency: 0,
  };
  const sizes: Array<{ file: string; bytes: number }> = [];
  const usedPkgs = new Set<string>();
  let totalBytes = 0;

  function push(f: ReadinessFinding) {
    if (summary[f.kind] >= MAX_FINDINGS_PER_KIND) return;
    findings.push(f);
    summary[f.kind]++;
  }

  for (const [rawPath, src] of Object.entries(inputs.sources)) {
    if (typeof src !== "string") continue;
    const file = rawPath.replace(/^\//, "");
    if (!file.startsWith("src/")) continue;
    const bytes = src.length;
    totalBytes += bytes;
    sizes.push({ file, bytes });

    const lines = src.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const ln = lines[i];
      if (RE_CONSOLE.test(ln)) {
        push({ kind: "console_log", file, line_hint: i + 1, detail: ln.trim().slice(0, 80), fix: "Remove or guard with `if (import.meta.env.DEV)`." });
      }
      if (RE_DEBUGGER.test(ln)) {
        push({ kind: "debugger", file, line_hint: i + 1, detail: "debugger statement", fix: "Remove before deploy." });
      }
      if (RE_TODO.test(ln)) {
        push({ kind: "todo_marker", file, line_hint: i + 1, detail: ln.trim().slice(0, 80), fix: "Resolve, ticket, or delete." });
      }
      if (RE_WILDCARD.test(ln)) {
        push({ kind: "wildcard_import", file, line_hint: i + 1, detail: ln.trim().slice(0, 80), fix: "Use named imports — wildcard imports break tree-shaking." });
      }
    }

    if (bytes >= LARGE_MODULE_BYTES) {
      push({
        kind: "bundle_bloat",
        file,
        line_hint: 1,
        detail: `Module is ${(bytes / 1024).toFixed(1)} KB`,
        fix: "Split this module into smaller focused files.",
      });
    }

    let m: RegExpExecArray | null;
    RE_IMPORT_FROM.lastIndex = 0;
    while ((m = RE_IMPORT_FROM.exec(src)) !== null) {
      const root = pkgRoot(m[1]);
      if (root) usedPkgs.add(root);
    }
  }

  // unused declared deps
  const unused: string[] = [];
  for (const dep of inputs.declared_deps ?? []) {
    if (!usedPkgs.has(dep)) unused.push(dep);
  }
  for (const u of unused.slice(0, MAX_FINDINGS_PER_KIND)) {
    push({
      kind: "unused_dependency",
      file: "package.json",
      line_hint: 1,
      detail: `"${u}" declared but never imported.`,
      fix: `Run remove-dependency for "${u}" if confirmed unused.`,
    });
  }

  sizes.sort((a, b) => b.bytes - a.bytes);

  const status: ReadinessReport["status"] =
    summary.debugger > 0 || summary.console_log > 10
      ? "BLOCKED"
      : findings.length > 0
        ? "NEEDS_CLEANUP"
        : "READY";

  return Object.freeze({
    generated_at: new Date().toISOString(),
    status,
    total_files: sizes.length,
    total_bytes: totalBytes,
    findings: Object.freeze(findings),
    summary,
    largest_modules: Object.freeze(sizes.slice(0, 8)),
    unused_dependencies: Object.freeze(unused),
    notes:
      status === "READY"
        ? "Codebase is clean — ready for production."
        : `${findings.length} hygiene issue(s). Suggest-only.`,
  });
}
