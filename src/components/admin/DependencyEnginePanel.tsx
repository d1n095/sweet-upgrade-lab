/**
 * DEPENDENCY ENGINE — UI panel.
 *
 * Pure readout of the deterministic import-only graph: totals, hottest
 * coupled files, most unstable files, circular dependencies (Tarjan SCC),
 * orphan files. No AI, no inferred edges.
 */

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, Network, GitFork, FileQuestion, ShieldAlert, ShieldCheck, Activity } from "lucide-react";
import {
  runDependencyEngine,
  type DependencyReport,
} from "@/core/architecture/dependencyEngine";

export const DependencyEnginePanel = () => {
  const [tick, setTick] = useState(0);
  const report: DependencyReport = useMemo(() => runDependencyEngine(), [tick]);

  const hasCycles = report.circular_dependencies.length > 0;
  const tone = hasCycles ? "bad" : report.coupling.global_stability_score < 50 ? "warn" : "good";

  return (
    <Card
      className={
        tone === "bad"
          ? "border-destructive/60 bg-destructive/5"
          : tone === "warn"
          ? "border-yellow-500/40 bg-yellow-500/5"
          : "border-green-500/40 bg-green-500/5"
      }
    >
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          {tone === "bad" ? (
            <ShieldAlert className="h-4 w-4 text-destructive" />
          ) : (
            <ShieldCheck className="h-4 w-4 text-primary" />
          )}
          Dependency Engine — imports only · graph + counts
        </CardTitle>
        <div className="flex items-center gap-2">
          <Badge
            variant={tone === "good" ? "secondary" : tone === "warn" ? "outline" : "destructive"}
            className="text-[10px] uppercase"
          >
            stability {report.coupling.global_stability_score}/100
          </Badge>
          <Button size="sm" variant="outline" className="h-7" onClick={() => setTick((t) => t + 1)}>
            <RefreshCw className="h-3 w-3 mr-1" /> Re-scan
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Top-line counts */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          <Cell label="Files" value={report.totals.files} tone="muted" />
          <Cell label="Edges" value={report.totals.edges} tone="muted" />
          <Cell
            label="Cycles"
            value={report.circular_dependencies.length}
            tone={report.circular_dependencies.length > 0 ? "bad" : "good"}
          />
          <Cell label="Orphans" value={report.orphan_files.length} tone={report.orphan_files.length > 0 ? "warn" : "good"} />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          <Cell label="External skipped" value={report.totals.external_imports_skipped} tone="muted" />
          <Cell
            label="Unresolved"
            value={report.totals.unresolved_imports}
            tone={report.totals.unresolved_imports > 0 ? "warn" : "good"}
          />
          <Cell label="Avg coupling" value={report.coupling.average_coupling} tone="muted" />
          <Cell label="Avg instability" value={report.coupling.average_instability} tone="muted" />
        </div>

        {/* CIRCULAR DEPENDENCIES */}
        <details className="rounded-md border border-border" open={hasCycles}>
          <summary className="px-2 py-1.5 border-b border-border bg-muted/30 text-[11px] font-semibold cursor-pointer flex items-center gap-2">
            <GitFork className="h-3 w-3" />
            Circular dependencies ({report.circular_dependencies.length})
          </summary>
          {report.circular_dependencies.length === 0 ? (
            <div className="p-2 text-xs text-muted-foreground italic">
              No cycles detected (Tarjan SCC, size &gt; 1 or self-loop).
            </div>
          ) : (
            <ul className="divide-y divide-border text-[11px] font-mono max-h-72 overflow-y-auto">
              {report.circular_dependencies.map((c, i) => (
                <li key={i} className="px-2 py-1.5">
                  <div className="flex items-center gap-2">
                    <Badge variant="destructive" className="text-[9px]">cycle</Badge>
                    <span className="text-muted-foreground">size {c.size}</span>
                  </div>
                  <ul className="mt-1 ml-4 list-disc text-[10px] text-foreground">
                    {c.files.slice(0, 20).map((f) => (
                      <li key={f} className="break-all">{f}</li>
                    ))}
                    {c.files.length > 20 && (
                      <li className="text-muted-foreground italic">
                        …{c.files.length - 20} more
                      </li>
                    )}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </details>

        {/* COUPLING — hottest */}
        <details className="rounded-md border border-border">
          <summary className="px-2 py-1.5 border-b border-border bg-muted/30 text-[11px] font-semibold cursor-pointer flex items-center gap-2">
            <Activity className="h-3 w-3" />
            Hottest coupled files (top {report.coupling.hottest.length})
          </summary>
          <ul className="divide-y divide-border text-[11px] font-mono max-h-72 overflow-y-auto">
            {report.coupling.hottest.map((n) => (
              <li key={n.path} className="px-2 py-1 flex flex-wrap gap-2 items-center">
                <Badge variant="outline" className="text-[9px]">in {n.fan_in}</Badge>
                <Badge variant="outline" className="text-[9px]">out {n.fan_out}</Badge>
                <span className="text-muted-foreground">cpl {n.coupling}</span>
                <span className="text-foreground break-all">{n.path}</span>
                <span className="text-muted-foreground ml-auto">
                  inst {n.instability.toFixed(2)}
                </span>
              </li>
            ))}
          </ul>
        </details>

        {/* COUPLING — most unstable */}
        <details className="rounded-md border border-border">
          <summary className="px-2 py-1.5 border-b border-border bg-muted/30 text-[11px] font-semibold cursor-pointer flex items-center gap-2">
            <Network className="h-3 w-3" />
            Most unstable files (top {report.coupling.most_unstable.length})
          </summary>
          {report.coupling.most_unstable.length === 0 ? (
            <div className="p-2 text-xs text-muted-foreground italic">No unstable files.</div>
          ) : (
            <ul className="divide-y divide-border text-[11px] font-mono max-h-72 overflow-y-auto">
              {report.coupling.most_unstable.map((n) => (
                <li key={n.path} className="px-2 py-1 flex flex-wrap gap-2 items-center">
                  <Badge variant="outline" className="text-[9px]">inst {n.instability.toFixed(2)}</Badge>
                  <Badge variant="outline" className="text-[9px]">in {n.fan_in}</Badge>
                  <Badge variant="outline" className="text-[9px]">out {n.fan_out}</Badge>
                  <span className="text-foreground break-all">{n.path}</span>
                </li>
              ))}
            </ul>
          )}
        </details>

        {/* ORPHANS */}
        <details className="rounded-md border border-border" open={report.orphan_files.length > 0 && !hasCycles}>
          <summary className="px-2 py-1.5 border-b border-border bg-muted/30 text-[11px] font-semibold cursor-pointer flex items-center gap-2">
            <FileQuestion className="h-3 w-3" />
            Orphan files ({report.orphan_files.length})
          </summary>
          {report.orphan_files.length === 0 ? (
            <div className="p-2 text-xs text-muted-foreground italic">
              No orphans. Every file is reachable via imports or routing.
            </div>
          ) : (
            <ul className="text-[10px] font-mono max-h-56 overflow-y-auto">
              {report.orphan_files.map((p) => (
                <li key={p} className="px-2 py-0.5 text-amber-600 dark:text-amber-400 break-all">
                  {p}
                </li>
              ))}
            </ul>
          )}
        </details>

        {/* UNRESOLVED IMPORTS */}
        {report.unresolved_samples.length > 0 && (
          <details className="rounded-md border border-border">
            <summary className="px-2 py-1.5 border-b border-border bg-muted/30 text-[11px] font-semibold cursor-pointer">
              Unresolved imports sample ({report.unresolved_samples.length} of {report.totals.unresolved_imports})
            </summary>
            <ul className="divide-y divide-border text-[10px] font-mono max-h-48 overflow-y-auto">
              {report.unresolved_samples.map((u, i) => (
                <li key={i} className="px-2 py-0.5">
                  <span className="text-foreground break-all">{u.file}</span>
                  <span className="text-muted-foreground"> ← </span>
                  <span className="text-amber-600 dark:text-amber-400 break-all">{u.specifier}</span>
                </li>
              ))}
            </ul>
          </details>
        )}

        <p className="text-[10px] text-muted-foreground italic pt-1 border-t">
          Source: {report.truth_source}. Edges from import statements only. Cycles via Tarjan SCC.
          Coupling = fan_in + fan_out. Instability = fan_out / coupling. Generated: {report.generated_at}
        </p>
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
  value: string | number;
  tone: "good" | "warn" | "bad" | "muted";
}) => {
  const cls =
    tone === "good"
      ? "border-green-500/40 bg-green-500/5"
      : tone === "warn"
      ? "border-yellow-500/40 bg-yellow-500/5"
      : tone === "bad"
      ? "border-destructive/40 bg-destructive/5"
      : "border-border bg-muted/30";
  return (
    <div className={`rounded-md border p-2 ${cls}`}>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-xs font-mono font-semibold text-foreground">{value}</div>
    </div>
  );
};
