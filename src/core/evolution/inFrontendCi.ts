/**
 * IN-FRONTEND CI — simulated CI pipeline that runs in the browser.
 *
 * Combines existing signals into 4 stages:
 *   1. lint            — naming/structure violations from projectStructureAnalyzer
 *   2. type-check      — broken imports as a proxy
 *   3. architecture    — layer violations from liveDependencyGraph
 *   4. dep integrity   — circular dependencies
 *
 * Suggest-only. NEVER blocks the actual build. Emits a `would_block` flag
 * the UI can surface.
 */

export type CiStage = "lint" | "type_check" | "architecture" | "dep_integrity";
export type CiStatus = "pass" | "warn" | "fail";

export interface CiStageResult {
  stage: CiStage;
  status: CiStatus;
  count: number;
  details: ReadonlyArray<string>;
  fix_hint: string;
}

export interface CiPipelineInputs {
  /** count of inconsistent_pattern findings */
  naming_violations: number;
  naming_examples: ReadonlyArray<string>;
  /** count of broken_import findings */
  broken_imports: number;
  broken_examples: ReadonlyArray<string>;
  /** layer violations from live dep graph */
  arch_violations: number;
  arch_examples: ReadonlyArray<string>;
  /** circular dep cycles */
  cycles: number;
  cycle_examples: ReadonlyArray<string>;
}

export interface CiPipelineReport {
  generated_at: string;
  overall: CiStatus;
  would_block: boolean;
  stages: ReadonlyArray<CiStageResult>;
  summary: string;
}

function rank(s: CiStatus): number {
  return s === "fail" ? 2 : s === "warn" ? 1 : 0;
}

export function runInFrontendCi(inputs: CiPipelineInputs): CiPipelineReport {
  const stages: CiStageResult[] = [
    {
      stage: "lint",
      status: inputs.naming_violations === 0 ? "pass" : inputs.naming_violations > 5 ? "fail" : "warn",
      count: inputs.naming_violations,
      details: inputs.naming_examples.slice(0, 5),
      fix_hint: "Rename component files to PascalCase.",
    },
    {
      stage: "type_check",
      status: inputs.broken_imports === 0 ? "pass" : "fail",
      count: inputs.broken_imports,
      details: inputs.broken_examples.slice(0, 5),
      fix_hint: "Repair the unresolved import paths or remove the dead reference.",
    },
    {
      stage: "architecture",
      status: inputs.arch_violations === 0 ? "pass" : inputs.arch_violations > 3 ? "fail" : "warn",
      count: inputs.arch_violations,
      details: inputs.arch_examples.slice(0, 5),
      fix_hint: "Lower layers must not import from higher layers (e.g. lib ← pages).",
    },
    {
      stage: "dep_integrity",
      status: inputs.cycles === 0 ? "pass" : "fail",
      count: inputs.cycles,
      details: inputs.cycle_examples.slice(0, 5),
      fix_hint: "Break cycles by extracting shared types into a neutral module.",
    },
  ];

  let overall: CiStatus = "pass";
  for (const s of stages) if (rank(s.status) > rank(overall)) overall = s.status;

  return Object.freeze({
    generated_at: new Date().toISOString(),
    overall,
    would_block: overall === "fail",
    stages: Object.freeze(stages),
    summary:
      overall === "pass"
        ? "All 4 stages passed."
        : `${stages.filter((s) => s.status !== "pass").length} stage(s) need attention.`,
  });
}
