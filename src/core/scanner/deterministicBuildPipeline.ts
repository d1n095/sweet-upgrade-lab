/**
 * DETERMINISTIC BUILD PIPELINE
 *
 * GOAL: Execute the full system in a reproducible, production-safe sequence.
 *
 * STAGES (strict order, each runs EXACTLY ONCE per pipeline run, no parallelism,
 * no skipping; any failure HALTS the pipeline):
 *   1. TRUTH_SCAN          — raw fileSystemMap
 *   2. STRUCTURE_VALIDATION — classify/validate components, pages, etc.
 *   3. DEPENDENCY_GRAPH    — runDependencyHeatmap
 *   4. RULE_ENFORCEMENT    — runArchitectureEnforcement
 *   5. SNAPSHOT            — finalSnapshotEngine.commitIfRunComplete
 *   6. RELEASE_CHECK       — final invariants (hash present, no cycles, no
 *                            critical violations, snapshot committed)
 *
 * AUTHORITY:
 *   This module is its own AUTHORITY for pipeline orchestration but only READS
 *   from existing engines. It does NOT modify them. The ExecutionController
 *   remains the orchestrator for the registry/state pipeline; this module is a
 *   higher-level production gate that composes the same engines into a
 *   release-grade sequence.
 */
import { fileSystemMap, type FileEntry } from "@/lib/fileSystemMap";
import { runDependencyHeatmap, type HeatmapReport } from "@/core/architecture/dependencyHeatmap";
import {
  runArchitectureEnforcement,
  type ArchitectureReport,
} from "@/core/architecture/architectureEnforcementCore";
import { finalSnapshotEngine, type ImmutableSnapshot } from "@/core/scanner/finalSnapshotEngine";
import { versionedArchitectureStore } from "@/core/scanner/versionedArchitectureStore";
import { rollbackEngine } from "@/core/scanner/rollbackEngine";
import { regressionGuard } from "@/core/scanner/regressionGuard";
import { releaseGate } from "@/core/scanner/releaseGate";

export type PipelineStageName =
  | "TRUTH_SCAN"
  | "STRUCTURE_VALIDATION"
  | "DEPENDENCY_GRAPH"
  | "RULE_ENFORCEMENT"
  | "SNAPSHOT"
  | "RELEASE_CHECK";

export const PIPELINE_STAGE_ORDER: PipelineStageName[] = [
  "TRUTH_SCAN",
  "STRUCTURE_VALIDATION",
  "DEPENDENCY_GRAPH",
  "RULE_ENFORCEMENT",
  "SNAPSHOT",
  "RELEASE_CHECK",
];

export type PipelineStatus = "SUCCESS" | "FAILED" | "RUNNING" | "IDLE";

export interface PipelineStageRecord {
  stage: PipelineStageName;
  status: "ok" | "failed" | "running" | "skipped";
  started_at: number;
  finished_at: number | null;
  duration_ms: number | null;
  detail: string | null;
}

export interface PipelineRun {
  pipeline_id: string;
  started_at: number;
  finished_at: number | null;
  status: PipelineStatus;
  failed_stage: PipelineStageName | null;
  failure_reason: string | null;
  stages: PipelineStageRecord[];
  artifacts: {
    file_count: number | null;
    component_count: number | null;
    route_count: number | null;
    dependency_summary: { edges: number; cycles: number; isolated: number } | null;
    architecture_status: ArchitectureReport["build_status"] | null;
    architecture_violations: number | null;
    snapshot: ImmutableSnapshot | null;
  };
  execution_log: string[];
}

class DeterministicBuildPipeline {
  private current: PipelineRun | null = null;
  private history: PipelineRun[] = [];
  private locked = false;
  private listeners = new Set<() => void>();

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private emit() {
    for (const fn of this.listeners) fn();
  }

  getCurrent(): PipelineRun | null {
    return this.current ? clone(this.current) : null;
  }
  getHistory(): PipelineRun[] {
    return this.history.slice(-20).reverse().map(clone);
  }

  /** Returns true while a pipeline run is mid-flight. */
  isRunning(): boolean {
    return this.locked;
  }

