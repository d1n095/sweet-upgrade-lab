/**
 * STRICT MODE PANEL
 *
 * Surfaces the binary PASS/FAIL strict-mode verdict and lets the operator
 * toggle strict mode and re-evaluate. Any violation = FAIL. No warnings.
 */
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  ShieldCheck,
  ShieldAlert,
  ShieldOff,
  Play,
  AlertOctagon,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { strictMode, type StrictReport } from "@/core/scanner/strictMode";

export function StrictModePanel() {
  const [state, setState] = useState(() => strictMode.getState());

  useEffect(() => {
    const tick = () => setState(strictMode.getState());
    return strictMode.subscribe(tick);
  }, []);

  const onToggle = (on: boolean) => strictMode.setEnabled(on);
  const onEvaluate = () => strictMode.evaluate();

  const report = state.last_report;
  const verdictMeta = verdictBadge(report?.strict_status);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            {state.enabled ? (
              <ShieldCheck className="h-4 w-4" />
            ) : (
              <ShieldOff className="h-4 w-4 text-muted-foreground" />
            )}
            Strict Mode
            <Badge variant="outline" className="ml-1 font-mono text-[10px]">
              ZERO TOLERANCE
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-[10px]">
              evaluations: {state.total_evaluations}
            </Badge>
            {state.total_failures > 0 && (
              <Badge variant="destructive" className="text-[10px]">
                fails: {state.total_failures}
              </Badge>
            )}
            <div className="flex items-center gap-1.5 rounded-md border bg-card px-2 py-1">
              <Switch
                id="strict-mode-toggle"
                checked={state.enabled}
                onCheckedChange={onToggle}
              />
              <label
                htmlFor="strict-mode-toggle"
                className="cursor-pointer text-[11px] font-medium uppercase tracking-wide"
              >
                {state.enabled ? "ON" : "OFF"}
              </label>
            </div>
            <Button size="sm" onClick={onEvaluate} className="h-7">
              <Play className="mr-1 h-3 w-3" />
              Evaluate
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {!report ? (
          <div className="rounded-md border border-dashed bg-muted/30 px-3 py-6 text-center text-xs text-muted-foreground">
            No strict evaluation yet. Click <span className="font-medium">Evaluate</span> to run a
            zero-tolerance pass/fail check across architecture, dependency graph, regression guard,
            release gate, and drift detector.
          </div>
        ) : (
          <>
            {/* Verdict banner */}
            <div
              className={`rounded-md border p-3 ${
                report.strict_status === "PASS"
                  ? "border-border bg-muted/20"
                  : "border-destructive/50 bg-destructive/5"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {verdictMeta.icon}
                  <span className="font-mono text-lg font-bold">
                    {report.strict_status}
                  </span>
                  <Badge variant={verdictMeta.variant} className="text-[10px]">
                    {verdictMeta.label}
                  </Badge>
                  {!state.enabled && (
                    <Badge variant="outline" className="text-[10px] text-muted-foreground">
                      mode disabled (advisory)
                    </Badge>
                  )}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {new Date(report.evaluated_at).toLocaleString()}
                </div>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{report.summary}</p>
            </div>

            {/* Checks grid */}
            <div className="rounded-md border bg-card">
              <div className="border-b px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Checks ({report.checks.length})
              </div>
              <ul className="divide-y">
                {report.checks.map((c) => (
                  <li
                    key={c.name}
                    className="grid grid-cols-[24px_140px_1fr_auto] items-center gap-2 px-3 py-2 text-xs"
                  >
                    {c.passed ? (
                      <CheckCircle2 className="h-4 w-4 text-foreground" />
                    ) : (
                      <XCircle className="h-4 w-4 text-destructive" />
                    )}
                    <span className="font-mono text-[11px]">{c.name}</span>
                    <span className="truncate text-muted-foreground">{c.detail}</span>
                    <Badge
                      variant={c.passed ? "secondary" : "destructive"}
                      className="text-[10px]"
                    >
                      {c.passed ? "PASS" : "FAIL"}
                    </Badge>
                  </li>
                ))}
              </ul>
            </div>

            {/* Violations */}
            {report.violation_count > 0 && (
              <div className="rounded-md border border-destructive/40 bg-destructive/5">
                <div className="flex items-center gap-1.5 border-b border-destructive/30 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-destructive">
                  <AlertOctagon className="h-3 w-3" />
                  Violations ({report.violation_count})
                </div>
                <ul className="max-h-64 divide-y overflow-auto text-xs">
                  {report.violations.map((v, i) => (
                    <li
                      key={i}
                      className="grid grid-cols-[140px_120px_1fr] items-start gap-2 px-3 py-1.5"
                    >
                      <Badge variant="outline" className="justify-self-start text-[10px]">
                        {v.source}
                      </Badge>
                      <span className="font-mono text-[11px]">{v.rule}</span>
                      <span className="text-[11px] text-muted-foreground">{v.detail}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* History */}
            {state.history.length > 1 && (
              <details className="rounded-md border bg-card">
                <summary className="cursor-pointer border-b px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground hover:bg-muted/40">
                  History ({state.history.length})
                </summary>
                <ul className="max-h-40 divide-y overflow-auto text-[11px]">
                  {state.history.slice(0, 20).map((r, i) => (
                    <li
                      key={i}
                      className="grid grid-cols-[60px_1fr_auto] items-center gap-2 px-3 py-1.5"
                    >
                      <Badge
                        variant={r.strict_status === "PASS" ? "secondary" : "destructive"}
                        className="justify-self-start font-mono text-[10px]"
                      >
                        {r.strict_status}
                      </Badge>
                      <span className="truncate text-muted-foreground">{r.summary}</span>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {new Date(r.evaluated_at).toLocaleTimeString()}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </>
        )}

        <p className="text-[11px] text-muted-foreground">
          Strict mode is binary: ANY violation across architecture, dependency graph, regression
          guard, release gate, or drift detector returns FAIL. There are no warnings, no scores,
          and no thresholds — only PASS or FAIL.
        </p>
      </CardContent>
    </Card>
  );
}

function verdictBadge(status: StrictReport["strict_status"] | undefined): {
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline";
  icon: React.ReactNode;
} {
  switch (status) {
    case "PASS":
      return {
        label: "production-ready",
        variant: "secondary",
        icon: <ShieldCheck className="h-5 w-5 text-foreground" />,
      };
    case "FAIL":
      return {
        label: "stop",
        variant: "destructive",
        icon: <ShieldAlert className="h-5 w-5 text-destructive" />,
      };
    default:
      return {
        label: "idle",
        variant: "outline",
        icon: <ShieldOff className="h-5 w-5 text-muted-foreground" />,
      };
  }
}
