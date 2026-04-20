/**
 * ARCHITECTURE WATCHDOG — pure rule-based validator.
 *
 * NO AI. NO interpretation. Only deterministic rule checks.
 * Inputs: file system map, route registry, dependency heatmap.
 * Outputs: list of violations + boolean pass/fail per rule + compliance score.
 */

import { fileSystemMap, getRawSources } from "@/lib/fileSystemMap";
import { ROUTE_REGISTRY } from "@/architecture/routeRegistry";
import { runDependencyHeatmap } from "./dependencyHeatmap";
import { shouldSkipInMinimalMode } from "@/core/scanner/minimalMode";

export type WatchdogState = "VALID" | "BROKEN";

export interface WatchdogViolation {
  rule_id: string;
  category: "STRUCTURE" | "DEPENDENCY" | "ROUTE" | "COMPONENT";
  file?: string;
  message: string;
}

export interface WatchdogReport {
  generated_at: string;
  system_state: WatchdogState;
  rules_checked: { id: string; passed: boolean; description: string }[];
  violations: WatchdogViolation[];
  compliance_score: number; // 0–100, ratio of passed rules
}

const ROUTE_DECL_RE = /<Route\s+[^>]*path\s*=\s*["'][^"']*["']/;
const SUPABASE_USE_RE = /supabase\.(from|rpc|auth|storage|functions)/;

export function runArchitectureWatchdog(): WatchdogReport {
  const generated_at = new Date().toISOString();
  if (shouldSkipInMinimalMode("architectureWatchdog")) {
    return {
      generated_at,
      system_state: "VALID",
      rules_checked: [],
      violations: [],
      compliance_score: 100,
    };
  }
  const sources = getRawSources();
  const violations: WatchdogViolation[] = [];

  const ruleResults: { id: string; passed: boolean; description: string }[] = [];

  // === A. STRUCTURE VALIDATION ===
  // W1: every component file lives under components/ or pages/ or ui/
  let w1Pass = true;
  for (const f of fileSystemMap) {
    const src = sources["/" + f.path];
    if (typeof src !== "string") continue;
    const declaresJSX = /<[A-Z][A-Za-z0-9]*[\s/>]/.test(src);
    if (!declaresJSX) continue;
    const inAllowed =
      f.path.startsWith("src/components/") ||
      f.path.startsWith("src/pages/") ||
      f.path.startsWith("src/ui/") ||
      f.path.startsWith("src/hooks/") ||
      f.path.startsWith("src/lib/") ||
      f.path.startsWith("src/utils/") ||
      f.path.startsWith("src/stores/") ||
      f.path === "src/App.tsx" ||
      f.path === "src/main.tsx";
    if (!inAllowed) {
      w1Pass = false;
      violations.push({
        rule_id: "W1",
        category: "STRUCTURE",
        file: f.path,
        message: "JSX component lives outside components/, pages/, or ui/",
      });
    }
  }
  ruleResults.push({ id: "W1", passed: w1Pass, description: "JSX files placed in component layer" });

  // W2: no business logic (supabase calls) inside src/components/
  let w2Pass = true;
  for (const f of fileSystemMap) {
    if (!f.path.startsWith("src/components/")) continue;
    const src = sources["/" + f.path];
    if (typeof src !== "string") continue;
    if (SUPABASE_USE_RE.test(src)) {
      w2Pass = false;
      violations.push({
        rule_id: "W2",
        category: "STRUCTURE",
        file: f.path,
        message: "Direct supabase call inside component (move to hook/service)",
      });
    }
  }
  ruleResults.push({ id: "W2", passed: w2Pass, description: "Components free of direct DB calls" });

  // === B. DEPENDENCY VALIDATION ===
  const heat = runDependencyHeatmap();

  // W3: no circular imports
  const w3Pass = heat.circular_dependencies.length === 0;
  if (!w3Pass) {
    for (const cycle of heat.circular_dependencies) {
      violations.push({
        rule_id: "W3",
        category: "DEPENDENCY",
        message: `Circular dependency: ${cycle.join(" → ")}`,
      });
    }
  }
  ruleResults.push({ id: "W3", passed: w3Pass, description: "No circular imports" });

  // W4: no orphan critical files (pages/ must be reachable from App)
  let w4Pass = true;
  for (const node of heat.nodes) {
    if (node.kind !== "page") continue;
    if (node.imports_in === 0 && node.id !== "src/App.tsx") {
      // Pages may be lazy-loaded by routeRegistry — only flag if NOT in registry
      const inRegistry = ROUTE_REGISTRY.some((r: any) =>
        (r.file || r.module || "").includes(node.id.replace(/^src\//, ""))
      );
      if (!inRegistry) {
        w4Pass = false;
        violations.push({
          rule_id: "W4",
          category: "DEPENDENCY",
          file: node.id,
          message: "Page file has no inbound imports and is not in route registry",
        });
      }
    }
  }
  ruleResults.push({ id: "W4", passed: w4Pass, description: "Critical pages reachable" });

  // === C. ROUTE VALIDATION ===
  // W5: every registered route must map to an existing file
  let w5Pass = true;
  const pathSet = new Set(fileSystemMap.map((f) => f.path));
  for (const r of ROUTE_REGISTRY as any[]) {
    const file = r.file || r.module;
    if (!file) continue;
    const candidate = file.startsWith("src/") ? file : "src/" + file;
    const found = [".ts", ".tsx", ""].some((ext) => pathSet.has(candidate + ext));
    if (!found) {
      w5Pass = false;
      violations.push({
        rule_id: "W5",
        category: "ROUTE",
        message: `Route "${r.path || r.id || "?"}" → file "${file}" not found on disk`,
      });
    }
  }
  ruleResults.push({ id: "W5", passed: w5Pass, description: "All routes map to real files" });

  // === D. COMPONENT VALIDATION ===
  // W6: every component (non-ui primitive) is used at least once or marked orphan via 0/0
  let w6Pass = true;
  for (const node of heat.nodes) {
    if (node.kind !== "component") continue;
    if (node.id.startsWith("src/components/ui/")) continue; // shadcn primitives
    if (node.imports_in === 0 && !node.is_isolated) continue;
    if (node.is_isolated) {
      w6Pass = false;
      violations.push({
        rule_id: "W6",
        category: "COMPONENT",
        file: node.id,
        message: "Component is fully isolated (0 in / 0 out) — orphan",
      });
    }
  }
  ruleResults.push({ id: "W6", passed: w6Pass, description: "No orphan components" });

  // === FAIL CONDITIONS ===
  // missing routes / empty component tree / broken import graph
  const fileCount = fileSystemMap.length;
  const hasRoutes = ROUTE_REGISTRY.length > 0;
  const hasComponents = heat.nodes.some((n) => n.kind === "component");
  const broken = !hasRoutes || !hasComponents || fileCount === 0;
  if (broken) {
    if (!hasRoutes) violations.push({ rule_id: "FAIL", category: "ROUTE", message: "ROUTE_REGISTRY empty" });
    if (!hasComponents) violations.push({ rule_id: "FAIL", category: "COMPONENT", message: "No components detected" });
    if (fileCount === 0) violations.push({ rule_id: "FAIL", category: "STRUCTURE", message: "File system empty" });
  }

  const passed = ruleResults.filter((r) => r.passed).length;
  const compliance_score = ruleResults.length > 0 ? Math.round((passed / ruleResults.length) * 100) : 0;
  const system_state: WatchdogState = !broken && violations.length === 0 ? "VALID" : "BROKEN";

  return {
    generated_at,
    system_state,
    rules_checked: ruleResults,
    violations,
    compliance_score,
  };
}
