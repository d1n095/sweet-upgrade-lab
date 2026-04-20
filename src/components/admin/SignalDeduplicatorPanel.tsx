/**
 * SIGNAL DEDUPLICATOR PANEL
 *
 * Collects raw signals from registered read-only reporters and renders a
 * single unified-issues view.
 */
import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Filter, AlertOctagon, AlertTriangle, Info } from "lucide-react";
import {
  deduplicateSignals,
  type RawSignal,
  type SignalSeverity,
  type UnifiedIssue,
} from "@/core/scanner/signalDeduplicator";
import { runArchitectureEnforcement } from "@/core/architecture/architectureEnforcementCore";
import { runDependencyHeatmap } from "@/core/architecture/dependencyHeatmap";
import { runQueueCollapse } from "@/core/scanner/queueCollapseEngine";
import { useWorkQueueStore } from "@/stores/workQueueStore";

const SEVERITY_META: Record<
  SignalSeverity,
  { label: string; icon: typeof Info; cls: string }
> = {
  critical: { label: "Critical", icon: AlertOctagon, cls: "text-destructive" },
  warning: { label: "Warning", icon: AlertTriangle, cls: "text-amber-600 dark:text-amber-400" },
  info: { label: "Info", icon: Info, cls: "text-muted-foreground" },
};

function collectSignals(
  tasks: ReturnType<typeof useWorkQueueStore.getState>["tasks"]
): RawSignal[] {
  const out: RawSignal[] = [];

  try {
    const arch = runArchitectureEnforcement();
    for (const v of arch.violations) {
      out.push({
        module: "architectureEnforcementCore",
        severity: "critical",
        message: v.evidence || `${v.rule} violation`,
        location: `${v.file}:${v.line_hint}`,
        code: v.rule,
        detail: v.fix_suggestion,
      });
    }
  } catch {}

  try {
    const dep = runDependencyHeatmap();
    for (const cyc of dep.circular_dependencies) {
      out.push({
        module: "dependencyHeatmap",
        severity: "critical",
        message: `Circular dependency: ${cyc.join(" → ")}`,
        location: cyc[0],
        code: "CYCLE",
      });
    }
    for (const iso of dep.isolated_nodes.slice(0, 30)) {
      out.push({
        module: "dependencyHeatmap",
        severity: "info",
        message: `Isolated module (no inbound or outbound edges)`,
        location: iso.id,
        code: "ISOLATED",
      });
    }
  } catch {}

  try {
    const queue = runQueueCollapse(tasks);
    for (const r of queue.removed_tasks) {
      out.push({
        module: "queueCollapseEngine",
        severity: r.reason === "outdated_scan" ? "warning" : "info",
        message: `Redundant queue task: ${r.task_title}`,
        location: r.task_id,
        code: r.reason.toUpperCase(),
        detail: r.detail,
      });
    }
  } catch {}

  return out;
}

export function SignalDeduplicatorPanel() {
  const tasks = useWorkQueueStore((s) => s.tasks);
  const { signals, report } = useMemo(() => {
    const raw = collectSignals(tasks);
    return { signals: raw, report: deduplicateSignals(raw) };
  }, [tasks]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Filter className="h-4 w-4" />
          Signal Deduplicator
          <Badge variant="outline" className="ml-1 font-mono text-[10px]">
            READ-ONLY REPORTER
          </Badge>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <Stat label="Signals in" value={report.signals_in} />
          <Stat label="Unique out" value={report.unique_issues_out} accent />
          <Stat label="Reduced" value={report.issue_count_reduced} />
          <Stat label="Reduction" value={`${Math.round(report.reduction_ratio * 100)}%`} />
        </div>

        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(SEVERITY_META) as SignalSeverity[]).map((sev) => {
            const meta = SEVERITY_META[sev];
            const Icon = meta.icon;
            return (
              <div
                key={sev}
                className="flex items-center gap-2 rounded-md border bg-muted/30 px-2 py-1.5 text-xs"
              >
                <Icon className={`h-3.5 w-3.5 shrink-0 ${meta.cls}`} />
                <span className="text-muted-foreground">{meta.label}</span>
                <span className="ml-auto font-mono font-medium">{report.by_severity[sev]}</span>
              </div>
            );
          })}
        </div>

        {report.unique_issues.length === 0 ? (
          <div className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
            Inga signaler från registrerade reporters just nu.
          </div>
        ) : (
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-2">
              Unique issues ({report.unique_issues.length}) · sorted by score
            </div>
            <ScrollArea className="max-h-80 rounded-md border">
              <ul className="divide-y">
                {report.unique_issues.map((issue) => (
                  <IssueRow key={issue.fingerprint} issue={issue} />
                ))}
              </ul>
            </ScrollArea>
          </div>
        )}

        <p className="text-[11px] text-muted-foreground">
          Aggregates raw signals from all reporters into one issue per fingerprint.
          Score = severity rank + corroboration bonus (capped at +20). Does not block execution.
        </p>

        {signals.length === 0 && (
          <p className="text-[11px] text-muted-foreground">
            No raw input — connect additional reporters or run a scan first.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function IssueRow({ issue }: { issue: UnifiedIssue }) {
  const meta = SEVERITY_META[issue.severity];
  const Icon = meta.icon;
  return (
    <li className="p-2.5 text-xs">
      <div className="flex items-start gap-2">
        <Icon className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${meta.cls}`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge
              variant={issue.severity === "critical" ? "destructive" : "secondary"}
              className="text-[10px] h-4"
            >
              {meta.label}
            </Badge>
            {issue.code && (
              <Badge variant="outline" className="text-[10px] h-4 font-mono">
                {issue.code}
              </Badge>
            )}
            <Badge variant="outline" className="text-[10px] h-4">
              score {issue.score}
            </Badge>
            <Badge variant="outline" className="text-[10px] h-4">
              ×{issue.occurrences}
            </Badge>
          </div>
          <div className="mt-1 font-medium break-words">{issue.message}</div>
          {issue.location && (
            <div className="mt-0.5 font-mono text-[10px] text-muted-foreground truncate">
              {issue.location}
            </div>
          )}
          <div className="mt-1 flex flex-wrap gap-1">
            {issue.reporters.map((r) => (
              <Badge key={r} variant="outline" className="text-[10px] h-4 font-mono">
                {r}
              </Badge>
            ))}
          </div>
          {issue.details.length > 0 && (
            <ul className="mt-1 list-disc pl-4 text-[11px] text-muted-foreground space-y-0.5">
              {issue.details.slice(0, 3).map((d, i) => (
                <li key={i} className="break-words">
                  {d}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </li>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-md border bg-card p-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`${accent ? "text-primary" : ""} mt-0.5 text-base font-semibold`}>{value}</div>
    </div>
  );
}
