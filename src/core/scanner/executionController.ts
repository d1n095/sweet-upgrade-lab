/**
 * EXECUTION CONTROLLER — strict 7-state orchestrated pipeline.
 *
 * Pipeline (linear, no skips, no rewind):
 *   IDLE
 *     → FILE_SCAN          (raw file truth from fileSystemMap)
 *     → STRUCTURE_MAP      (classify components/pages/utilities)
 *     → ARCHITECTURE       (run architectureEnforcementCore — A1..A4)
 *     → DEPENDENCIES       (run dependencyHeatmap — graph + cycles)
 *     → REGISTRY           (push derived metrics into systemStateRegistry)
 *     → VALIDATION         (cross-check invariants across all sources)
 *     → OUTPUT             (finalised report)
 *   → IDLE
 *
 * This is the ONLY orchestrator. All other engines are read-only here:
 *   - architectureEnforcementCore.runArchitectureEnforcement()
 *   - dependencyHeatmap.runDependencyHeatmap()
 *   - systemStateRegistry.recordBatch()
 *
 * Rules enforced:
 *   R1. ONE PROCESS AT A TIME    — global mutex.
 *   R2. NO PARALLEL SCANS         — phase mutex.
 *   R3. SEQUENTIAL PHASES         — strict order, every phase must finish OK.
 *   R4. INVALID STATE = HALT      — any failure freezes the controller.
 */
import { fileSystemMap, type FileEntry } from "@/lib/fileSystemMap";
import {
  runArchitectureEnforcement,
  type ArchitectureReport,
} from "@/core/architecture/architectureEnforcementCore";
import {
  runDependencyHeatmap,
  type HeatmapReport,
} from "@/core/architecture/dependencyHeatmap";
import { systemStateRegistry } from "@/core/scanner/systemStateRegistry";
import { hardStateLock } from "@/core/scanner/hardStateLock";
import { minimalMode, type InstabilitySignal } from "@/core/scanner/minimalMode";

export type ControllerState =
  | "IDLE"
  | "FILE_SCAN"
  | "STRUCTURE_MAP"
  | "ARCHITECTURE"
  | "DEPENDENCIES"
  | "REGISTRY"
  | "VALIDATION"
  | "OUTPUT"
  | "HALTED";

export interface PhaseRecord {
  phase: Exclude<ControllerState, "IDLE" | "HALTED">;
  started_at: number;
  finished_at: number | null;
  duration_ms: number | null;
  status: "running" | "ok" | "failed";
  detail: string | null;
}

export interface ControllerRunReport {
  run_id: string;
  started_at: number;
  finished_at: number | null;
  state: ControllerState;
  halted_reason: string | null;
  phases: PhaseRecord[];
  output: ControllerOutput | null;
}

export interface ControllerOutput {
  files_total: number;
  by_type: Record<FileEntry["type"], number>;
  routes_indexed: number;
  utilities_indexed: number;
  components_indexed: number;
  pages_indexed: number;
  /** From architectureEnforcementCore */
  architecture_status: "PASS" | "STOP BUILD" | "SKIPPED";
  architecture_violations: number;
  architecture_violations_by_rule: Record<string, number>;
  /** From dependencyHeatmap */
  dependency_edges: number;
  dependency_cycles: number;
  dependency_isolated: number;
  dependency_top_coupling: { file: string; score: number }[];
  /** Registry */
  registry_records_pushed: number;
  /** Validation invariants */
  validation_passed: boolean;
  validation_errors: string[];
  generated_at: string;
}

const PHASE_ORDER: PhaseRecord["phase"][] = [
  "FILE_SCAN",
  "STRUCTURE_MAP",
  "ARCHITECTURE",
  "DEPENDENCIES",
  "REGISTRY",
  "VALIDATION",
  "OUTPUT",
];

class ExecutionController {
  private state: ControllerState = "IDLE";
  private currentRun: ControllerRunReport | null = null;
  private history: ControllerRunReport[] = [];
  private listeners = new Set<() => void>();
  private locked = false;

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private emit() {
    for (const fn of this.listeners) fn();
  }

  getState(): ControllerState {
    return this.state;
  }
  getCurrent(): ControllerRunReport | null {
    return this.currentRun ? { ...this.currentRun, phases: [...this.currentRun.phases] } : null;
  }
  getHistory(): ControllerRunReport[] {
    return [...this.history].slice(-20).reverse();
  }

  resetHalt(reason = "operator reset"): void {
    if (this.state !== "HALTED") return;
    if (this.currentRun) {
      this.currentRun.halted_reason = `${this.currentRun.halted_reason ?? ""} | RESET: ${reason}`;
      this.history.unshift(this.currentRun);
      this.currentRun = null;
    }
    this.state = "IDLE";
    this.locked = false;
    this.emit();
  }

