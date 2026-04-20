/**
 * SELF-HEALING ENGINE — deterministic, rule-driven structure planner.
 *
 * NO AI. NO guessing. Only mechanical rule execution against the file system.
 * Outputs a PLAN of moves/marks. It does NOT mutate the codebase — it produces
 * an auditable list of actions for human review.
 */

import { fileSystemMap, getRawSources } from "@/lib/fileSystemMap";
import { runDependencyHeatmap } from "./dependencyHeatmap";
import { shouldSkipInMinimalMode } from "@/core/scanner/minimalMode";

export type HealAction =
  | "MOVE"
  | "MARK_DEPRECATED"
  | "EXTRACT_TO_CORE"
  | "RENAME_KEEP_NEWEST"
  | "NONE";

export interface HealStep {
  rule: string;          // exact rule id that fired (e.g. "H1")
  file: string;
  action: HealAction;
  target?: string;       // proposed new path (for MOVE)
  reason: string;
}

export interface HealReport {
  generated_at: string;
  before: { path: string; folder: string }[];
  after: { path: string; folder: string }[];
  applied_rules: string[];           // unique rule ids fired
  steps: HealStep[];
  summary: {
    moves: number;
    deprecations: number;
    extractions: number;
    renames: number;
    untouched: number;
  };
}

const JSX_RE = /<[A-Z][A-Za-z0-9]*[\s/>]/;
const ROUTE_DECL_RE = /<Route\s+[^>]*path\s*=\s*["'][^"']*["']/;

function expectedFolder(path: string, src: string): string | null {
  const isJsx = JSX_RE.test(src);
  const isRouteDecl = ROUTE_DECL_RE.test(src);

  // H1 — route declarations belong in pages/ or routes/
  if (isRouteDecl) {
    if (path.startsWith("src/pages/") || path.startsWith("src/routes/")) return null;
    return "src/routes/";
  }
  // H2 — JSX components belong in components/ (or pages/ if a route)
  if (isJsx) {
    if (
      path.startsWith("src/components/") ||
      path.startsWith("src/pages/") ||
      path.startsWith("src/ui/")
    ) return null;
    // hooks/lib/utils that happen to render JSX are allowed
    if (
      path.startsWith("src/hooks/") ||
      path.startsWith("src/lib/") ||
      path.startsWith("src/utils/") ||
      path.startsWith("src/stores/")
    ) return null;
    return "src/components/";
  }
  // H3 — pure logic files belong in core/utils/lib/stores/hooks
  if (
    path.startsWith("src/core/") ||
    path.startsWith("src/utils/") ||
    path.startsWith("src/lib/") ||
    path.startsWith("src/stores/") ||
    path.startsWith("src/hooks/") ||
    path.startsWith("src/services/") ||
    path.startsWith("src/architecture/") ||
    path.startsWith("src/integrations/") ||
    path.startsWith("src/config/") ||
    path.startsWith("src/context/") ||
    path.startsWith("src/types/") ||
    path.startsWith("src/ai/") ||
    path.startsWith("src/debug/") ||
    path.startsWith("src/test/") ||
    path.startsWith("src/assets/") ||
    path === "src/main.tsx" ||
    path === "src/App.tsx" ||
    path === "src/vite-env.d.ts" ||
    path === "src/App.css" ||
    path === "src/index.css"
  ) return null;
  return "src/utils/";
}

function proposeMove(path: string, targetFolder: string): string {
  const fileName = path.split("/").pop()!;
  return targetFolder.replace(/\/$/, "") + "/" + fileName;
}

