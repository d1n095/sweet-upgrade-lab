/**
 * ARCHITECTURE RULE ENGINE — UI panel.
 *
 * Live readout of the deterministic 4-rule engine (R1 ui · R2 routes ·
 * R3 logic · R4 imports). Hard "STOP" banner when any rule fires; every
 * violation lists exact file path + line + evidence + fix suggestion.
 */

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShieldAlert, ShieldCheck, RefreshCw, FileWarning, GitBranch } from "lucide-react";
import {
  runArchitectureRuleEngine,
  type ArchitectureRuleReport,
  type RuleId,
} from "@/core/architecture/architectureRuleEngine";

const RULE_LABELS: Record<RuleId, string> = {
  R1: "R1 · UI must live in /components or /pages",
  R2: "R2 · Routes must map 1:1 to files",
  R3: "R3 · Business logic only in /core or /services",
  R4: "R4 · No cross-layer imports outside allowed flow",
};

export const ArchitectureRuleEnginePanel = () => {
  const [tick, setTick] = useState(0);
  const report: ArchitectureRuleReport = useMemo(() => runArchitectureRuleEngine(), [tick]);
  const [activeRule, setActiveRule] = useState<RuleId | "ALL">("ALL");

  const blocked = report.execution_status === "STOP";
  const tone = blocked ? "bad" : "good";

  const filtered = useMemo(
    () =>
      activeRule === "ALL"
        ? report.violations
        : report.violations.filter((v) => v.rule === activeRule),
    [report, activeRule]
  );

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
          Architecture Rule Engine — R1 · R2 · R3 · R4
        </CardTitle>
        <div className="flex items-center gap-2">
          <Badge
            variant={blocked ? "destructive" : "secondary"}
            className="text-[10px] uppercase"
          >
            {report.execution_status}
          </Badge>
          <Button size="sm" variant="outline" className="h-7" onClick={() => setTick((t) => t + 1)}>
            <RefreshCw className="h-3 w-3 mr-1" /> Re-validate
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {blocked && (
          <div className="rounded border border-destructive/60 bg-destructive/10 p-2 text-xs text-destructive flex items-start gap-2">
            <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold">STOP — execution blocked by architecture rules</div>
              <div className="text-[11px] mt-0.5">
                {report.violations.length} violation(s) across {report.files_scanned} scanned files.
                Resolve every violation below before pipelines may proceed.
              </div>
            </div>
          </div>
        )}

        {/* Top-line counts */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          <Cell label="Files scanned" value={report.files_scanned} tone="muted" />
          <Cell
            label="Violations"
            value={report.violations.length}
            tone={report.violations.length > 0 ? "bad" : "good"}
          />
          <Cell
            label="Rules failed"
            value={Object.values(report.violations_by_rule).filter((n) => n > 0).length}
            tone={Object.values(report.violations_by_rule).some((n) => n > 0) ? "bad" : "good"}
          />
          <Cell
            label="Status"
            value={report.execution_status}
            tone={report.execution_status === "PASS" ? "good" : "bad"}
          />
        </div>

        {/* Per-rule breakdown with click-to-filter */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setActiveRule("ALL")}
            className={`rounded border p-2 text-left ${activeRule === "ALL" ? "border-primary bg-primary/5" : "border-border bg-muted/30"}`}
          >
            <div className="flex items-center gap-2 text-[11px] font-mono font-semibold">
              <GitBranch className="h-3 w-3" />
              ALL violations
              <Badge variant="outline" className="text-[9px] ml-auto">
                {report.violations.length}
              </Badge>
            </div>
          </button>
          {(Object.keys(RULE_LABELS) as RuleId[]).map((rid) => {
            const n = report.violations_by_rule[rid];
            const ok = n === 0;
            const active = activeRule === rid;
            return (
              <button
                key={rid}
                type="button"
                onClick={() => setActiveRule(rid)}
                className={`rounded border p-2 text-left transition-colors ${
                  active
                    ? "border-primary bg-primary/5"
                    : ok
                    ? "border-green-500/30 bg-green-500/5"
                    : "border-destructive/40 bg-destructive/5"
                }`}
              >
                <div className="flex items-center gap-2 text-[11px] font-mono font-semibold">
                  {ok ? (
                    <ShieldCheck className="h-3 w-3 text-primary" />
                  ) : (
                    <FileWarning className="h-3 w-3 text-destructive" />
                  )}
                  {RULE_LABELS[rid]}
                  <Badge variant={ok ? "secondary" : "destructive"} className="text-[9px] ml-auto">
                    {n}
                  </Badge>
                </div>
              </button>
            );
          })}
        </div>

        {/* Violations list */}
        <details className="rounded-md border border-border" open={filtered.length > 0}>
          <summary className="px-2 py-1.5 border-b border-border bg-muted/30 text-[11px] font-semibold cursor-pointer">
            {activeRule === "ALL" ? "All violations" : `${activeRule} violations`} ({filtered.length})
          </summary>
          {filtered.length === 0 ? (
            <div className="p-2 text-xs text-muted-foreground italic">
              No violations for this filter.
            </div>
          ) : (
            <ul className="divide-y divide-border text-[11px] font-mono max-h-80 overflow-y-auto">
              {filtered.slice(0, 200).map((v, i) => (
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
              {filtered.length > 200 && (
                <li className="px-2 py-1 text-[10px] text-muted-foreground italic">
                  …{filtered.length - 200} more not shown
                </li>
              )}
            </ul>
          )}
        </details>

        <p className="text-[10px] text-muted-foreground italic pt-1 border-t">
          Pure rule scan over fileSystemMap + ROUTE_REGISTRY. No cache, no inference.
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
