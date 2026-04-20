/**
 * REALITY CHECK ENGINE — deterministic validator for system outputs.
 *
 * Validates every record in the system state registry against three rules:
 *   RC1. File-level proof — file_evidence_ref must point to a known source file
 *        that exists in fileSystemMap.
 *   RC2. Traceable origin — source_module must be one of the known producers,
 *        and the latest scanner/heatmap/watchdog run must contain inputs that
 *        match the recorded value (no values derived from cached/previous scans).
 *   RC3. State registry consistency — current_state_snapshot must agree with
 *        the live re-derivation from the source files (live truth wins).
 *
 * NO AI. NO inference. Pure rule execution.
 *
 * If ANY tracked state fails any rule, the engine returns
 * `validity_status: "REALITY FAILURE"` and downstream progression must halt.
 */

import { fileSystemMap } from "@/lib/fileSystemMap";
import { systemStateRegistry, type StateKey, type StateRecord } from "@/core/scanner/systemStateRegistry";
import { runScannerV2 } from "@/architecture/scannerV2";
import { runDependencyHeatmap } from "@/core/architecture/dependencyHeatmap";
import { runArchitectureWatchdog } from "@/core/architecture/architectureWatchdog";

export type ValidityStatus = "REALITY VERIFIED" | "REALITY FAILURE" | "NO STATE TO VERIFY";

export interface RejectedState {
  state_key: string;
  source_module: string | null;
  rule_id: "RC1" | "RC2" | "RC3" | "RC0";
  reason: string;
  expected?: unknown;
  actual?: unknown;
  evidence_ref?: string;
}

export interface AcceptedState {
  state_key: StateKey;
  source_module: string;
  value: unknown;
  evidence_ref: string;
  version: number;
}

export interface RealityReport {
  generated_at: string;
  validity_status: ValidityStatus;
  /** Total tracked states checked (one per known StateKey) */
  checked_count: number;
  accepted_states: AcceptedState[];
  rejected_states: RejectedState[];
  /** Live re-derivation used as the ground truth for RC3 */
  live_truth: {
    file_count: number;
    component_count: number;
    route_count: number;
    dependency_graph: { nodes: number; edges: number; cycles: number; isolated: number };
    architecture_status: { system_state: string; compliance_score: number; violations: number };
  };
  /** Hard block flag — UI must refuse to advance pipelines when true */
  blocked: boolean;
}

const REQUIRED_KEYS: StateKey[] = [
  "file_count",
  "component_count",
  "route_count",
  "dependency_graph",
  "architecture_status",
];

const KNOWN_PRODUCERS: Record<StateKey, string[]> = {
  file_count: ["fileSystemMap"],
  component_count: ["scannerV2"],
  route_count: ["scannerV2"],
  dependency_graph: ["dependencyHeatmap"],
  architecture_status: ["architectureWatchdog"],
};

/** Substring of file_evidence_ref that proves the producer. */
const EVIDENCE_FILE_HINTS: Record<StateKey, string[]> = {
  file_count: ["src/lib/fileSystemMap.ts"],
  component_count: ["src/architecture/scannerV2.ts"],
  route_count: ["src/architecture/scannerV2.ts"],
  dependency_graph: ["src/core/architecture/dependencyHeatmap.ts"],
  architecture_status: ["src/core/architecture/architectureWatchdog.ts"],
};

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a && b && typeof a === "object") {
    try { return JSON.stringify(a) === JSON.stringify(b); } catch { return false; }
  }
  return false;
}

function evidenceFileExists(ref: string): boolean {
  // ref is like "src/foo/bar.ts → ..." — extract the path before any arrow
  const path = (ref.split(/[ →]/)[0] || "").trim();
  if (!path) return false;
  return fileSystemMap.some((f) => f.path === path);
}

