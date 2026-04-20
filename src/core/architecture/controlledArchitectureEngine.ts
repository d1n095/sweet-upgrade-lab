/**
 * CONTROLLED ARCHITECTURE ENGINE — three-phase, file-driven, no AI, no cache.
 *
 * RULE: There is ONLY ONE truth source — the live file system surfaced by
 * fileSystemMap (built from import.meta.glob at module-evaluation time).
 * Every value in the report is recomputed on call. No memoization, no
 * cross-run state, no parallel execution.
 *
 * PHASE 1 — FILE TRUTH
 *   read file system → count files → list folder structure
 *
 * PHASE 2 — STRUCTURE MAP
 *   classify each file as component / route / utility using deterministic
 *   path + content rules. Only DETECT signals; never assume.
 *
 * PHASE 3 — VALIDATION
 *   resolve every import in every file against the file map. Anything that
 *   cannot be traced to a real on-disk file is reported as a mismatch.
 *
 * FINAL RULE: if a fact is not directly traceable to a file in fileSystemMap,
 * it is omitted from the report ("does not exist").
 */

import { fileSystemMap, getRawSources, type FileEntry } from "@/lib/fileSystemMap";

// ---------- types ----------

export type EngineStatus = "TRUTH VERIFIED" | "MISMATCHES DETECTED" | "FILE TRUTH UNAVAILABLE";

export type FileKind = "component" | "route" | "utility" | "other";

export interface FolderCount {
  folder: string;
  files: number;
}

export interface PhaseOneFileTruth {
  total_files: number;
  by_extension: Record<string, number>;
  folders: FolderCount[];
  /** First 50 paths as evidence sample */
  evidence_sample: string[];
}

export interface ClassifiedFile {
  path: string;
  kind: FileKind;
  rule: string; // exact rule that fired
}

export interface PhaseTwoStructureMap {
  components: number;
  routes: number;
  utilities: number;
  other: number;
  classifications_sample: ClassifiedFile[]; // first 50
}

export interface ImportMismatch {
  file: string;
  import_specifier: string;
  resolved_to: string | null;
  reason: string;
}

export interface PhaseThreeValidation {
  files_inspected: number;
  imports_inspected: number;
  resolved_imports: number;
  mismatches: ImportMismatch[];
}

export interface ControlledArchitectureReport {
  generated_at: string;
  status: EngineStatus;
  truth_source: "fileSystemMap (import.meta.glob)";
  phase1: PhaseOneFileTruth;
  phase2: PhaseTwoStructureMap;
  phase3: PhaseThreeValidation;
  /** Hard block flag — UI must refuse to advance pipelines when true */
  blocked: boolean;
}

// ---------- phase 1 helpers ----------

function buildPhase1(files: FileEntry[]): PhaseOneFileTruth {
  const by_extension: Record<string, number> = {};
  const folderMap = new Map<string, number>();
  for (const f of files) {
    const ext = f.path.match(/\.[^.\/]+$/)?.[0] ?? "(none)";
    by_extension[ext] = (by_extension[ext] || 0) + 1;
    const folder = f.path.split("/").slice(0, -1).join("/") || "/";
    folderMap.set(folder, (folderMap.get(folder) || 0) + 1);
  }
  const folders = Array.from(folderMap.entries())
    .map(([folder, count]) => ({ folder, files: count }))
    .sort((a, b) => b.files - a.files);
  return {
    total_files: files.length,
    by_extension,
    folders,
    evidence_sample: files.slice(0, 50).map((f) => f.path),
  };
}

// ---------- phase 2 classification ----------

