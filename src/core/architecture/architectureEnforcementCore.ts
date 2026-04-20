/**
 * ARCHITECTURE ENFORCEMENT CORE — deterministic, file-driven, no AI.
 *
 * RULES (mapped to this project's actual folder layout):
 *   A1. /ui cannot import /core directly
 *       → src/components/** must NOT import from src/core/**
 *   A2. /routes cannot contain business logic
 *       → src/pages/** must NOT contain raw fetch/supabase mutation calls
 *         (allowed: thin wrappers via hooks/services). Detected patterns:
 *         supabase.from(...).insert/update/delete/upsert, fetch( with method
 *         POST/PUT/DELETE/PATCH inline, direct stripe/* SDK calls.
 *   A3. /components cannot own data logic
 *       → src/components/** must NOT call supabase.from(...).insert/update/
 *         delete/upsert directly. Reads via hooks are allowed; writes are not.
 *   A4. /services is the ONLY external layer
 *       → External SDK imports (stripe, resend, openai, google APIs, axios)
 *         are only allowed under src/services/** or supabase/functions/**.
 *
 * Every violation returns: { rule, file, line_hint, evidence, fix_suggestion }.
 * If ANY violation exists, the report's `build_status` is "STOP BUILD" and
 * downstream pipelines must refuse to advance.
 */

import { fileSystemMap, getRawSources } from "@/lib/fileSystemMap";

export type ArchitectureRuleId = "A1" | "A2" | "A3" | "A4";

export type BuildStatus = "PASS" | "STOP BUILD";

export interface ArchitectureViolation {
  rule: ArchitectureRuleId;
  file: string;
  line_hint: number; // 1-indexed best-effort
  evidence: string; // the offending line, trimmed
  fix_suggestion: string;
}

export interface ArchitectureReport {
  generated_at: string;
  build_status: BuildStatus;
  rules_evaluated: ArchitectureRuleId[];
  files_scanned: number;
  violations: ArchitectureViolation[];
  allowed_paths: string[];
  blocked_paths: string[];
}

// ---------- path helpers ----------

const isUiFile = (p: string) =>
  p.startsWith("src/components/") && /\.(tsx?|jsx?)$/.test(p);

const isRouteFile = (p: string) =>
  p.startsWith("src/pages/") && /\.(tsx?|jsx?)$/.test(p);

const isCoreFile = (p: string) => p.startsWith("src/core/");

const isServiceFile = (p: string) =>
  p.startsWith("src/services/") || p.startsWith("supabase/functions/");

// Files exempt from A4 (test scaffolding, type defs, the engine itself)
const isExempt = (p: string) =>
  p.endsWith(".d.ts") ||
  p.startsWith("src/test/") ||
  p === "src/core/architecture/architectureEnforcementCore.ts";

// ---------- regex catalog (deterministic) ----------

// A1: imports of @/core/** or src/core/** or relative ../core/** paths
const RE_IMPORT_CORE =
  /\bfrom\s+['"](?:@\/core\/|(?:\.\.\/)+core\/|src\/core\/)[^'"]+['"]/;

