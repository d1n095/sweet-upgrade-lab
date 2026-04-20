/**
 * ARCHITECTURE RULE ENGINE — deterministic, file-driven, no AI.
 *
 * Enforces 4 structural rules and returns exact file paths + fix suggestions
 * for every violation. If ANY rule fires, execution_status = "STOP" and
 * downstream pipelines must refuse to advance.
 *
 * RULES (mapped to this project's actual layout):
 *   R1. UI RULE         — JSX-bearing files must live under src/components/**
 *                         or src/pages/** (the project's "ui" layer). Defining
 *                         JSX components elsewhere (lib/utils/stores/hooks/core)
 *                         is a violation.
 *   R2. ROUTE RULE      — every entry in ROUTE_REGISTRY must map 1:1 to a real
 *                         file in fileSystemMap. Redirect-only entries are
 *                         exempt (file === "(redirect)").
 *   R3. LOGIC RULE      — business logic (supabase writes / mutating fetch /
 *                         external SDK imports) is only allowed in src/core/**,
 *                         src/services/** or supabase/functions/**. Pages and
 *                         components must stay declarative.
 *   R4. IMPORT RULE     — cross-layer imports outside the allowed flow are
 *                         blocked. Allowed flow:
 *                           pages → components, hooks, services, core, lib, utils, stores
 *                           components → components, hooks, lib, utils, stores
 *                                       (NOT services, NOT core, NOT pages)
 *                           hooks → services, core, lib, utils, stores
 *                                   (NOT components, NOT pages)
 *                           core → core, lib, utils
 *                                  (NOT components, NOT pages, NOT hooks, NOT services)
 *                           services → lib, utils, core
 */

import { fileSystemMap, getRawSources } from "@/lib/fileSystemMap";
import { ROUTE_REGISTRY } from "@/architecture/routeRegistry";

// ---------- types ----------

export type RuleId = "R1" | "R2" | "R3" | "R4";

export type ExecutionStatus = "PASS" | "STOP";

export interface RuleViolation {
  rule: RuleId;
  file: string;
  line_hint: number;
  evidence: string;
  fix_suggestion: string;
}

export interface ArchitectureRuleReport {
  generated_at: string;
  execution_status: ExecutionStatus;
  rules_evaluated: RuleId[];
  files_scanned: number;
  violations: RuleViolation[];
  violations_by_rule: Record<RuleId, number>;
  /** Hard block flag */
  blocked: boolean;
}

// ---------- layer detection ----------

type Layer = "page" | "component" | "hook" | "service" | "core" | "lib" | "util" | "store" | "test" | "other";

function detectLayer(path: string): Layer {
  if (path.startsWith("src/pages/")) return "page";
  if (path.startsWith("src/components/")) return "component";
  if (path.startsWith("src/hooks/")) return "hook";
  if (path.startsWith("src/services/")) return "service";
  if (path.startsWith("src/core/")) return "core";
  if (path.startsWith("src/lib/")) return "lib";
  if (path.startsWith("src/utils/")) return "util";
  if (path.startsWith("src/stores/")) return "store";
  if (path.startsWith("src/test/")) return "test";
  return "other";
}

// ---------- regex catalog ----------

