/**
 * ARCHITECTURE ENFORCEMENT PANEL
 *
 * Live readout of the deterministic Architecture Enforcement Core.
 * If any A1/A2/A3/A4 rule fires, the panel renders a hard "STOP BUILD"
 * banner and lists every violation with file path, line hint, evidence
 * and a concrete fix suggestion.
 */

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShieldCheck, ShieldAlert, RefreshCw, FileWarning } from "lucide-react";
import {
  runArchitectureEnforcement,
  type ArchitectureReport,
  type ArchitectureRuleId,
} from "@/core/architecture/architectureEnforcementCore";

const RULE_LABELS: Record<ArchitectureRuleId, string> = {
  A1: "A1 · /ui cannot import /core",
  A2: "A2 · /routes cannot contain business logic",
  A3: "A3 · /components cannot own data logic",
  A4: "A4 · /services is the only external layer",
};

export const ArchitectureEnforcementPanel = () => {
  const [tick, setTick] = useState(0);
  const report: ArchitectureReport = useMemo(() => runArchitectureEnforcement(), [tick]);

  const blocked = report.build_status === "STOP BUILD";
  const tone = blocked ? "bad" : "good";

  const byRule = useMemo(() => {
    const map: Record<ArchitectureRuleId, typeof report.violations> = {
      A1: [], A2: [], A3: [], A4: [],
    };
    for (const v of report.violations) map[v.rule].push(v);
    return map;
  }, [report]);

  return (
    <Card
      className={
        tone === "bad"
          ? "border-destructive/60 bg-destructive/5"
          : "border-green-500/40 bg-green-500/5"
      }
    >
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          {blocked ? (
            <ShieldAlert className="h-4 w-4 text-destructive" />
          ) : (
            <ShieldCheck className="h-4 w-4 text-primary" />
          )}
          Architecture Enforcement Core — A1 · A2 · A3 · A4
        </CardTitle>
        <div className="flex items-center gap-2">
          <Badge
            variant={blocked ? "destructive" : "secondary"}
            className="text-[10px] uppercase"
          >
            {report.build_status}
          </Badge>
          <Button size="sm" variant="outline" className="h-7" onClick={() => setTick((t) => t + 1)}>
            <RefreshCw className="h-3 w-3 mr-1" /> Re-scan
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {blocked && (
          <div className="rounded border border-destructive/60 bg-destructive/10 p-2 text-xs text-destructive flex items-start gap-2">
            <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold">STOP BUILD — architecture violations detected</div>
              <div className="text-[11px] mt-0.5">
                {report.violations.length} violation(s) across {report.blocked_paths.length} file(s).
                Build pipelines must refuse to advance until every violation is resolved.
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          <Cell label="Files scanned" value={report.files_scanned} tone="muted" />
          <Cell
            label="Violations"
            value={report.violations.length}
            tone={report.violations.length > 0 ? "bad" : "good"}
          />
          <Cell
            label="Blocked files"
            value={report.blocked_paths.length}
            tone={report.blocked_paths.length > 0 ? "bad" : "good"}
          />
          <Cell label="Allowed (sample)" value={report.allowed_paths.length} tone="muted" />
        </div>

        {/* Per-rule breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {(Object.keys(RULE_LABELS) as ArchitectureRuleId[]).map((rid) => {
            const list = byRule[rid];
            const ok = list.length === 0;
            return (
              <div
                key={rid}
                className={`rounded border p-2 ${ok ? "border-green-500/30 bg-green-500/5" : "border-destructive/40 bg-destructive/5"}`}
              >
                <div className="flex items-center gap-2 text-[11px] font-mono font-semibold">
                  {ok ? <ShieldCheck className="h-3 w-3 text-primary" /> : <FileWarning className="h-3 w-3 text-destructive" />}
                  {RULE_LABELS[rid]}
                  <Badge variant={ok ? "secondary" : "destructive"} className="text-[9px] ml-auto">
                    {list.length}
                  </Badge>
                </div>
              </div>
            );
          })}
        </div>

        {/* Violations list */}
        <details className="rounded-md border border-border" open={report.violations.length > 0}>
          <summary className="px-2 py-1.5 border-b border-border bg-muted/30 text-[11px] font-semibold cursor-pointer">
            Violations ({report.violations.length})
          </summary>
          {report.violations.length === 0 ? (
            <div className="p-2 text-xs text-muted-foreground italic">
              No violations. Architecture is compliant with A1–A4.
            </div>
          ) : (
            <ul className="divide-y divide-border text-[11px] font-mono max-h-72 overflow-y-auto">
              {report.violations.map((v, i) => (
                <li key={i} className="px-2 py-1.5">
                  <div className="flex flex-wrap gap-2 items-center">
                    <Badge variant="destructive" className="text-[9px]">{v.rule}</Badge>
                    <span className="text-foreground font-semibold break-all">{v.file}</span>
                    <span className="text-muted-foreground">:{v.line_hint}</span>
                  </div>
                  {v.evidence && (
                    <pre className="mt-1 ml-2 text-[10px] text-muted-foreground whitespace-pre-wrap break-all">
                      {v.evidence}
                    </pre>
                  )}
                  <div className="mt-1 ml-2 text-[10px] text-amber-600 dark:text-amber-400">
                    fix: {v.fix_suggestion}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </details>

        {/* Blocked vs allowed paths */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <details className="rounded-md border border-border">
            <summary className="px-2 py-1.5 border-b border-border bg-muted/30 text-[11px] font-semibold cursor-pointer">
              Blocked paths ({report.blocked_paths.length})
            </summary>
            <ul className="text-[10px] font-mono max-h-40 overflow-y-auto">
              {report.blocked_paths.length === 0 ? (
                <li className="px-2 py-1 text-muted-foreground italic">None.</li>
              ) : (
                report.blocked_paths.map((p) => (
                  <li key={p} className="px-2 py-0.5 text-destructive break-all">{p}</li>
                ))
              )}
            </ul>
          </details>
          <details className="rounded-md border border-border">
            <summary className="px-2 py-1.5 border-b border-border bg-muted/30 text-[11px] font-semibold cursor-pointer">
              Allowed paths sample ({report.allowed_paths.length})
            </summary>
            <ul className="text-[10px] font-mono max-h-40 overflow-y-auto">
              {report.allowed_paths.slice(0, 80).map((p) => (
                <li key={p} className="px-2 py-0.5 text-muted-foreground break-all">{p}</li>
              ))}
            </ul>
          </details>
        </div>

        <p className="text-[10px] text-muted-foreground italic pt-1 border-t">
          Pure rule scan over fileSystemMap. Generated: {report.generated_at}
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