  run(): PipelineRun {
    if (this.locked) {
      throw new Error("DeterministicBuildPipeline: cannot start — a run is already in progress.");
    }
    this.locked = true;

    const run: PipelineRun = {
      pipeline_id: `pl#${Date.now()}#${Math.random().toString(36).slice(2, 8)}`,
      started_at: Date.now(),
      finished_at: null,
      status: "RUNNING",
      failed_stage: null,
      failure_reason: null,
      stages: [],
      artifacts: {
        file_count: null,
        component_count: null,
        route_count: null,
        dependency_summary: null,
        architecture_status: null,
        architecture_violations: null,
        snapshot: null,
      },
      execution_log: [],
    };
    this.current = run;
    this.log(run, `pipeline ${run.pipeline_id} started`);
    this.emit();

    let files: FileEntry[] = [];
    let components = 0;
    let routes = 0;
    let depReport: HeatmapReport | null = null;
    let archReport: ArchitectureReport | null = null;

    for (const stage of PIPELINE_STAGE_ORDER) {
      // Enforce: previous stage MUST be ok before advancing.
      if (run.stages.length > 0) {
        const prev = run.stages[run.stages.length - 1];
        if (prev.status !== "ok") {
          this.fail(run, stage, `previous stage ${prev.stage} is ${prev.status} — cannot advance`);
          return this.finish(run);
        }
      }

      const rec: PipelineStageRecord = {
        stage,
        status: "running",
        started_at: Date.now(),
        finished_at: null,
        duration_ms: null,
        detail: null,
      };
      run.stages.push(rec);
      this.log(run, `→ ${stage} started`);
      this.emit();

      try {
        if (stage === "TRUTH_SCAN") {
          if (!Array.isArray(fileSystemMap) || fileSystemMap.length === 0) {
            throw new Error("fileSystemMap is empty — no truth to scan");
          }
          files = fileSystemMap;
          run.artifacts.file_count = files.length;
          rec.detail = `${files.length} files discovered`;
        } else if (stage === "STRUCTURE_VALIDATION") {
          if (files.length === 0) throw new Error("no files from TRUTH_SCAN");
          components = files.filter((f) => f.type === "component").length;
          routes = files.filter((f) => f.type === "page").length;
          if (components === 0 && routes === 0) {
            throw new Error("structure validation found 0 components and 0 routes");
          }
          run.artifacts.component_count = components;
          run.artifacts.route_count = routes;
          rec.detail = `${components} components · ${routes} pages`;
        } else if (stage === "DEPENDENCY_GRAPH") {
          depReport = runDependencyHeatmap();
          if (!depReport) throw new Error("dependencyHeatmap returned no report");
          run.artifacts.dependency_summary = {
            edges: depReport.edges.length,
            cycles: depReport.circular_dependencies.length,
            isolated: depReport.isolated_nodes.length,
          };
          rec.detail = `${depReport.edges.length} edges · ${depReport.circular_dependencies.length} cycles · ${depReport.isolated_nodes.length} isolated`;
        } else if (stage === "RULE_ENFORCEMENT") {
          archReport = runArchitectureEnforcement();
          if (!archReport) throw new Error("architectureEnforcementCore returned no report");
          run.artifacts.architecture_status = archReport.build_status;
          run.artifacts.architecture_violations = archReport.violations.length;
          if (archReport.build_status === "STOP BUILD") {
            throw new Error(
              `architecture build_status=STOP BUILD (${archReport.violations.length} violations)`
            );
          }
          rec.detail = `${archReport.build_status} · ${archReport.violations.length} violations`;
        } else if (stage === "SNAPSHOT") {
          if (!depReport) throw new Error("missing dependency report for snapshot");
          const snap = finalSnapshotEngine.commitIfRunComplete({
            run_id: run.pipeline_id,
            file_count: files.length,
            component_count: components,
            route_count: routes,
            dependency_graph: run.artifacts.dependency_summary!,
          });
          if (!snap) {
            // Snapshot may have been rejected (e.g. file_count drift).
            const state = finalSnapshotEngine.getState();
            const last = state.rejected_attempts[state.rejected_attempts.length - 1];
            throw new Error(`snapshot rejected: ${last?.reason ?? "unknown"}`);
          }
          run.artifacts.snapshot = snap;
          rec.detail = `snapshot ${snap.snapshot_id} · hash ${snap.verification_hash.slice(0, 12)}…`;
        } else if (stage === "RELEASE_CHECK") {
          const a = run.artifacts;
          const errors: string[] = [];
          if (!a.snapshot) errors.push("no snapshot committed");
          if (!a.snapshot?.verification_hash) errors.push("snapshot missing verification_hash");
          if ((a.dependency_summary?.cycles ?? 0) > 0)
            errors.push(`circular dependencies present: ${a.dependency_summary?.cycles}`);
          if (a.architecture_status === "STOP BUILD")
            errors.push("architecture build_status=STOP BUILD");
          if ((a.file_count ?? 0) <= 0) errors.push("file_count <= 0");
          // ── Regression Guard — compare candidate to previous version ──
          let regressionNote = "";
          if (a.file_count != null && a.dependency_summary) {
            const evalRes = regressionGuard.evaluate({
              source_pipeline_id: run.pipeline_id,
              file_count: a.file_count,
              component_count: a.component_count ?? 0,
              route_count: a.route_count ?? 0,
              dependency_graph: a.dependency_summary,
            });
            if (evalRes.regression_detected) {
              const summary = evalRes.differences.map((d) => d.check).join(", ");
              errors.push(`regression detected vs ${evalRes.previous_version_id}: ${summary}`);
            } else {
              regressionNote = evalRes.is_first_version
                ? " · regression guard skipped (first version)"
                : " · regression guard PASS";
            }
          }
          if (errors.length > 0) throw new Error(errors.join("; "));
          rec.detail = `all release invariants hold${regressionNote}`;
        }
        rec.status = "ok";
        rec.finished_at = Date.now();
        rec.duration_ms = rec.finished_at - rec.started_at;
        this.log(run, `✓ ${stage} ok (${rec.duration_ms}ms) — ${rec.detail ?? ""}`);
      } catch (err: any) {
        rec.status = "failed";
        rec.detail = err?.message || String(err);
        rec.finished_at = Date.now();
        rec.duration_ms = rec.finished_at - rec.started_at;
        this.log(run, `✗ ${stage} failed — ${rec.detail}`);
        this.fail(run, stage, rec.detail!);
        return this.finish(run);
      }
      this.emit();
    }

    run.status = "SUCCESS";
    // ── Versioned Architecture State — commit version on success ──
    try {
      const result = versionedArchitectureStore.commitFromPipeline(run);
      if (result) {
        this.log(
          run,
          `✓ versioned ${result.version.version_id} (score=${result.version.architecture_score}) — ${
            result.diff.is_first_version
              ? "initial version"
              : `${Object.keys(result.diff.changes).length} field changes vs ${result.diff.from_version_id}`
          }`
        );
      } else {
        this.log(run, `… version not committed (see Versioned Architecture panel)`);
      }
    } catch (e: any) {
      this.log(run, `… version commit threw: ${e?.message ?? e}`);
    }
    return this.finish(run);
  }

