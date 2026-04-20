/**
 * PROTOCOL LAYER
 *
 * Standardizes the system into a portable architecture protocol. Any project
 * that wants to participate in the multi-project consciousness must satisfy
 * this contract. Pure deterministic checks — no AI, no inference.
 *
 * Output:
 *  - protocol_spec       (the contract itself, frozen)
 *  - compliance_report   (per-project pass/fail with evidence)
 *  - integration_guide   (deterministic step list for non-compliant projects)
 */

export type ProtocolLayerName = "pages" | "components" | "core" | "services" | "routes";

export interface ProtocolFlow {
  from: ProtocolLayerName;
  to: ProtocolLayerName;
}

export interface ProtocolSpec {
  version: "1.0.0";
  required_folders: ReadonlyArray<ProtocolLayerName>;
  allowed_flows: ReadonlyArray<ProtocolFlow>;
  forbidden_flows: ReadonlyArray<ProtocolFlow>;
  required_pipeline: ReadonlyArray<string>;
  required_validation_outputs: ReadonlyArray<string>;
  version_protocol: {
    immutable: true;
    diff_required: true;
  };
}

export const PROTOCOL_SPEC: ProtocolSpec = Object.freeze({
  version: "1.0.0" as const,
  required_folders: Object.freeze<ProtocolLayerName[]>(["pages", "components", "core", "services", "routes"]),
  allowed_flows: Object.freeze<ProtocolFlow[]>([
    { from: "pages", to: "components" },
    { from: "components", to: "core" },
    { from: "core", to: "services" },
    { from: "routes", to: "pages" },
  ]),
  forbidden_flows: Object.freeze<ProtocolFlow[]>([
    { from: "components", to: "pages" },
    { from: "core", to: "components" },
    { from: "core", to: "pages" },
    { from: "services", to: "core" },
    { from: "services", to: "components" },
    { from: "services", to: "pages" },
  ]),
  required_pipeline: Object.freeze<string[]>([
    "truth_scan",
    "structure_map",
    "dependency_graph",
    "rule_enforcement",
    "snapshot",
    "release_gate",
  ]),
  required_validation_outputs: Object.freeze<string[]>([
    "dependency_graph",
    "architecture_score",
    "violation_report",
  ]),
  version_protocol: Object.freeze({ immutable: true as const, diff_required: true as const }),
});

/* -------------------------------------------------------------------------- */
/*  Project submission shape                                                  */
/* -------------------------------------------------------------------------- */

export interface ProtocolEdge {
  from_layer: ProtocolLayerName;
  to_layer: ProtocolLayerName;
}

export interface ProjectProtocolSubmission {
  project_id: string;
  present_folders: ReadonlyArray<string>;
  edges: ReadonlyArray<ProtocolEdge>;
  executed_pipeline: ReadonlyArray<string>;
  validation_outputs: ReadonlyArray<string>;
  versioning: {
    immutable_versions: boolean;
    version_diff_supported: boolean;
  };
}

/* -------------------------------------------------------------------------- */
/*  Compliance result types                                                   */
/* -------------------------------------------------------------------------- */

export type ComplianceStatus = "COMPLIANT" | "NON_COMPLIANT";

export interface ProtocolFinding {
  module: "FILE_STRUCTURE" | "DEPENDENCY" | "EXECUTION" | "VALIDATION" | "VERSION";
  rule: string;
  detail: string;
}

export interface ProjectComplianceResult {
  project_id: string;
  status: ComplianceStatus;
  release_blocked: boolean;
  findings: ProtocolFinding[];
  passed_modules: ReadonlyArray<ProtocolFinding["module"]>;
  failed_modules: ReadonlyArray<ProtocolFinding["module"]>;
  score: number; // 0-100, deterministic
}

export interface IntegrationGuideStep {
  order: number;
  module: ProtocolFinding["module"];
  action: string;
}

export interface ComplianceReport {
  generated_at: string;
  protocol_version: ProtocolSpec["version"];
  projects: ProjectComplianceResult[];
  overall_status: ComplianceStatus;
  blocked_projects: ReadonlyArray<string>;
  integration_guides: Record<string, IntegrationGuideStep[]>;
}

/* -------------------------------------------------------------------------- */
/*  Module checks                                                             */
/* -------------------------------------------------------------------------- */

function checkFileStructure(sub: ProjectProtocolSubmission): ProtocolFinding[] {
  const present = new Set(sub.present_folders.map((f) => f.replace(/^\/+/, "").toLowerCase()));
  const out: ProtocolFinding[] = [];
  for (const required of PROTOCOL_SPEC.required_folders) {
    if (!present.has(required)) {
      out.push({
        module: "FILE_STRUCTURE",
        rule: "required_folder_missing",
        detail: `Missing required folder: /${required}`,
      });
    }
  }
  return out;
}

function checkDependencies(sub: ProjectProtocolSubmission): ProtocolFinding[] {
  const out: ProtocolFinding[] = [];
  const allowed = new Set(
    PROTOCOL_SPEC.allowed_flows.map((f) => `${f.from}>${f.to}`),
  );
  const forbidden = new Set(
    PROTOCOL_SPEC.forbidden_flows.map((f) => `${f.from}>${f.to}`),
  );
  for (const e of sub.edges) {
    const key = `${e.from_layer}>${e.to_layer}`;
    if (forbidden.has(key)) {
      out.push({
        module: "DEPENDENCY",
        rule: "forbidden_flow",
        detail: `Forbidden import direction: ${e.from_layer} → ${e.to_layer}`,
      });
      continue;
    }
    // Same-layer edges are tolerated (utilities within a layer); cross-layer must be in allowed set.
    if (e.from_layer !== e.to_layer && !allowed.has(key)) {
      out.push({
        module: "DEPENDENCY",
        rule: "undeclared_cross_layer_flow",
        detail: `Cross-layer edge ${e.from_layer} → ${e.to_layer} is not in allowed_flows`,
      });
    }
  }
  return out;
}