export function runRealityCheck(): RealityReport {
  const generated_at = new Date().toISOString();
  const accepted: AcceptedState[] = [];
  const rejected: RejectedState[] = [];

  // Live truth (the ground floor for RC3)
  const scanner = runScannerV2();
  const heat = runDependencyHeatmap();
  const watch = runArchitectureWatchdog();

  const liveTruth: RealityReport["live_truth"] = {
    file_count: fileSystemMap.length,
    component_count: scanner.processed.components,
    route_count: scanner.processed.routes,
    dependency_graph: {
      nodes: heat.metrics.total_nodes,
      edges: heat.metrics.total_edges,
      cycles: heat.metrics.cycles,
      isolated: heat.metrics.isolated,
    },
    architecture_status: {
      system_state: watch.system_state,
      compliance_score: watch.compliance_score,
      violations: watch.violations.length,
    },
  };

  const liveByKey: Record<StateKey, unknown> = {
    file_count: liveTruth.file_count,
    component_count: liveTruth.component_count,
    route_count: liveTruth.route_count,
    dependency_graph: liveTruth.dependency_graph,
    architecture_status: liveTruth.architecture_status,
  };

  let checked = 0;
  for (const key of REQUIRED_KEYS) {
    checked++;
    const rec: StateRecord | undefined = systemStateRegistry.get(key);

    // RC0 — record must exist
    if (!rec) {
      rejected.push({
        state_key: key,
        source_module: null,
        rule_id: "RC0",
        reason: "no record for this state in the registry",
      });
      continue;
    }

    // RC1 — file-level proof must reference a known source file
    if (!rec.file_evidence_ref) {
      rejected.push({
        state_key: key,
        source_module: rec.source_module,
        rule_id: "RC1",
        reason: "missing file_evidence_ref",
      });
      continue;
    }
    if (!evidenceFileExists(rec.file_evidence_ref)) {
      rejected.push({
        state_key: key,
        source_module: rec.source_module,
        rule_id: "RC1",
        reason: "file_evidence_ref does not point to a real file in fileSystemMap",
        evidence_ref: rec.file_evidence_ref,
      });
      continue;
    }
    const expectedHints = EVIDENCE_FILE_HINTS[key];
    if (!expectedHints.some((h) => rec.file_evidence_ref.startsWith(h))) {
      rejected.push({
        state_key: key,
        source_module: rec.source_module,
        rule_id: "RC1",
        reason: `file_evidence_ref does not match expected source(s): ${expectedHints.join(", ")}`,
        evidence_ref: rec.file_evidence_ref,
      });
      continue;
    }

    // RC2 — traceable origin: source_module must be a known producer
    const producers = KNOWN_PRODUCERS[key];
    if (!producers.includes(rec.source_module)) {
      rejected.push({
        state_key: key,
        source_module: rec.source_module,
        rule_id: "RC2",
        reason: `source_module "${rec.source_module}" not in allowed producers: ${producers.join(", ")}`,
      });
      continue;
    }

    // RC3 — state registry consistency vs live re-derivation
    const live = liveByKey[key];
    if (!deepEqual(rec.value, live)) {
      rejected.push({
        state_key: key,
        source_module: rec.source_module,
        rule_id: "RC3",
        reason: "registry value differs from live re-derivation (stale or fabricated)",
        expected: live,
        actual: rec.value,
      });
      continue;
    }

    accepted.push({
      state_key: key,
      source_module: rec.source_module,
      value: rec.value,
      evidence_ref: rec.file_evidence_ref,
      version: rec.version,
    });
  }

  let validity_status: ValidityStatus;
  if (checked === 0) validity_status = "NO STATE TO VERIFY";
  else if (rejected.length > 0) validity_status = "REALITY FAILURE";
  else validity_status = "REALITY VERIFIED";

  return {
    generated_at,
    validity_status,
    checked_count: checked,
    accepted_states: accepted,
    rejected_states: rejected,
    live_truth: liveTruth,
    blocked: validity_status === "REALITY FAILURE",
  };
}