const JSX_RE = /<[A-Z][A-Za-z0-9]*[\s/>]/;
const REACT_EXPORT_RE = /export\s+(?:default\s+)?(?:function|const)\s+[A-Z][A-Za-z0-9]*/;
const SUPABASE_WRITE_RE =
  /supabase\s*\.\s*from\s*\([^)]*\)\s*\.\s*(insert|update|delete|upsert)\s*\(/;
const FETCH_MUTATION_RE =
  /\bfetch\s*\(\s*[^)]*\bmethod\s*:\s*['"](POST|PUT|PATCH|DELETE)['"]/i;
const EXTERNAL_SDK_RES: { name: string; re: RegExp }[] = [
  { name: "stripe", re: /\bfrom\s+['"]stripe(?:[\/'"]|$)/ },
  { name: "resend", re: /\bfrom\s+['"]resend(?:[\/'"]|$)/ },
  { name: "openai", re: /\bfrom\s+['"]openai(?:[\/'"]|$)/ },
  { name: "axios", re: /\bfrom\s+['"]axios(?:[\/'"]|$)/ },
  { name: "googleapis", re: /\bfrom\s+['"]googleapis(?:[\/'"]|$)/ },
];

// import/export-from specifier extraction
const IMPORT_RE = /(?:^|\n)\s*(?:import\s[^'"\n]*from\s+|export\s[^'"\n]*from\s+|import\s*\(\s*)['"]([^'"]+)['"]/g;

// ---------- helpers ----------

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

function listImports(source: string): { spec: string; index: number }[] {
  const out: { spec: string; index: number }[] = [];
  let m: RegExpExecArray | null;
  IMPORT_RE.lastIndex = 0;
  while ((m = IMPORT_RE.exec(source)) !== null) {
    out.push({ spec: m[1], index: m.index });
  }
  return out;
}

function specToLayer(spec: string): Layer | "external" | "unknown" {
  let target: string | null = null;
  if (spec.startsWith("@/")) target = "src/" + spec.slice(2);
  else if (spec.startsWith("src/")) target = spec;
  else if (spec.startsWith("/src/")) target = spec.slice(1);
  else if (spec.startsWith(".") || spec.startsWith("/")) return "unknown"; // relative — caller resolves separately if needed
  else return "external";
  return detectLayer(target);
}

// ---------- allowed import matrix (R4) ----------

const ALLOWED_IMPORTS: Record<Layer, Layer[]> = {
  page:      ["component", "hook", "service", "core", "lib", "util", "store", "page"],
  component: ["component", "hook", "lib", "util", "store"],
  hook:      ["service", "core", "lib", "util", "store", "hook"],
  service:   ["lib", "util", "core", "service"],
  core:      ["core", "lib", "util"],
  lib:       ["lib", "util"],
  util:      ["util", "lib"],
  store:     ["lib", "util", "store"],
  test:      ["page", "component", "hook", "service", "core", "lib", "util", "store"],
  other:     ["page", "component", "hook", "service", "core", "lib", "util", "store", "other"],
};

function isAllowedFlow(from: Layer, to: Layer): boolean {
  return ALLOWED_IMPORTS[from]?.includes(to) ?? false;
}

// ---------- per-rule scanners ----------

function scanR1_UiRule(path: string, source: string, layer: Layer, out: RuleViolation[]) {
  // R1 — JSX-bearing files must live under components/ or pages/
  // Skip layers where JSX is intrinsic or where wrapper components are common
  if (layer === "component" || layer === "page" || layer === "test" || layer === "other") return;
  // Hooks may return JSX in rare cases (render props / wrapper hooks) but it's
  // a smell. We still flag any file outside ui that exports a JSX component.
  const m = JSX_RE.exec(source);
  if (!m) return;
  const reExp = REACT_EXPORT_RE.exec(source);
  if (!reExp) return;
  out.push({
    rule: "R1",
    file: path,
    line_hint: lineNumberOf(source, m.index),
    evidence: trimmedLineAt(source, m.index),
    fix_suggestion: `Move the JSX component to src/components/** (or src/pages/** if it's a route). UI must not live under src/${layer}/.`,
  });
}

function scanR3_LogicRule(path: string, source: string, layer: Layer, out: RuleViolation[]) {
  // R3 — business logic only in core/services (and edge functions)
  // Pages and components are the strict-deny layers; hooks are allowed because
  // they wrap services for UI consumption.
  if (layer !== "page" && layer !== "component") return;

  const w = SUPABASE_WRITE_RE.exec(source);
  if (w) {
    out.push({
      rule: "R3",
      file: path,
      line_hint: lineNumberOf(source, w.index),
      evidence: trimmedLineAt(source, w.index),
      fix_suggestion:
        "Move the supabase write into src/services/* or src/core/*, then expose it via a hook (src/hooks/use*). Pages & components must not own writes.",
    });
  }

  const f = FETCH_MUTATION_RE.exec(source);
  if (f) {
    out.push({
      rule: "R3",
      file: path,
      line_hint: lineNumberOf(source, f.index),
      evidence: trimmedLineAt(source, f.index),
      fix_suggestion:
        "Move the mutating fetch into src/services/* and call it from a hook. Pages & components must stay declarative.",
    });
  }

  for (const sdk of EXTERNAL_SDK_RES) {
    const m = sdk.re.exec(source);
    if (m) {
      out.push({
        rule: "R3",
        file: path,
        line_hint: lineNumberOf(source, m.index),
        evidence: trimmedLineAt(source, m.index),
        fix_suggestion: `Move "${sdk.name}" usage to src/services/* or supabase/functions/*. Business-logic SDKs are not allowed in pages/components.`,
      });
      break;
    }
  }
}

function scanR4_ImportRule(path: string, source: string, layer: Layer, out: RuleViolation[]) {
  if (layer === "test" || layer === "other") return;
  for (const { spec, index } of listImports(source)) {
    const target = specToLayer(spec);
    if (target === "external" || target === "unknown") continue;
    if (target === "other") continue; // unknown internal area — don't penalize
    if (!isAllowedFlow(layer, target)) {
      out.push({
        rule: "R4",
        file: path,
        line_hint: lineNumberOf(source, index),
        evidence: trimmedLineAt(source, index),
        fix_suggestion: `Cross-layer import not allowed: ${layer} → ${target}. Allowed targets from "${layer}" are: ${ALLOWED_IMPORTS[layer].join(", ")}. Re-route via the proper layer (e.g. expose ${target} logic through a hook/service).`,
      });
    }
  }
}

function scanR2_RouteRule(out: RuleViolation[], pathSet: Set<string>) {
  // R2 — every non-redirect ROUTE_REGISTRY entry must map 1:1 to a real file
  for (const r of ROUTE_REGISTRY) {
    if (r.area === "redirect" || r.file === "(redirect)") continue;
    if (!pathSet.has(r.file)) {
      out.push({
        rule: "R2",
        file: r.file,
        line_hint: 1,
        evidence: `route="${r.path}" element=${r.element}`,
        fix_suggestion: `Create the missing page file ${r.file} or remove/relocate the route entry "${r.path}" in src/architecture/routeRegistry.ts. Routes must map 1:1 to a real on-disk file.`,
      });
    }
  }
}

// ---------- entrypoint ----------

export function runArchitectureRuleEngine(): ArchitectureRuleReport {
  const generated_at = new Date().toISOString();
  const sources = getRawSources();
  const violations: RuleViolation[] = [];

  let files_scanned = 0;
  for (const f of fileSystemMap) {
    if (!/\.(tsx?|jsx?)$/.test(f.path)) continue;
    const src = sources["/" + f.path];
    if (!src) continue;
    files_scanned++;
    const layer = detectLayer(f.path);

    scanR1_UiRule(f.path, src, layer, violations);
    scanR3_LogicRule(f.path, src, layer, violations);
    scanR4_ImportRule(f.path, src, layer, violations);
  }

  // R2 — route registry vs real files
  const pathSet = new Set<string>(fileSystemMap.map((f) => f.path));
  scanR2_RouteRule(violations, pathSet);

  const violations_by_rule: Record<RuleId, number> = { R1: 0, R2: 0, R3: 0, R4: 0 };
  for (const v of violations) violations_by_rule[v.rule]++;

  return {
    generated_at,
    execution_status: violations.length === 0 ? "PASS" : "STOP",
    rules_evaluated: ["R1", "R2", "R3", "R4"],
    files_scanned,
    violations,
    violations_by_rule,
    blocked: violations.length > 0,
  };
}
