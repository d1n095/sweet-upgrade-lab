/**
 * EXECUTION CONTROLLER PANEL
 *
 * Runs and visualises the deterministic 4-state pipeline:
 *   FILE_SCAN → STRUCTURE_MAP → VALIDATION → OUTPUT
 *
 * Enforces single-process execution. If any phase fails, the panel shows
 * "SYSTEM HALTED" and blocks re-runs until operator resets.
 */
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { executionController, type ControllerRunReport, type ControllerState } from "@/core/scanner/executionController";
import { Activity, CheckCircle2, Loader2, OctagonAlert, Play, RotateCcw, Workflow } from "lucide-react";

const PHASES: ControllerState[] = ["FILE_SCAN", "STRUCTURE_MAP", "VALIDATION", "OUTPUT"];

export const ExecutionControllerPanel = () => {
  const [state, setState] = useState<ControllerState>(executionController.getState());
  const [current, setCurrent] = useState<ControllerRunReport | null>(executionController.getCurrent());
  const [history, setHistory] = useState<ControllerRunReport[]>(executionController.getHistory());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => {
      setState(executionController.getState());
      setCurrent(executionController.getCurrent());
      setHistory(executionController.getHistory());
    };
    return executionController.subscribe(sync);
  }, []);

  const lastRun = history[0] ?? null;
  const display = current ?? lastRun;
  const isRunning = state !== "IDLE" && state !== "HALTED";
  const isHalted = state === "HALTED";

  const onRun = () => {
    setError(null);
    try {
      executionController.start();
    } catch (e: any) {
      setError(e?.message || String(e));
    }
  };

  const onReset = () => executionController.resetHalt("operator action from UI");

  const stateTone =
    isHalted ? "destructive" : isRunning ? "default" : state === "IDLE" ? "secondary" : "outline";

  return (
    <Card className={isHalted ? "border-destructive/60 bg-destructive/5" : "border-primary/40"}>
      <CardHeader className="pb-2 flex flex-row items-center justify-between flex-wrap gap-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Workflow className="h-4 w-4 text-primary" />
          Execution Controller — 4-State Pipeline
        </CardTitle>
        <div className="flex items-center gap-2">
          <Badge variant={stateTone as any} className="text-[10px] uppercase font-mono">
            {state}
          </Badge>
          {isHalted ? (
            <Button size="sm" variant="outline" className="h-7" onClick={onReset}>
              <RotateCcw className="h-3 w-3 mr-1" /> Reset Halt
            </Button>
          ) : (
            <Button size="sm" className="h-7" onClick={onRun} disabled={isRunning}>
              {isRunning ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Play className="h-3 w-3 mr-1" />}
              {isRunning ? "Running…" : "Run pipeline"}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Halted banner */}
        {isHalted && display?.halted_reason && (
          <div className="rounded border border-destructive/50 bg-destructive/10 p-2 text-xs text-destructive flex items-start gap-2">
            <OctagonAlert className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold">SYSTEM HALTED — pipeline stopped at invalid state</div>
              <div className="text-[11px] mt-0.5 break-all">{display.halted_reason}</div>
            </div>
          </div>
        )}

        {/* Start error (e.g. R1 violation) */}
        {error && (
          <div className="rounded border border-destructive/50 bg-destructive/10 p-2 text-xs text-destructive">
            {error}
          </div>
        )}

        {/* State machine diagram */}
        <div className="rounded-md border border-border p-2 bg-muted/20">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">
            State machine
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            {PHASES.map((p, i) => {
              const rec = display?.phases.find((r) => r.phase === p);
              const status = rec?.status ?? (state === p ? "running" : "pending");
              const tone =
                status === "ok"
                  ? "border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-400"
                  : status === "failed"
                  ? "border-destructive/50 bg-destructive/10 text-destructive"
                  : status === "running"
                  ? "border-primary/40 bg-primary/10 text-primary animate-pulse"
                  : "border-border bg-muted/30 text-muted-foreground";
              return (
                <div key={p} className="flex items-center gap-1">
                  <div className={`px-2 py-1 rounded border text-[10px] font-mono font-semibold ${tone}`}>
                    {i + 1}. {p}
                    {rec?.duration_ms !== null && rec?.duration_ms !== undefined && (
                      <span className="ml-1 opacity-70">({rec.duration_ms}ms)</span>
                    )}
                  </div>
                  {i < PHASES.length - 1 && <span className="text-muted-foreground">→</span>}
                </div>
              );
            })}
          </div>
        </div>

        {/* Phase log */}
        {display && display.phases.length > 0 && (
          <div className="rounded-md border border-border">
            <div className="px-2 py-1.5 border-b border-border bg-muted/30 text-[11px] font-semibold text-muted-foreground flex items-center justify-between">
              <span>Phase log — run {display.run_id.slice(0, 24)}…</span>
              <span className="font-mono">{new Date(display.started_at).toLocaleTimeString("sv-SE")}</span>
            </div>
            <ul className="divide-y divide-border text-[11px] font-mono">
              {display.phases.map((p) => (
                <li key={p.phase} className="px-2 py-1 flex flex-wrap items-center gap-2">
                  <Badge
                    variant={p.status === "ok" ? "secondary" : p.status === "failed" ? "destructive" : "outline"}
                    className="text-[9px]"
                  >
                    {p.status.toUpperCase()}
                  </Badge>
                  <span className="font-semibold text-foreground">{p.phase}</span>
                  {p.duration_ms !== null && (
                    <span className="text-muted-foreground">{p.duration_ms}ms</span>
                  )}
                  {p.detail && <span className="text-muted-foreground">— {p.detail}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Output report */}
        {display?.output && (
          <div className="rounded-md border border-border">
            <div className="px-2 py-1.5 border-b border-border bg-muted/30 text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
              {display.output.validation_passed ? (
                <CheckCircle2 className="h-3 w-3 text-green-600" />
              ) : (
                <OctagonAlert className="h-3 w-3 text-destructive" />
              )}
              Output — {display.output.validation_passed ? "VALID" : "INVALID"}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 p-2 text-[11px] font-mono">
              <Cell label="files total" value={display.output.files_total} />
              <Cell label="components" value={display.output.components_indexed} />
              <Cell label="pages/routes" value={display.output.pages_indexed} />
              <Cell label="utilities" value={display.output.utilities_indexed} />
            </div>
            {display.output.validation_errors.length > 0 && (
              <ul className="border-t border-border text-[10px] font-mono p-2 space-y-0.5">
                {display.output.validation_errors.map((e, i) => (
                  <li key={i} className="text-destructive">• {e}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* History */}
        {history.length > 0 && (
          <details className="rounded-md border border-border">
            <summary className="px-2 py-1.5 border-b border-border bg-muted/30 text-[11px] font-semibold cursor-pointer">
              Run history ({history.length})
            </summary>
            <ul className="divide-y divide-border text-[10px] font-mono max-h-48 overflow-y-auto">
              {history.map((h) => (
                <li key={h.run_id} className="px-2 py-1 flex flex-wrap items-center gap-2">
                  <Badge
                    variant={h.state === "HALTED" ? "destructive" : "secondary"}
                    className="text-[9px]"
                  >
                    {h.state}
                  </Badge>
                  <span className="text-muted-foreground">
                    {new Date(h.started_at).toLocaleTimeString("sv-SE")}
                  </span>
                  <span className="text-foreground">{h.run_id.slice(0, 24)}…</span>
                  {h.halted_reason && (
                    <span className="text-destructive break-all">— {h.halted_reason}</span>
                  )}
                </li>
              ))}
            </ul>
          </details>
        )}

        <p className="text-[10px] text-muted-foreground italic pt-1 border-t flex items-center gap-1">
          <Activity className="h-3 w-3" />
          Enforces R1 (single process), R2 (no parallel scans), R3 (sequential phases),
          R4 (invalid state = halt). Pure deterministic state machine, no AI.
        </p>
      </CardContent>
    </Card>
  );
};

const Cell = ({ label, value }: { label: string; value: number | string }) => (
  <div className="rounded-md border border-border bg-muted/30 p-2">
    <div className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</div>
    <div className="text-xs font-mono font-bold text-foreground">{value}</div>
  </div>
);