// A3 & A2: write-side supabase calls
const RE_SUPABASE_WRITE =
  /supabase\s*\.\s*from\s*\([^)]*\)\s*\.\s*(insert|update|delete|upsert)\s*\(/;

// A2: inline fetch() with mutating verb
const RE_FETCH_MUTATION =
  /\bfetch\s*\(\s*[^)]*\bmethod\s*:\s*['"](POST|PUT|PATCH|DELETE)['"]/i;

// A4: external SDK imports that must live in /services or /supabase/functions
const EXTERNAL_SDK_IMPORTS: { name: string; re: RegExp }[] = [
  { name: "stripe", re: /\bfrom\s+['"]stripe(?:[\/'"]|$)/ },
  { name: "resend", re: /\bfrom\s+['"]resend(?:[\/'"]|$)/ },
  { name: "openai", re: /\bfrom\s+['"]openai(?:[\/'"]|$)/ },
  { name: "axios", re: /\bfrom\s+['"]axios(?:[\/'"]|$)/ },
  { name: "googleapis", re: /\bfrom\s+['"]googleapis(?:[\/'"]|$)/ },
  { name: "@google-cloud/*", re: /\bfrom\s+['"]@google-cloud\// },
];

// ---------- scanner ----------

function lineNumberOf(source: string, idx: number): number {
  if (idx < 0) return 1;
  let n = 1;
  for (let i = 0; i < idx && i < source.length; i++) if (source[i] === "\n") n++;
  return n;
}

function trimmedLineAt(source: string, idx: number): string {
  if (idx < 0) return "";
  const start = source.lastIndexOf("\n", idx) + 1;
  let end = source.indexOf("\n", idx);
  if (end < 0) end = source.length;
  return source.slice(start, end).trim().slice(0, 240);
}

function scanFile(path: string, source: string, out: ArchitectureViolation[]) {
  if (!source) return;

  // A1 — UI cannot import /core
  if (isUiFile(path)) {
    const m = RE_IMPORT_CORE.exec(source);
    if (m) {
      const idx = m.index;
      out.push({
        rule: "A1",
        file: path,
        line_hint: lineNumberOf(source, idx),
        evidence: trimmedLineAt(source, idx),
        fix_suggestion:
          "Move the imported logic into a hook (src/hooks) or service (src/services). UI components must not depend on /core.",
      });
    }
  }

  // A2 — routes (pages) cannot contain business logic
  if (isRouteFile(path)) {
    const w = RE_SUPABASE_WRITE.exec(source);
    if (w) {
      const idx = w.index;
      out.push({
        rule: "A2",
        file: path,
        line_hint: lineNumberOf(source, idx),
        evidence: trimmedLineAt(source, idx),
        fix_suggestion:
          "Move the supabase write into src/services/* and call it from a hook. Pages must stay declarative.",
      });
    }
    const f = RE_FETCH_MUTATION.exec(source);
    if (f) {
      const idx = f.index;
      out.push({
        rule: "A2",
        file: path,
        line_hint: lineNumberOf(source, idx),
        evidence: trimmedLineAt(source, idx),
        fix_suggestion:
          "Move the mutating fetch into src/services/* and expose it through a hook (src/hooks/use*).",
      });
    }
  }

  // A3 — components cannot own data logic (writes only)
  if (isUiFile(path)) {
    const w = RE_SUPABASE_WRITE.exec(source);
    if (w) {
      const idx = w.index;
      out.push({
        rule: "A3",
        file: path,
        line_hint: lineNumberOf(source, idx),
        evidence: trimmedLineAt(source, idx),
        fix_suggestion:
          "Components must not perform writes. Extract the mutation into src/services/* and call it via a hook (e.g. useMutation in src/hooks).",
      });
    }
  }

  // A4 — external SDKs only in /services or /supabase/functions
  if (!isServiceFile(path) && !isExempt(path)) {
    for (const sdk of EXTERNAL_SDK_IMPORTS) {
      const m = sdk.re.exec(source);
      if (m) {
        const idx = m.index;
        out.push({
          rule: "A4",
          file: path,
          line_hint: lineNumberOf(source, idx),
          evidence: trimmedLineAt(source, idx),
          fix_suggestion: `Move "${sdk.name}" usage to src/services/* (frontend) or supabase/functions/* (backend). External SDKs are not allowed outside the services layer.`,
        });
        break;
      }
    }
  }
}

export function runArchitectureEnforcement(): ArchitectureReport {
  const generated_at = new Date().toISOString();
  const sources = getRawSources();
  const violations: ArchitectureViolation[] = [];
  const blocked = new Set<string>();
  const allowed: string[] = [];

  let scanned = 0;
  for (const f of fileSystemMap) {
    const path = f.path;
    if (!/\.(tsx?|jsx?)$/.test(path)) continue;
    const src = sources["/" + path];
    if (!src) continue;
    scanned++;

    const before = violations.length;
    scanFile(path, src, violations);
    if (violations.length > before) blocked.add(path);
    else allowed.push(path);
  }

  return {
    generated_at,
    build_status: violations.length === 0 ? "PASS" : "STOP BUILD",
    rules_evaluated: ["A1", "A2", "A3", "A4"],
    files_scanned: scanned,
    violations,
    allowed_paths: allowed.slice(0, 200),
    blocked_paths: Array.from(blocked).sort(),
  };
}
