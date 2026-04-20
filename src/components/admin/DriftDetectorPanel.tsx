/**
 * DRIFT DETECTOR PANEL
 *
 * Compares the live system to the last Immutable Snapshot v2 baseline and
 * surfaces silent changes (file list, routes, dependency graph, violations).
 */
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  FileText,
  GitBranch,
  Map as MapIcon,
  RefreshCw,
  ShieldAlert,
  History as HistoryIcon,
} from "lucide-react";
import { driftDetector, type DriftReport } from "@/core/scanner/driftDetector";

export function DriftDetectorPanel() {
  const [state, setState] = useState(() => driftDetector.getState());

  useEffect(() => {
    const tick = () => setState(driftDetector.getState());
    return driftDetector.subscribe(tick);
  }, []);

  const onCheck = () => {
    driftDetector.check();
  };

  const report = state.last_report;

  const statusMeta = useMemo(() => statusBadge(report?.drift_status), [report]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4" />
            Drift Detector
            <Badge variant="outline" className="ml-1 font-mono text-[10px]">
              SILENT-CHANGE WATCH
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-[10px]">
              checks: {state.total_checks}
            </Badge>
            {state.last_drift_at && (
              <Badge variant="outline" className="text-[10px]">
                last drift: {new Date(state.last_drift_at).toLocaleTimeString()}
              </Badge>
            )}
            <Button size="sm" onClick={onCheck} className="h-7">
              <RefreshCw className="mr-1 h-3 w-3" />
              Check now
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {!report ? (
          <div className="rounded-md border border-dashed bg-muted/30 px-3 py-6 text-center text-xs text-muted-foreground">
            No drift checks run yet. Click <span className="font-medium">Check now</span> to compare
            the live system against the last Immutable Snapshot v2 baseline.
          </div>
        ) : (
          <>
            {/* Verdict header */}
            <div
              className={`rounded-md border p-3 text-xs ${
                report.drift_status === "DRIFT_DETECTED"
                  ? "border-destructive/50 bg-destructive/5"
                  : report.drift_status === "NO_BASELINE"
                    ? "border-border bg-muted/30"
                    : "border-border bg-muted/20"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {statusMeta.icon}
                  <span className="font-mono text-sm font-semibold">
                    {report.drift_status}
                  </span>
                  <Badge variant={statusMeta.variant} className="text-[10px]">
                    {statusMeta.label}
                  </Badge>
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {new Date(report.checked_at).toLocaleString()}
                </div>
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">{report.summary}</p>

              {/* Hash comparison */}
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <HashBox label="baseline_hash" value={report.baseline_hash} />
                <HashBox label="live_hash" value={report.live_hash} />
              </div>
              {report.baseline_id && (
                <div className="mt-2 text-[10px] text-muted-foreground">
                  baseline_id:{" "}
                  <span className="font-mono">{report.baseline_id}</span>
                </div>
              )}
            </div>

            {/* Counters */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              <CounterStat label="Files" {...report.counters.files} />
              <CounterStat label="Routes" {...report.counters.routes} />
              <CounterStat label="Edges" {...report.counters.edges} />
              <CounterStat label="Cycles" {...report.counters.cycles} />
              <CounterStat label="Isolated" {...report.counters.isolated} />
              <CounterStat label="Violations" {...report.counters.violations} />
            </div>

            {/* Changed files */}
            <Section
              icon={<FileText className="h-3 w-3" />}
              title={`Changed files (${report.changed_files.total})`}
            >
              {report.changed_files.total === 0 ? (
                <Empty>No file additions or removals.</Empty>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  <DiffList
                    label="Added"
                    items={report.changed_files.added}
                    tone="add"
                  />
                  <DiffList
                    label="Removed"
                    items={report.changed_files.removed}
                    tone="remove"
                  />
                </div>
              )}
            </Section>

            {/* Route diff */}
            <Section
              icon={<MapIcon className="h-3 w-3" />}
              title={`Route changes (${report.route_diff.total})`}
            >
              {report.route_diff.total === 0 ? (
                <Empty>No route additions, removals, or mutations.</Empty>
              ) : (
                <div className="space-y-2">
                  {(report.route_diff.added.length > 0 ||
                    report.route_diff.removed.length > 0) && (
                    <div className="grid gap-2 sm:grid-cols-2">
                      <DiffList
                        label="Added paths"
                        items={report.route_diff.added}
                        tone="add"
                      />
                      <DiffList
                        label="Removed paths"
                        items={report.route_diff.removed}
                        tone="remove"
                      />
                    </div>
                  )}
                  {report.route_diff.mutated.length > 0 && (
                    <div className="rounded-md border bg-card">
                      <div className="border-b px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Mutated ({report.route_diff.mutated.length})
                      </div>
                      <ul className="max-h-40 divide-y overflow-auto text-[11px]">
                        {report.route_diff.mutated.map((m) => (
                          <li key={m.path} className="px-3 py-1.5 font-mono">
                            <span className="text-foreground">{m.path}</span>
                            <span className="text-muted-foreground">
                              {" "}
                              · {m.before} → {m.after}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </Section>

            {/* Dependency-graph mini summary */}
            <Section
              icon={<GitBranch className="h-3 w-3" />}
              title="Dependency graph deltas"
            >
              <ul className="divide-y text-[11px]">
                <DeltaRow label="Edges" {...report.counters.edges} />
                <DeltaRow label="Cycles" {...report.counters.cycles} />
                <DeltaRow label="Isolated" {...report.counters.isolated} />
                <DeltaRow label="Violations" {...report.counters.violations} />
              </ul>
            </Section>

            {/* History */}
            {state.history.length > 1 && (
              <Section
                icon={<HistoryIcon className="h-3 w-3" />}
                title={`History (${state.history.length})`}
              >
                <ul className="max-h-40 divide-y overflow-auto text-[11px]">
                  {state.history.slice(0, 20).map((r, i) => (
                    <li
                      key={i}
                      className="grid grid-cols-[110px_1fr_auto] items-center gap-2 px-3 py-1.5"
                    >
                      <Badge
                        variant={statusBadge(r.drift_status).variant}
                        className="justify-self-start text-[10px]"
                      >
                        {r.drift_status}
                      </Badge>
                      <span className="truncate text-muted-foreground">{r.summary}</span>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {new Date(r.checked_at).toLocaleTimeString()}
                      </span>
                    </li>
                  ))}
                </ul>
              </Section>
            )}
          </>
        )}

        <p className="text-[11px] text-muted-foreground">
          Drift = the live system differs from the last Immutable Snapshot v2 baseline without a
          new pipeline-committed snapshot. Run a fresh capture in the v2 panel to clear drift.
        </p>
      </CardContent>
    </Card>
  );
}

function statusBadge(status: DriftReport["drift_status"] | undefined): {
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline";
  icon: React.ReactNode;
} {
  switch (status) {
    case "DRIFT_DETECTED":
      return {
        label: "drift",
        variant: "destructive",
        icon: <ShieldAlert className="h-4 w-4 text-destructive" />,
      };
    case "STABLE":
      return {
        label: "stable",
        variant: "secondary",
        icon: <CheckCircle2 className="h-4 w-4 text-foreground" />,
      };
    case "NO_BASELINE":
      return {
        label: "no baseline",
        variant: "outline",
        icon: <AlertTriangle className="h-4 w-4 text-muted-foreground" />,
      };
    default:
      return {
        label: "idle",
        variant: "outline",
        icon: <Activity className="h-4 w-4 text-muted-foreground" />,
      };
  }
}

function HashBox({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="rounded border bg-card px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="break-all font-mono text-[11px]">{value ?? "—"}</div>
    </div>
  );
}

function CounterStat({
  label,
  before,
  after,
  delta,
}: {
  label: string;
  before: number;
  after: number;
  delta: number;
}) {
  const tone =
    delta === 0
      ? "text-muted-foreground"
      : delta > 0
        ? "text-foreground"
        : "text-destructive";
  return (
    <div className="rounded-md border bg-card px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-mono text-sm font-medium">
        {before} → {after}
      </div>
      <div className={`text-[10px] ${tone}`}>
        Δ {delta > 0 ? `+${delta}` : delta}
      </div>
    </div>
  );
}

function DeltaRow({
  label,
  before,
  after,
  delta,
}: {
  label: string;
  before: number;
  after: number;
  delta: number;
}) {
  return (
    <li className="grid grid-cols-[120px_1fr_auto] items-center gap-2 px-3 py-1.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono">
        {before} → {after}
      </span>
      <span
        className={`font-mono ${
          delta === 0
            ? "text-muted-foreground"
            : delta > 0
              ? "text-foreground"
              : "text-destructive"
        }`}
      >
        Δ {delta > 0 ? `+${delta}` : delta}
      </span>
    </li>
  );
}

function DiffList({
  label,
  items,
  tone,
}: {
  label: string;
  items: ReadonlyArray<string>;
  tone: "add" | "remove";
}) {
  return (
    <div className="rounded-md border bg-card">
      <div className="flex items-center justify-between border-b px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        <span>{label}</span>
        <Badge variant="outline" className="text-[10px]">
          {items.length}
        </Badge>
      </div>
      {items.length === 0 ? (
        <div className="px-3 py-2 text-[11px] text-muted-foreground">(none)</div>
      ) : (
        <ul className="max-h-40 divide-y overflow-auto font-mono text-[11px]">
          {items.slice(0, 100).map((it, i) => (
            <li
              key={i}
              className={`px-3 py-1 ${
                tone === "add" ? "text-foreground" : "text-destructive"
              }`}
            >
              {tone === "add" ? "+ " : "− "}
              {it}
            </li>
          ))}
          {items.length > 100 && (
            <li className="px-3 py-1 text-muted-foreground">
              … {items.length - 100} more (truncated)
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <details className="rounded-md border bg-card" open>
      <summary className="flex cursor-pointer items-center gap-1.5 border-b px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground hover:bg-muted/40">
        {icon}
        {title}
      </summary>
      <div className="p-2 text-xs">{children}</div>
    </details>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 py-2 text-center text-[11px] text-muted-foreground">{children}</div>
  );
}