  start(): ControllerRunReport {
    if (this.locked || this.state !== "IDLE") {
      throw new Error(
        `EXECUTION CONTROLLER R1/R2 violation: cannot start — current state is ${this.state}, locked=${this.locked}`
      );
    }
    this.locked = true;
    const run: ControllerRunReport = {
      run_id: `ctl#${Date.now()}#${Math.random().toString(36).slice(2, 8)}`,
      started_at: Date.now(),
      finished_at: null,
      state: "IDLE",
      halted_reason: null,
      phases: [],
      output: null,
    };
    this.currentRun = run;

    let scanResult: FileEntry[] = [];
    let structureResult: ControllerOutput | null = null;
    let archReport: ArchitectureReport | null = null;
    let depReport: HeatmapReport | null = null;
    let registryPushed = 0;

    for (const phase of PHASE_ORDER) {
      if (run.phases.length > 0) {
        const last = run.phases[run.phases.length - 1];
        if (last.status !== "ok") {
          this.haltRun(run, `R3 violation: cannot advance to ${phase} — previous phase ${last.phase} status=${last.status}`);
          return this.finalize(run);
        }
      }

      const rec: PhaseRecord = {
        phase,
        started_at: Date.now(),
        finished_at: null,
        duration_ms: null,
        status: "running",
        detail: null,
      };
      run.phases.push(rec);
      this.state = phase;
      run.state = phase;
      this.emit();

      try {
        if (phase === "FILE_SCAN") {
          scanResult = this.phaseFileScan();
          rec.detail = `discovered ${scanResult.length} files`;
        } else if (phase === "STRUCTURE_MAP") {
          structureResult = this.phaseStructureMap(scanResult);
          rec.detail = `mapped ${structureResult.components_indexed} components, ${structureResult.pages_indexed} pages, ${structureResult.utilities_indexed} utilities`;
        } else if (phase === "ARCHITECTURE") {
          archReport = runArchitectureEnforcement();
          if (!structureResult) throw new Error("structure missing");
          structureResult.architecture_status = archReport.build_status;
          structureResult.architecture_violations = archReport.violations.length;
          structureResult.architecture_violations_by_rule = archReport.violations.reduce<Record<string, number>>(
            (acc, v) => {
              acc[v.rule] = (acc[v.rule] || 0) + 1;
              return acc;
            },
            {}
          );
          rec.detail = `${archReport.build_status} — ${archReport.violations.length} violations across ${Object.keys(structureResult.architecture_violations_by_rule).length} rules`;
        } else if (phase === "DEPENDENCIES") {
          depReport = runDependencyHeatmap();
          if (!structureResult) throw new Error("structure missing");
          structureResult.dependency_edges = depReport.edges.length;
          structureResult.dependency_cycles = depReport.circular_dependencies.length;
          structureResult.dependency_isolated = depReport.isolated_nodes.length;
          structureResult.dependency_top_coupling = depReport.high_coupling.slice(0, 5).map((n) => ({
            file: n.id,
            score: n.coupling_score,
          }));
          rec.detail = `${depReport.edges.length} edges, ${depReport.circular_dependencies.length} cycles, ${depReport.isolated_nodes.length} isolated`;
          // ── MINIMAL MODE auto-trigger ─────────────────────────────────
          // After DEPENDENCIES we have enough signal to evaluate stability.
          const instSignals: InstabilitySignal[] = [];
          if (archReport && archReport.violations.length > 0) {
            instSignals.push({
              module: "architectureEnforcementCore",
              weight: Math.min(60, archReport.violations.length * 10),
              detail: `${archReport.violations.length} architecture violations`,
            });
          }
          if (depReport.circular_dependencies.length > 0) {
            instSignals.push({
              module: "dependencyHeatmap",
              weight: 40 + depReport.circular_dependencies.length * 10,
              detail: `${depReport.circular_dependencies.length} circular deps`,
            });
          }
          if (instSignals.length > 0) minimalMode.evaluateInstability(instSignals);
        } else if (phase === "REGISTRY") {
          if (!structureResult || !archReport || !depReport) throw new Error("missing inputs for registry");
          hardStateLock.recordBatch({
            writer_module: "executionController",
            entries: [
              {
                state_key: "file_count",
                value: structureResult.files_total,
                source_module: "executionController",
                file_evidence_ref: "src/lib/fileSystemMap.ts",
              },
              {
                state_key: "component_count",
                value: structureResult.components_indexed,
                source_module: "executionController",
                file_evidence_ref: "src/lib/fileSystemMap.ts (type=component)",
              },
              {
                state_key: "route_count",
                value: structureResult.pages_indexed,
                source_module: "executionController",
                file_evidence_ref: "src/lib/fileSystemMap.ts (type=page)",
              },
              {
                state_key: "dependency_graph",
                value: {
                  edges: depReport.edges.length,
                  cycles: depReport.circular_dependencies.length,
                  isolated: depReport.isolated_nodes.length,
                },
                source_module: "executionController",
                file_evidence_ref: "src/core/architecture/dependencyHeatmap.ts",
              },
              {
                state_key: "architecture_status",
                value: {
                  build_status: archReport.build_status,
                  violations: archReport.violations.length,
                },
                source_module: "executionController",
                file_evidence_ref: "src/core/architecture/architectureEnforcementCore.ts",
              },
            ],
          });
          registryPushed = 5;
          structureResult.registry_records_pushed = registryPushed;
          rec.detail = `pushed ${registryPushed} state-keys to registry`;
        } else if (phase === "VALIDATION") {
          if (!structureResult) throw new Error("structure missing");
          this.phaseValidation(scanResult, structureResult);
          rec.detail = structureResult.validation_passed
            ? "all structural invariants hold"
            : `${structureResult.validation_errors.length} validation errors`;
          if (!structureResult.validation_passed) {
            rec.status = "failed";
            rec.finished_at = Date.now();
            rec.duration_ms = rec.finished_at - rec.started_at;
            this.haltRun(run, `VALIDATION failed: ${structureResult.validation_errors.slice(0, 3).join("; ")}`);
            return this.finalize(run);
          }
        } else if (phase === "OUTPUT") {
          if (!structureResult) throw new Error("output requires structure result");
          run.output = structureResult;
          rec.detail = "report finalized";
        }
        rec.status = "ok";
      } catch (err: any) {
        rec.status = "failed";
        rec.detail = err?.message || String(err);
        rec.finished_at = Date.now();
        rec.duration_ms = rec.finished_at - rec.started_at;
        this.haltRun(run, `${phase} threw: ${rec.detail}`);
        return this.finalize(run);
      }
      rec.finished_at = Date.now();
      rec.duration_ms = rec.finished_at - rec.started_at;
      this.emit();
    }

    run.state = "OUTPUT";
    return this.finalize(run, true);
  }