const JSX_RE = /<[A-Z][A-Za-z0-9]*[\s/>]/;
const REACT_IMPORT_RE = /from\s+['"]react['"]/;
const REACT_EXPORT_RE = /export\s+(?:default\s+)?(?:function|const)\s+[A-Z]/;
const ROUTE_DECL_RE = /<Route\s+[^>]*path\s*=\s*["'][^"']*["']/;

function classify(path: string, source: string): ClassifiedFile {
  if (path.startsWith("src/pages/")) {
    return { path, kind: "route", rule: "P2-R1: file under src/pages/" };
  }
  if (ROUTE_DECL_RE.test(source)) {
    return { path, kind: "route", rule: "P2-R2: contains <Route path=...> declaration" };
  }
  if (JSX_RE.test(source)) {
    return { path, kind: "component", rule: "P2-R3: contains JSX (<PascalCase ...>)" };
  }
  if (REACT_IMPORT_RE.test(source) && REACT_EXPORT_RE.test(source)) {
    return { path, kind: "component", rule: "P2-R3b: imports react + exports PascalCase symbol" };
  }
  if (
    path.startsWith("src/lib/") ||
    path.startsWith("src/utils/") ||
    path.startsWith("src/stores/") ||
    path.startsWith("src/hooks/")
  ) {
    return { path, kind: "utility", rule: "P2-R4: file under lib/utils/stores/hooks" };
  }
  return { path, kind: "other", rule: "P2-R5: no rule matched (kept as 'other')" };
}

// ---------- phase 3 import resolution ----------

const IMPORT_RE = /(?:^|\n)\s*(?:import\s[^'"\n]*from\s+|export\s[^'"\n]*from\s+|import\s*\(\s*)['"]([^'"]+)['"]/g;

function listImports(source: string): string[] {
  const out: string[] = [];
  let m: RegExpExecArray | null;
  IMPORT_RE.lastIndex = 0;
  while ((m = IMPORT_RE.exec(source)) !== null) out.push(m[1]);
  return out;
}

function isExternalSpecifier(spec: string): boolean {
  // Anything that doesn't start with "@/", ".", "/" or "src/" is treated as
  // external (npm package or built-in alias). Those are NOT validated against
  // fileSystemMap — they are not part of the local file truth surface.
  if (spec.startsWith("@/")) return false;
  if (spec.startsWith(".")) return false;
  if (spec.startsWith("/")) return false;
  if (spec.startsWith("src/")) return false;
  return true;
}

function normalizeRelative(fromFile: string, spec: string): string {
  const fromDir = fromFile.split("/").slice(0, -1);
  const parts = spec.split("/");
  const stack = [...fromDir];
  for (const p of parts) {
    if (p === "." || p === "") continue;
    if (p === "..") stack.pop();
    else stack.push(p);
  }
  return stack.join("/");
}

function resolveAgainstMap(target: string, paths: Set<string>): string | null {
  // Try exact match
  if (paths.has(target)) return target;
  const candidates = [
    `${target}.ts`,
    `${target}.tsx`,
    `${target}.js`,
    `${target}.jsx`,
    `${target}/index.ts`,
    `${target}/index.tsx`,
    `${target}/index.js`,
    `${target}/index.jsx`,
  ];
  for (const c of candidates) if (paths.has(c)) return c;
  return null;
}

function buildPhase2(files: FileEntry[], sources: Record<string, string>): { phase2: PhaseTwoStructureMap; classifications: ClassifiedFile[] } {
  const classifications: ClassifiedFile[] = [];
  let components = 0, routes = 0, utilities = 0, other = 0;
  for (const f of files) {
    const src = sources["/" + f.path] ?? "";
    const c = classify(f.path, src);
    classifications.push(c);
    if (c.kind === "component") components++;
    else if (c.kind === "route") routes++;
    else if (c.kind === "utility") utilities++;
    else other++;
  }
  return {
    phase2: {
      components,
      routes,
      utilities,
      other,
      classifications_sample: classifications.slice(0, 50),
    },
    classifications,
  };
}

function buildPhase3(files: FileEntry[], sources: Record<string, string>): PhaseThreeValidation {
  const pathSet = new Set<string>(files.map((f) => f.path));
  const mismatches: ImportMismatch[] = [];
  let files_inspected = 0;
  let imports_inspected = 0;
  let resolved_imports = 0;

  for (const f of files) {
    const src = sources["/" + f.path];
    if (!src) continue;
    files_inspected++;
    for (const spec of listImports(src)) {
      imports_inspected++;

      if (isExternalSpecifier(spec)) {
        // External — out of scope for file-truth validation
        resolved_imports++;
        continue;
      }

      let target: string;
      if (spec.startsWith("@/")) {
        target = "src/" + spec.slice(2);
      } else if (spec.startsWith("src/")) {
        target = spec;
      } else if (spec.startsWith(".")) {
        target = normalizeRelative(f.path, spec);
      } else if (spec.startsWith("/")) {
        target = spec.startsWith("/src/") ? spec.slice(1) : spec.slice(1);
      } else {
        // Should not reach here — defensive
        continue;
      }

      const resolved = resolveAgainstMap(target, pathSet);
      if (resolved) {
        resolved_imports++;
      } else {
        mismatches.push({
          file: f.path,
          import_specifier: spec,
          resolved_to: null,
          reason: `no on-disk file matches "${target}" (.ts/.tsx/.js/.jsx or /index.*) in fileSystemMap`,
        });
      }
    }
  }

  return { files_inspected, imports_inspected, resolved_imports, mismatches };
}

// ---------- entrypoint ----------

export function runControlledArchitectureEngine(): ControlledArchitectureReport {
  const generated_at = new Date().toISOString();

  // PHASE 1 — file truth
  const files = fileSystemMap;
  if (files.length === 0) {
    return {
      generated_at,
      status: "FILE TRUTH UNAVAILABLE",
      truth_source: "fileSystemMap (import.meta.glob)",
      phase1: { total_files: 0, by_extension: {}, folders: [], evidence_sample: [] },
      phase2: { components: 0, routes: 0, utilities: 0, other: 0, classifications_sample: [] },
      phase3: { files_inspected: 0, imports_inspected: 0, resolved_imports: 0, mismatches: [] },
      blocked: true,
    };
  }
  const phase1 = buildPhase1(files);

  // PHASE 2 — structure map
  const sources = getRawSources();
  const { phase2 } = buildPhase2(files, sources);

  // PHASE 3 — validation against actual on-disk files
  const phase3 = buildPhase3(files, sources);

  const status: EngineStatus = phase3.mismatches.length === 0 ? "TRUTH VERIFIED" : "MISMATCHES DETECTED";

  return {
    generated_at,
    status,
    truth_source: "fileSystemMap (import.meta.glob)",
    phase1,
    phase2,
    phase3,
    blocked: status !== "TRUTH VERIFIED",
  };
}
