/**
 * CONTROLLED ARCHITECTURE ENGINE — UI panel.
 *
 * Renders the three-phase truth report with hard-block banner if any phase
 * fails. No charts, no animations — pure traceable data.
 */

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShieldAlert, ShieldCheck, RefreshCw, FileSearch } from "lucide-react";
import {
  runControlledArchitectureEngine,
  type ControlledArchitectureReport,
} from "@/core/architecture/controlledArchitectureEngine";

export const ControlledArchitecturePanel = () => {
  const [tick, setTick] = useState(0);
  const report: ControlledArchitectureReport = useMemo(
    () => runControlledArchitectureEngine(),
    [tick]
  );

  const tone =
    report.status === "TRUTH VERIFIED"
      ? "good"
      : report.status === "FILE TRUTH UNAVAILABLE"
      ? "bad"
      : "warn";

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
          {tone === "good" ? (
            <ShieldCheck className="h-4 w-4 text-primary" />
          ) : (
            <ShieldAlert className="h-4 w-4 text-destructive" />
          )}
          Controlled Architecture Engine — Phase 1 · Phase 2 · Phase 3
        </CardTitle>
        <div className="flex items-center gap-2">
          <Badge
            variant={tone === "good" ? "secondary" : tone === "warn" ? "outline" : "destructive"}
            className="text-[10px] uppercase"
          >
            {report.status}
          </Badge>
          <Button size="sm" variant="outline" className="h-7" onClick={() => setTick((t) => t + 1)}>
            <RefreshCw className="h-3 w-3 mr-1" /> Re-derive from files
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {report.blocked && (
          <div className="rounded border border-destructive/60 bg-destructive/10 p-2 text-xs text-destructive flex items-start gap-2">
            <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold">
                {report.status === "FILE TRUTH UNAVAILABLE"
                  ? "FILE TRUTH UNAVAILABLE — engine cannot run"
                  : "MISMATCHES DETECTED — pipelines must halt"}
              </div>
              <div className="text-[11px] mt-0.5">
                {report.status === "FILE TRUTH UNAVAILABLE"
                  ? "fileSystemMap returned 0 files. The truth source is missing."
                  : `${report.phase3.mismatches.length} import(s) cannot be traced to a real file on disk.`}
              </div>
            </div>
          </div>
        )}

        {/* Top-line counts */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          <Cell label="P1 · files" value={report.phase1.total_files} tone="muted" />
          <Cell label="P2 · components" value={report.phase2.components} tone="muted" />
          <Cell label="P2 · routes" value={report.phase2.routes} tone="muted" />
          <Cell
            label="P3 · mismatches"
            value={report.phase3.mismatches.length}
            tone={report.phase3.mismatches.length > 0 ? "bad" : "good"}
          />
        </div>

        {/* PHASE 1 */}
        <details className="rounded-md border border-border" open>
          <summary className="px-2 py-1.5 border-b border-border bg-muted/30 text-[11px] font-semibold cursor-pointer">
            Phase 1 — File Truth ({report.phase1.total_files} files, {report.phase1.folders.length} folders)
          </summary>
          <div className="p-2 grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] font-mono">
            <div>
              <div className="text-[10px] uppercase text-muted-foreground mb-1">By extension</div>
              <ul className="space-y-0.5">
                {Object.entries(report.phase1.by_extension)
                  .sort((a, b) => b[1] - a[1])
                  .map(([ext, n]) => (
                    <li key={ext} className="flex justify-between">
                      <span className="text-muted-foreground">{ext}</span>
                      <span className="text-foreground">{n}</span>
                    </li>
                  ))}
              </ul>
            </div>
            <div>
              <div className="text-[10px] uppercase text-muted-foreground mb-1">Top folders</div>
              <ul className="space-y-0.5 max-h-40 overflow-y-auto">
                {report.phase1.folders.slice(0, 12).map((f) => (
                  <li key={f.folder} className="flex justify-between">
                    <span className="text-muted-foreground break-all">{f.folder}</span>
                    <span className="text-foreground ml-2">{f.files}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <details className="border-t border-border">
            <summary className="px-2 py-1 text-[10px] font-mono text-muted-foreground cursor-pointer">
              Evidence sample (first {report.phase1.evidence_sample.length} paths)
            </summary>
            <ul className="p-2 text-[10px] font-mono max-h-40 overflow-y-auto">
              {report.phase1.evidence_sample.map((p) => (
                <li key={p} className="text-muted-foreground break-all">{p}</li>
              ))}
            </ul>
          </details>
        </details>

        {/* PHASE 2 */}
        <details className="rounded-md border border-border" open>
          <summary className="px-2 py-1.5 border-b border-border bg-muted/30 text-[11px] font-semibold cursor-pointer">
            Phase 2 — Structure Map (deterministic classification)
          </summary>
          <div className="p-2 grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px] font-mono">
            <Cell label="Components" value={report.phase2.components} tone="muted" />
            <Cell label="Routes" value={report.phase2.routes} tone="muted" />
            <Cell label="Utilities" value={report.phase2.utilities} tone="muted" />
            <Cell label="Other" value={report.phase2.other} tone="muted" />
          </div>
          <details className="border-t border-border">
            <summary className="px-2 py-1 text-[10px] font-mono text-muted-foreground cursor-pointer">
              Classifications sample ({report.phase2.classifications_sample.length})
            </summary>
            <ul className="p-2 text-[10px] font-mono max-h-48 overflow-y-auto divide-y divide-border">
              {report.phase2.classifications_sample.map((c) => (
                <li key={c.path} className="py-0.5 flex flex-wrap gap-2">
                  <Badge variant="outline" className="text-[9px]">{c.kind}</Badge>
                  <span className="text-foreground break-all">{c.path}</span>
                  <span className="text-muted-foreground ml-auto">{c.rule}</span>
                </li>
              ))}
            </ul>
          </details>
        </details>

        {/* PHASE 3 */}
        <details className="rounded-md border border-border" open={report.phase3.mismatches.length > 0}>
          <summary className="px-2 py-1.5 border-b border-border bg-muted/30 text-[11px] font-semibold cursor-pointer flex items-center gap-2">
            <FileSearch className="h-3 w-3" />
            Phase 3 — Validation ({report.phase3.resolved_imports}/{report.phase3.imports_inspected} imports resolve, {report.phase3.mismatches.length} mismatches)
          </summary>
          {report.phase3.mismatches.length === 0 ? (
            <div className="p-2 text-xs text-muted-foreground italic">
              All local imports resolve to real files in fileSystemMap.
            </div>
          ) : (
            <ul className="divide-y divide-border text-[11px] font-mono max-h-72 overflow-y-auto">
              {report.phase3.mismatches.slice(0, 200).map((m, i) => (
                <li key={i} className="px-2 py-1">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="destructive" className="text-[9px]">P3</Badge>
                    <span className="text-foreground break-all">{m.file}</span>
                  </div>
                  <div className="ml-2 text-[10px] text-muted-foreground break-all">
                    import: <span className="text-foreground">{m.import_specifier}</span>
                  </div>
                  <div className="ml-2 text-[10px] text-amber-600 dark:text-amber-400">
                    {m.reason}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </details>

        <p className="text-[10px] text-muted-foreground italic pt-1 border-t">
          Source: {report.truth_source}. No cache, no previous scans, no parallel execution.
          Generated: {report.generated_at}
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