  // ── PHASES ────────────────────────────────────────────────────────────────
  private phaseFileScan(): FileEntry[] {
    if (!Array.isArray(fileSystemMap)) throw new Error("fileSystemMap is not iterable");
    if (fileSystemMap.length === 0) throw new Error("fileSystemMap is empty — cannot proceed");
    return fileSystemMap;
  }

  private phaseStructureMap(files: FileEntry[]): ControllerOutput {
    const by_type: Record<FileEntry["type"], number> = {
      component: 0,
      page: 0,
      hook: 0,
      lib: 0,
      store: 0,
      util: 0,
      edge_function: 0,
      other: 0,
    };
    for (const f of files) by_type[f.type] = (by_type[f.type] || 0) + 1;
    return {
      files_total: files.length,
      by_type,
      routes_indexed: by_type.page,
      utilities_indexed: by_type.util + by_type.lib,
      components_indexed: by_type.component,
      pages_indexed: by_type.page,
      architecture_status: "SKIPPED",
      architecture_violations: 0,
      architecture_violations_by_rule: {},
      dependency_edges: 0,
      dependency_cycles: 0,
      dependency_isolated: 0,
      dependency_top_coupling: [],
      registry_records_pushed: 0,
      validation_passed: false,
      validation_errors: [],
      generated_at: new Date().toISOString(),
    };
  }

  private phaseValidation(files: FileEntry[], out: ControllerOutput): void {
    const errors: string[] = [];
    const sum = Object.values(out.by_type).reduce((a, b) => a + b, 0);
    if (sum !== out.files_total) {
      errors.push(`type-count mismatch: sum(${sum}) !== files_total(${out.files_total})`);
    }
    const noFolder = files.filter((f) => !f.folder);
    if (noFolder.length > 0) {
      errors.push(`${noFolder.length} files missing folder attribution`);
    }
    if (out.pages_indexed === 0) errors.push("no pages found — application has no routes");
    if (out.components_indexed === 0) errors.push("no components found — application has no UI");
    // Architecture failure does NOT fail validation here — surfaced as separate metric.
    out.validation_errors = errors;
    out.validation_passed = errors.length === 0;
  }

  private haltRun(run: ControllerRunReport, reason: string): void {
    this.state = "HALTED";
    run.state = "HALTED";
    run.halted_reason = reason;
    this.emit();
  }

  private finalize(run: ControllerRunReport, ok = false): ControllerRunReport {
    run.finished_at = Date.now();
    if (this.state !== "HALTED") this.state = "IDLE";
    if (ok || this.state !== "HALTED") {
      this.history.unshift(run);
      this.currentRun = null;
    }
    this.locked = false;
    this.emit();
    return { ...run, phases: [...run.phases] };
  }
}

export const executionController = new ExecutionController();