function checkExecution(sub: ProjectProtocolSubmission): ProtocolFinding[] {
  const executed = new Set(sub.executed_pipeline.map((s) => s.toLowerCase()));
  const out: ProtocolFinding[] = [];
  for (const step of PROTOCOL_SPEC.required_pipeline) {
    if (!executed.has(step)) {
      out.push({
        module: "EXECUTION",
        rule: "pipeline_step_missing",
        detail: `Required pipeline step not executed: ${step}`,
      });
    }
  }
  return out;
}

function checkValidation(sub: ProjectProtocolSubmission): ProtocolFinding[] {
  const exposed = new Set(sub.validation_outputs.map((s) => s.toLowerCase()));
  const out: ProtocolFinding[] = [];
  for (const o of PROTOCOL_SPEC.required_validation_outputs) {
    if (!exposed.has(o)) {
      out.push({
        module: "VALIDATION",
        rule: "validation_output_missing",
        detail: `Required validation output not exposed: ${o}`,
      });
    }
  }
  return out;
}

function checkVersioning(sub: ProjectProtocolSubmission): ProtocolFinding[] {
  const out: ProtocolFinding[] = [];
  if (!sub.versioning.immutable_versions) {
    out.push({
      module: "VERSION",
      rule: "immutable_versions_required",
      detail: "Project versions must be immutable.",
    });
  }
  if (!sub.versioning.version_diff_supported) {
    out.push({
      module: "VERSION",
      rule: "version_diff_required",
      detail: "Project must support version diffs between releases.",
    });
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/*  Integration guide generation                                              */
/* -------------------------------------------------------------------------- */

const ACTION_BY_RULE: Record<string, string> = {
  required_folder_missing: "Create the missing folder at the project root.",
  forbidden_flow: "Refactor imports to remove the forbidden cross-layer direction.",
  undeclared_cross_layer_flow:
    "Either remove the import or update allowed_flows to declare it (only when justified).",
  pipeline_step_missing: "Add the missing step to your build/release pipeline.",
  validation_output_missing: "Expose the missing validation artifact from your scanner.",
  immutable_versions_required: "Switch to an immutable versioning scheme (e.g. snapshot store).",
  version_diff_required: "Implement a version diff utility between snapshots.",
};

function buildIntegrationGuide(findings: ReadonlyArray<ProtocolFinding>): IntegrationGuideStep[] {
  // Stable order: by module priority, then rule id, then detail.
  const moduleOrder: ProtocolFinding["module"][] = [
    "FILE_STRUCTURE",
    "DEPENDENCY",
    "EXECUTION",
    "VALIDATION",
    "VERSION",
  ];
  const sorted = [...findings].sort((a, b) => {
    const ma = moduleOrder.indexOf(a.module);
    const mb = moduleOrder.indexOf(b.module);
    if (ma !== mb) return ma - mb;
    if (a.rule !== b.rule) return a.rule.localeCompare(b.rule);
    return a.detail.localeCompare(b.detail);
  });
  return sorted.map((f, i) => ({
    order: i + 1,
    module: f.module,
    action: `${ACTION_BY_RULE[f.rule] ?? "Resolve finding."} (${f.detail})`,
  }));
}

/* -------------------------------------------------------------------------- */
/*  Public entry points                                                       */
/* -------------------------------------------------------------------------- */

const ALL_MODULES: ProtocolFinding["module"][] = [
  "FILE_STRUCTURE",
  "DEPENDENCY",
  "EXECUTION",
  "VALIDATION",
  "VERSION",
];

export function evaluateProject(sub: ProjectProtocolSubmission): ProjectComplianceResult {
  const findings = [
    ...checkFileStructure(sub),
    ...checkDependencies(sub),
    ...checkExecution(sub),
    ...checkValidation(sub),
    ...checkVersioning(sub),
  ];
  const failedModules = Array.from(new Set(findings.map((f) => f.module))).sort();
  const passedModules = ALL_MODULES.filter((m) => !failedModules.includes(m));
  const status: ComplianceStatus = findings.length === 0 ? "COMPLIANT" : "NON_COMPLIANT";
  // Score: 100 - 5 per finding, floored at 0. Deterministic.
  const score = Math.max(0, 100 - findings.length * 5);
  return Object.freeze({
    project_id: sub.project_id,
    status,
    release_blocked: status === "NON_COMPLIANT",
    findings,
    passed_modules: passedModules,
    failed_modules: failedModules as ProtocolFinding["module"][],
    score,
  });
}

export function evaluateProtocolCompliance(
  submissions: ReadonlyArray<ProjectProtocolSubmission>,
): ComplianceReport {
  const projects = submissions
    .map(evaluateProject)
    .sort((a, b) => a.project_id.localeCompare(b.project_id));
  const blocked = projects.filter((p) => p.release_blocked).map((p) => p.project_id);
  const overall: ComplianceStatus = blocked.length === 0 ? "COMPLIANT" : "NON_COMPLIANT";
  const guides: Record<string, IntegrationGuideStep[]> = {};
  for (const p of projects) {
    if (p.findings.length > 0) guides[p.project_id] = buildIntegrationGuide(p.findings);
  }
  return Object.freeze({
    generated_at: new Date().toISOString(),
    protocol_version: PROTOCOL_SPEC.version,
    projects,
    overall_status: overall,
    blocked_projects: blocked,
    integration_guides: guides,
  });
}

export function getProtocolSpec(): ProtocolSpec {
  return PROTOCOL_SPEC;
}
