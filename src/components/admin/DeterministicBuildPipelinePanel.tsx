/**
 * DETERMINISTIC BUILD PIPELINE PANEL
 *
 * Operator UI for the 6-stage release-grade pipeline. Shows stage progress,
 * artifacts, and the execution log. Single Run button — pipeline is locked
 * while running.
 */
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Play,
  Workflow,
  Circle,
  AlertOctagon,
} from "lucide-react";
import {
  deterministicBuildPipeline,
  PIPELINE_STAGE_ORDER,
  type PipelineRun,
  type PipelineStageName,
  type PipelineStageRecord,
} from "@/core/scanner/deterministicBuildPipeline";
import { toast } from "sonner";

const STAGE_LABELS: Record<PipelineStageName, string> = {
  TRUTH_SCAN: "1 · Truth Scan",
  STRUCTURE_VALIDATION: "2 · Structure Validation",
  DEPENDENCY_GRAPH: "3 · Dependency Graph",
  RULE_ENFORCEMENT: "4 · Rule Enforcement",
  SNAPSHOT: "5 · Snapshot",
  RELEASE_CHECK: "6 · Release Check",
};

export function DeterministicBuildPipelinePanel() {
  const [run, setRun] = useState<PipelineRun | null>(() => deterministicBuildPipeline.getCurrent());
  const [history, setHistory] = useState<PipelineRun[]>(() => deterministicBuildPipeline.getHistory());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const tick = () => {
      setRun(deterministicBuildPipeline.getCurrent());
      setHistory(deterministicBuildPipeline.getHistory());
      setBusy(deterministicBuildPipeline.isRunning());
    };
    return deterministicBuildPipeline.subscribe(tick);
  }, []);

  const start = () => {
    if (busy) return;
    try {
      const result = deterministicBuildPipeline.run();
      if (result.status === "SUCCESS") {
        toast.success(`Pipeline ${result.pipeline_id} — SUCCESS`);
      } else {
        toast.error(`Pipeline FAILED at ${result.failed_stage}: ${result.failure_reason}`);
      }
    } catch (err: any) {
      toast.error(err?.message || "pipeline start failed");
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Workflow className="h-4 w-4" />
            Deterministic Build Pipeline
            <Badge variant="outline" className="ml-1 font-mono text-[10px]">
              SEQUENTIAL · ONCE PER STAGE
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            {run && <StatusBadge run={run} />}
            <Button size="sm" onClick={start} disabled={busy} className="gap-1.5">
              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
              {busy ? "Running…" : "Run pipeline"}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Stage list */}
        <ol className="space-y-1.5">
          {PIPELINE_STAGE_ORDER.map((stageName) => {
            const rec = run?.stages.find((s) => s.stage === stageName) ?? null;
            return <StageRow key={stageName} name={stageName} rec={rec} />;
          })}
        </ol>

        {/* Failure callout */}
        {run?.status === "FAILED" && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            <AlertOctagon className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <div className="font-semibold">Pipeline halted at {run.failed_stage}</div>
              <div className="mt-0.5 break-words opacity-90">{run.failure_reason}</div>
            </div>
          </div>
        )}

        {/* Artifacts */}
        {run?.artifacts && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Stat label="Files" value={run.artifacts.file_count} />
            <Stat label="Components" value={run.artifacts.component_count} />
            <Stat label="Routes" value={run.artifacts.route_count} />
            <Stat
              label="Edges/Cycles/Iso"
              value={
                run.artifacts.dependency_summary
                  ? `${run.artifacts.dependency_summary.edges}/${run.artifacts.dependency_summary.cycles}/${run.artifacts.dependency_summary.isolated}`
                  : null
              }
            />
            <Stat label="Arch status" value={run.artifacts.architecture_status} />
            <Stat
              label="Snapshot hash"
              value={run.artifacts.snapshot?.verification_hash.slice(0, 12).concat("…") ?? null}
            />
          </div>
        )}

        {/* Execution log */}
        {run && run.execution_log.length > 0 && (
          <details className="rounded-md border" open={run.status === "FAILED"}>
            <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted/40">
              Execution log ({run.execution_log.length} lines)
            </summary>
            <pre className="max-h-64 overflow-auto border-t bg-muted/30 p-3 font-mono text-[11px] leading-tight">
              {run.execution_log.join("\n")}
            </pre>
          </details>
        )}

        {/* History */}
        {history.length > 0 && (
          <details className="rounded-md border">
            <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted/40">
              History ({history.length} earlier runs)
            </summary>
            <ul className="divide-y border-t text-[11px]">
              {history.map((r) => (
                <li key={r.pipeline_id} className="grid grid-cols-[1fr_auto] gap-x-3 px-3 py-2">
                  <div className="font-mono">{r.pipeline_id}</div>
                  <div className="flex items-center gap-2">
                    <span
                      className={
                        r.status === "SUCCESS"
                          ? "text-primary"
                          : r.status === "FAILED"
                          ? "text-destructive"
                          : "text-muted-foreground"
                      }
                    >
                      {r.status}
                    </span>
                    {r.failed_stage && (
                      <span className="text-muted-foreground">@ {r.failed_stage}</span>
                    )}
                    <span className="text-muted-foreground">
                      {r.finished_at ? `${r.finished_at - r.started_at}ms` : ""}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </details>
        )}

        <p className="text-[11px] text-muted-foreground">
          Stages execute sequentially, exactly once each. Any failure stops the pipeline and
          captures the failed stage + reason. The snapshot stage commits an immutable, hash-verified
          state via the Final Snapshot Engine.
        </p>
      </CardContent>
    </Card>
  );
}

function StageRow({ name, rec }: { name: PipelineStageName; rec: PipelineStageRecord | null }) {
  const status = rec?.status ?? "pending";
  const Icon =
    status === "ok"
      ? CheckCircle2
      : status === "failed"
      ? XCircle
      : status === "running"
      ? Loader2
      : Circle;
  const tone =
    status === "ok"
      ? "text-primary"
      : status === "failed"
      ? "text-destructive"
      : status === "running"
      ? "text-foreground"
      : "text-muted-foreground/60";
  return (
    <li className="grid grid-cols-[auto_1fr_auto] items-center gap-2 rounded-md border bg-card px-3 py-1.5 text-xs">
      <Icon className={`h-4 w-4 ${tone} ${status === "running" ? "animate-spin" : ""}`} />
      <div>
        <div className="font-medium">{STAGE_LABELS[name]}</div>
        {rec?.detail && (
          <div className="mt-0.5 text-[11px] text-muted-foreground">{rec.detail}</div>
        )}
      </div>
      <div className="text-[11px] text-muted-foreground tabular-nums">
        {rec?.duration_ms != null ? `${rec.duration_ms}ms` : "—"}
      </div>
    </li>
  );
}

function StatusBadge({ run }: { run: PipelineRun }) {
  if (run.status === "RUNNING")
    return (
      <Badge variant="secondary" className="gap-1 text-[10px]">
        <Loader2 className="h-3 w-3 animate-spin" /> RUNNING
      </Badge>
    );
  if (run.status === "SUCCESS")
    return (
      <Badge variant="secondary" className="gap-1 text-[10px]">
        <CheckCircle2 className="h-3 w-3" /> SUCCESS
      </Badge>
    );
  if (run.status === "FAILED")
    return (
      <Badge variant="destructive" className="gap-1 text-[10px]">
        <XCircle className="h-3 w-3" /> FAILED
      </Badge>
    );
  return null;
}

function Stat({ label, value }: { label: string; value: number | string | null }) {
  return (
    <div className="rounded-md border bg-card px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-mono text-sm font-medium">{value ?? "—"}</div>
    </div>
  );
}
