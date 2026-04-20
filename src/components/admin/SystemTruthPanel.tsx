/**
 * SYSTEM TRUTH PANEL — single unified surface for the orchestrated pipeline.
 *
 * Replaces (visually) these duplicates that previously rendered as separate cards:
 *   - ControlledArchitecturePanel
 *   - ArchitectureRuleEnginePanel
 *   - ArchitectureEnforcementPanel
 *   - RealityCheckPanel
 *   - LoopPreventionPanel
 *   - SystemStateRegistryPanel
 *   - ExecutionControllerPanel
 *
 * Everything is driven by the single ExecutionController orchestrator.
 * Underlying engines remain on disk (no deletions) and are still callable.
 */
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  executionController,
  type ControllerRunReport,
  type ControllerState,
} from "@/core/scanner/executionController";
import {
  Activity,
  CheckCircle2,
  Loader2,
  OctagonAlert,
  Play,
  RotateCcw,
  Workflow,
  ShieldAlert,
  GitBranch,
  Database,
} from "lucide-react";

const PHASES: ControllerState[] = [
  "FILE_SCAN",
  "STRUCTURE_MAP",
  "ARCHITECTURE",
  "DEPENDENCIES",
  "REGISTRY",
  "VALIDATION",
  "OUTPUT",
];

export const SystemTruthPanel = () => {
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

  const out = display?.output ?? null;

  return (
    <Card className={isHalted ? "border-destructive/60 bg-destructive/5" : "border-primary/40"}>
      <CardHeader className="pb-2 flex flex-row items-center justify-between flex-wrap gap-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Workflow className="h-4 w-4 text-primary" />
          System Truth — Unified Pipeline (single source of truth)
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

        {error && (
          <div className="rounded border border-destructive/50 bg-destructive/10 p-2 text-xs text-destructive">
            {error}
          </div>
        )}

        {/* State machine diagram */}
        <div className="rounded-md border border-border p-2 bg-muted/20">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">
            Pipeline state machine (R1 single-process · R2 no-parallel · R3 sequential · R4 halt-on-fail)
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            {PHASES.map((p, i) => {
              const rec = display?.phases.find((r) => r.phase === p);
              const status = rec?.status ?? (state === p ? "running" : "pending");
              const tone =
                status === "ok"
                  ? "border-primary/40 bg-primary/10 text-primary"
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
          <details className="rounded-md border border-border" open={isHalted}>
            <summary className="px-2 py-1.5 border-b border-border bg-muted/30 text-[11px] font-semibold cursor-pointer text-muted-foreground flex items-center justify-between">
              <span>Phase log — run {display.run_id.slice(0, 24)}…</span>
              <span className="font-mono">{new Date(display.started_at).toLocaleTimeString("sv-SE")}</span>
            </summary>
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
          </details>
        )}

        {/* Unified output report */}
        {out && (
          <div className="space-y-2">
            {/* File truth */}
            <Section
              icon={<Workflow className="h-3 w-3" />}
              title="File truth & structure"
              tone={out.validation_passed ? "good" : "bad"}
            >
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <Cell label="files total" value={out.files_total} />
                <Cell label="components" value={out.components_indexed} />
                <Cell label="pages/routes" value={out.pages_indexed} />
                <Cell label="utilities" value={out.utilities_indexed} />
              </div>
              {out.validation_errors.length > 0 && (
                <ul className="text-[10px] font-mono mt-2 space-y-0.5">
                  {out.validation_errors.map((e, i) => (
                    <li key={i} className="text-destructive">• {e}</li>
                  ))}
                </ul>
              )}
            </Section>

            {/* Architecture */}
            <Section
              icon={<ShieldAlert className="h-3 w-3" />}
              title="Architecture enforcement (A1–A4)"
              tone={out.architecture_status === "PASS" ? "good" : "bad"}
            >
              <div className="flex items-center gap-2 mb-1">
                <Badge
                  variant={out.architecture_status === "PASS" ? "secondary" : "destructive"}
                  className="text-[9px] font-mono"
                >
                  {out.architecture_status}
                </Badge>
                <span className="text-[11px] font-mono text-muted-foreground">
                  {out.architecture_violations} total violations
                </span>
              </div>
              {Object.keys(out.architecture_violations_by_rule).length > 0 && (
                <div className="flex gap-1 flex-wrap">
                  {Object.entries(out.architecture_violations_by_rule).map(([rule, count]) => (
                    <Badge key={rule} variant="outline" className="text-[9px] font-mono">
                      {rule}: {count}
                    </Badge>
                  ))}
                </div>
              )}
            </Section>

            {/* Dependencies */}
            <Section
              icon={<GitBranch className="h-3 w-3" />}
              title="Dependency graph"
              tone={out.dependency_cycles === 0 ? "good" : "bad"}
            >
              <div className="grid grid-cols-3 gap-2 mb-2">
                <Cell label="edges" value={out.dependency_edges} />
                <Cell label="cycles" value={out.dependency_cycles} tone={out.dependency_cycles > 0 ? "bad" : "good"} />
                <Cell label="isolated" value={out.dependency_isolated} />
              </div>
              {out.dependency_top_coupling.length > 0 && (
                <div>
                  <div className="text-[10px] uppercase text-muted-foreground mb-0.5">Top coupling</div>
                  <ul className="text-[10px] font-mono space-y-0.5">
                    {out.dependency_top_coupling.map((n) => (
                      <li key={n.file} className="flex justify-between gap-2">
                        <span className="text-foreground truncate">{n.file}</span>
                        <span className="text-muted-foreground">{n.score}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Section>

            {/* Registry */}
            <Section
              icon={<Database className="h-3 w-3" />}
              title="State registry"
              tone="good"
            >
              <div className="text-[11px] font-mono text-muted-foreground">
                Pushed <span className="text-foreground font-semibold">{out.registry_records_pushed}</span>{" "}
                state-keys to systemStateRegistry (single source of truth).
              </div>
            </Section>

            <p className="text-[10px] text-muted-foreground italic pt-1 border-t flex items-center gap-1">
              <Activity className="h-3 w-3" />
              Generated {out.generated_at} — orchestrated by executionController. All other engines
              are read-only consumers; no parallel scanners may run.
            </p>
          </div>
        )}

        {/* History */}
        {history.length > 0 && (
          <details className="rounded-md border border-border">
            <summary className="px-2 py-1.5 border-b border-border bg-muted/30 text-[11px] font-semibold cursor-pointer text-muted-foreground">
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
      </CardContent>
    </Card>
  );
};

const Cell = ({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone?: "good" | "bad";
}) => {
  const cls =
    tone === "bad"
      ? "border-destructive/40 bg-destructive/5"
      : tone === "good"
      ? "border-primary/40 bg-primary/5"
      : "border-border bg-muted/30";
  return (
    <div className={`rounded-md border p-2 ${cls}`}>
      <div className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-xs font-mono font-bold text-foreground">{value}</div>
    </div>
  );
};

const Section = ({
  icon,
  title,
  tone,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  tone: "good" | "bad";
  children: React.ReactNode;
}) => {
  const border = tone === "good" ? "border-primary/30" : "border-destructive/40";
  const Icon = tone === "good" ? CheckCircle2 : OctagonAlert;
  const iconColor = tone === "good" ? "text-primary" : "text-destructive";
  return (
    <div className={`rounded-md border ${border}`}>
      <div className="px-2 py-1.5 border-b border-border bg-muted/30 text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
        {icon}
        {title}
        <Icon className={`h-3 w-3 ml-auto ${iconColor}`} />
      </div>
      <div className="p-2">{children}</div>
    </div>
  );
};