export function runSelfHealing(): HealReport {
  const generated_at = new Date().toISOString();
  if (shouldSkipInMinimalMode("selfHealingEngine")) {
    const passthrough = fileSystemMap.map((f) => ({ path: f.path, folder: f.folder }));
    return {
      generated_at,
      before: passthrough,
      after: passthrough,
      applied_rules: [],
      steps: [],
      summary: { moves: 0, deprecations: 0, extractions: 0, renames: 0, untouched: passthrough.length },
    };
  }
  const sources = getRawSources();
  const steps: HealStep[] = [];
  const ruleSet = new Set<string>();

  const before = fileSystemMap.map((f) => ({ path: f.path, folder: f.folder }));

  // Index by basename for duplicate detection
  const byBasename = new Map<string, string[]>();
  for (const f of fileSystemMap) {
    const base = f.path.split("/").pop()!;
    if (!byBasename.has(base)) byBasename.set(base, []);
    byBasename.get(base)!.push(f.path);
  }

  // Heatmap for orphan + cycle rules
  const heat = runDependencyHeatmap();
  const isolated = new Set(heat.isolated_nodes.map((n) => n.id));
  const cycles = heat.circular_dependencies;

  for (const f of fileSystemMap) {
    const src = sources["/" + f.path];
    if (typeof src !== "string") continue;

    // RULE H1/H2/H3 — folder placement
    const expected = expectedFolder(f.path, src);
    if (expected) {
      const target = proposeMove(f.path, expected);
      const ruleId = ROUTE_DECL_RE.test(src) ? "H1" : JSX_RE.test(src) ? "H2" : "H3";
      ruleSet.add(ruleId);
      steps.push({
        rule: ruleId,
        file: f.path,
        action: "MOVE",
        target,
        reason: `${ruleId}: file content does not match folder convention → propose ${target}`,
      });
      continue;
    }

    // RULE H4 — orphan detection (no inbound or outbound imports)
    if (
      isolated.has(f.path) &&
      !f.path.startsWith("src/pages/") &&
      !f.path.startsWith("src/components/ui/") &&
      f.path !== "src/main.tsx" &&
      f.path !== "src/App.tsx"
    ) {
      ruleSet.add("H4");
      steps.push({
        rule: "H4",
        file: f.path,
        action: "MARK_DEPRECATED",
        reason: "H4: orphan — 0 inbound and 0 outbound imports",
      });
    }
  }

  // RULE H5 — duplicate basenames → rename, keep newest (we don't have mtime in
  // browser-side glob, so we deterministically keep the LAST in alphabetical
  // order and propose renaming the rest)
  for (const [base, paths] of byBasename) {
    if (paths.length < 2) continue;
    const sorted = [...paths].sort();
    const keep = sorted[sorted.length - 1];
    for (const p of sorted) {
      if (p === keep) continue;
      ruleSet.add("H5");
      steps.push({
        rule: "H5",
        file: p,
        action: "RENAME_KEEP_NEWEST",
        target: p.replace(base, base.replace(/\.(tsx?|jsx?)$/, ".legacy.$1")),
        reason: `H5: duplicate basename "${base}" — keep ${keep}, rename others`,
      });
    }
  }

  // RULE H6 — circular dependencies → propose extracting shared logic into core/
  for (const cycle of cycles) {
    ruleSet.add("H6");
    // Pick the alphabetically first file as the extraction candidate (deterministic)
    const candidate = [...cycle].sort()[0];
    steps.push({
      rule: "H6",
      file: candidate,
      action: "EXTRACT_TO_CORE",
      target: "src/core/" + candidate.split("/").pop(),
      reason: `H6: circular dependency among [${cycle.join(", ")}] — extract shared logic to /core`,
    });
  }

  // Build "after" view by applying MOVE/RENAME proposals
  const moveMap = new Map<string, string>();
  for (const s of steps) {
    if ((s.action === "MOVE" || s.action === "RENAME_KEEP_NEWEST") && s.target) {
      moveMap.set(s.file, s.target);
    }
  }
  const after = before.map((b) => {
    const newPath = moveMap.get(b.path) || b.path;
    const folder = newPath.split("/").slice(0, -1).join("/");
    return { path: newPath, folder };
  });

  const moves = steps.filter((s) => s.action === "MOVE").length;
  const deprecations = steps.filter((s) => s.action === "MARK_DEPRECATED").length;
  const extractions = steps.filter((s) => s.action === "EXTRACT_TO_CORE").length;
  const renames = steps.filter((s) => s.action === "RENAME_KEEP_NEWEST").length;

  return {
    generated_at,
    before,
    after,
    applied_rules: [...ruleSet].sort(),
    steps,
    summary: {
      moves,
      deprecations,
      extractions,
      renames,
      untouched: before.length - (moves + renames),
    },
  };
}
