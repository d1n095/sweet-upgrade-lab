/**
 * EXECUTION CONTROLLER — strict 4-state pipeline (FILE_SCAN → STRUCTURE_MAP → VALIDATION → OUTPUT).
 *
 * RULES (enforced deterministically, no AI):
 *  R1. ONE PROCESS AT A TIME    — global mutex, second start() is rejected.
 *  R2. NO PARALLEL SCANS         — no two phases active simultaneously.
 *  R3. SEQUENTIAL PHASES         — each phase MUST finish before the next starts.
 *  R4. INVALID STATE = SYSTEM HALT — any phase failure freezes the controller;
 *      no further phase may run until resetHalt() is called.
 *
 * State machine (linear, no skips, no rewind):
 *   IDLE → FILE_SCAN → STRUCTURE_MAP → VALIDATION → OUTPUT → IDLE
 *
 * Failure transitions ALL to: HALTED (terminal until manual reset).
 */
import { fileSystemMap, type FileEntry } from "@/lib/fileSystemMap";

export type ControllerState =
  | "IDLE"
  | "FILE_SCAN"
  | "STRUCTURE_MAP"
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
  validation_passed: boolean;
  validation_errors: string[];
  generated_at: string;
}

const PHASE_ORDER: PhaseRecord["phase"][] = [
  "FILE_SCAN",
  "STRUCTURE_MAP",
  "VALIDATION",
  "OUTPUT",
];

class ExecutionController {
  private state: ControllerState = "IDLE";
  private currentRun: ControllerRunReport | null = null;
  private history: ControllerRunReport[] = [];
  private listeners = new Set<() => void>();
  private locked = false; // R1 mutex

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

  /** Manual unlock after HALTED. */
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

  /**
   * Synchronous, deterministic 4-phase run.
   * R1+R2: refuses to start if controller is not IDLE or already locked.
   * R3: phases run strictly in PHASE_ORDER.
   * R4: any phase throw transitions to HALTED.
   */
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

    for (const phase of PHASE_ORDER) {
      // R3 — refuse to advance if a previous phase did not complete cleanly
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
        } else if (phase === "VALIDATION") {
          if (!structureResult) throw new Error("structure result missing");
          this.phaseValidation(scanResult, structureResult);
          rec.detail = structureResult.validation_passed
            ? "all structural invariants hold"
            : `${structureResult.validation_errors.length} validation errors`;
          if (!structureResult.validation_passed) {
            // Validation failure halts the controller (R4)
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

    // All four phases passed
    run.state = "OUTPUT";
    return this.finalize(run, /*ok=*/ true);
  }

  // ── PHASES ──────────────────────────────────────────────────────────────────
  private phaseFileScan(): FileEntry[] {
    if (!Array.isArray(fileSystemMap)) {
      throw new Error("fileSystemMap is not iterable");
    }
    if (fileSystemMap.length === 0) {
      throw new Error("fileSystemMap is empty — cannot proceed");
    }
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
      validation_passed: false, // set in VALIDATION phase
      validation_errors: [],
      generated_at: new Date().toISOString(),
    };
  }

  private phaseValidation(files: FileEntry[], out: ControllerOutput): void {
    const errors: string[] = [];
    // Invariant 1: counts must add up to files_total
    const sum = Object.values(out.by_type).reduce((a, b) => a + b, 0);
    if (sum !== out.files_total) {
      errors.push(`type-count mismatch: sum(${sum}) !== files_total(${out.files_total})`);
    }
    // Invariant 2: every file must have a folder
    const noFolder = files.filter((f) => !f.folder);
    if (noFolder.length > 0) {
      errors.push(`${noFolder.length} files missing folder attribution`);
    }
    // Invariant 3: must contain at least one page (route) and one component
    if (out.pages_indexed === 0) errors.push("no pages found — application has no routes");
    if (out.components_indexed === 0) errors.push("no components found — application has no UI");
    out.validation_errors = errors;
    out.validation_passed = errors.length === 0;
  }

  // ── HELPERS ────────────────────────────────────────────────────────────────
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