  private fail(run: PipelineRun, stage: PipelineStageName, reason: string) {
    run.status = "FAILED";
    run.failed_stage = stage;
    run.failure_reason = reason;
    this.log(run, `PIPELINE STOPPED at ${stage}: ${reason}`);
  }

  private finish(run: PipelineRun): PipelineRun {
    run.finished_at = Date.now();
    if (run.status === "RUNNING") run.status = "SUCCESS";
    // ── Rollback Engine — evaluate every finished pipeline (success or failure) ──
    try {
      const event = rollbackEngine.evaluatePipelineRun(run);
      if (event) {
        this.log(
          run,
          `↩ rollback ${event.trigger} → ${event.rollback_to_version ?? "no target"} — ${event.reason}`
        );
      }
    } catch (e: any) {
      this.log(run, `… rollback evaluation threw: ${e?.message ?? e}`);
    }
    // ── Release Gate — final APPROVED/BLOCKED verdict ──
    try {
      const decision = releaseGate.evaluate(run);
      this.log(
        run,
        `🔒 release ${decision.release_status}${
          decision.blocking_reasons.length > 0
            ? ` — ${decision.blocking_reasons.join("; ")}`
            : ""
        }`
      );
    } catch (e: any) {
      this.log(run, `… release gate threw: ${e?.message ?? e}`);
    }
    this.history.push(clone(run));
    if (this.history.length > 30) this.history.shift();
    this.locked = false;
    this.emit();
    return clone(run);
  }

  private log(run: PipelineRun, line: string) {
    const ts = new Date().toISOString().slice(11, 23);
    run.execution_log.push(`[${ts}] ${line}`);
    if (run.execution_log.length > 500) run.execution_log.splice(0, run.execution_log.length - 500);
  }
}

function clone(run: PipelineRun): PipelineRun {
  return {
    ...run,
    stages: run.stages.map((s) => ({ ...s })),
    artifacts: { ...run.artifacts, dependency_summary: run.artifacts.dependency_summary ? { ...run.artifacts.dependency_summary } : null },
    execution_log: [...run.execution_log],
  };
}

export const deterministicBuildPipeline = new DeterministicBuildPipeline();
