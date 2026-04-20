/**
 * REALITY CHECK PANEL
 *
 * Live view of the deterministic Reality Check Engine. Re-runs on every
 * mount + every "Re-validate" click. If any tracked state fails RC1/RC2/RC3,
 * the panel renders a hard "REALITY FAILURE" banner and lists each rejection
 * with its rule id and the expected vs actual values.
 */

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShieldCheck, ShieldAlert, RefreshCw, Search } from "lucide-react";
import { runRealityCheck, type RealityReport } from "@/core/scanner/realityCheckEngine";

export const RealityCheckPanel = () => {
  const [tick, setTick] = useState(0);
  const report: RealityReport = useMemo(() => runRealityCheck(), [tick]);

  const tone =
    report.validity_status === "REALITY VERIFIED"
      ? "good"
      : report.validity_status === "NO STATE TO VERIFY"
      ? "warn"
      : "bad";

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
          Reality Check Engine — RC1 (file proof) · RC2 (origin) · RC3 (consistency)
        </CardTitle>
        <div className="flex items-center gap-2">
          <Badge
            variant={tone === "good" ? "secondary" : tone === "warn" ? "outline" : "destructive"}
            className="text-[10px] uppercase"
          >
            {report.validity_status}
          </Badge>
          <Button size="sm" variant="outline" className="h-7" onClick={() => setTick((t) => t + 1)}>
            <RefreshCw className="h-3 w-3 mr-1" /> Re-validate
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Hard failure banner */}
        {report.blocked && (
          <div className="rounded border border-destructive/60 bg-destructive/10 p-2 text-xs text-destructive flex items-start gap-2">
            <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold">REALITY FAILURE — progression blocked</div>
              <div className="text-[11px] mt-0.5">
                {report.rejected_states.length} of {report.checked_count} tracked states failed validation.
                Downstream pipelines must refuse to run until every rejection is resolved.
              </div>
            </div>
          </div>
        )}

        {/* Top-line counts */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          <Cell label="Checked" value={report.checked_count} tone="muted" />
          <Cell label="Accepted" value={report.accepted_states.length} tone={report.accepted_states.length > 0 ? "good" : "muted"} />
          <Cell label="Rejected" value={report.rejected_states.length} tone={report.rejected_states.length > 0 ? "bad" : "muted"} />
          <Cell label="Blocked" value={report.blocked ? "YES" : "NO"} tone={report.blocked ? "bad" : "good"} />
        </div>

        {/* Accepted */}
        <details className="rounded-md border border-border" open={report.accepted_states.length > 0 && !report.blocked}>
          <summary className="px-2 py-1.5 border-b border-border bg-muted/30 text-[11px] font-semibold cursor-pointer">
            Accepted states ({report.accepted_states.length})
          </summary>
          {report.accepted_states.length === 0 ? (
            <div className="p-2 text-xs text-muted-foreground italic">None.</div>
          ) : (
            <ul className="divide-y divide-border text-[11px] font-mono max-h-48 overflow-y-auto">
              {report.accepted_states.map((a) => (
                <li key={a.state_key} className="px-2 py-1 flex flex-wrap gap-2">
                  <Badge variant="secondary" className="text-[9px]">v{a.version}</Badge>
                  <span className="text-foreground font-semibold">{a.state_key}</span>
                  <span className="text-muted-foreground break-all">{render(a.value)}</span>
                  <span className="text-muted-foreground ml-auto">src: {a.source_module}</span>
                </li>
              ))}
            </ul>
          )}
        </details>

        {/* Rejected */}
        <details className="rounded-md border border-border" open={report.rejected_states.length > 0}>
          <summary className="px-2 py-1.5 border-b border-border bg-muted/30 text-[11px] font-semibold cursor-pointer">
            Rejected states ({report.rejected_states.length})
          </summary>
          {report.rejected_states.length === 0 ? (
            <div className="p-2 text-xs text-muted-foreground italic">No rejections.</div>
          ) : (
            <ul className="divide-y divide-border text-[11px] font-mono max-h-64 overflow-y-auto">
              {report.rejected_states.map((r, i) => (
                <li key={i} className="px-2 py-1">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="destructive" className="text-[9px]">{r.rule_id}</Badge>
                    <span className="text-foreground font-semibold">{r.state_key}</span>
                    {r.source_module && <span className="text-muted-foreground">by {r.source_module}</span>}
                    <span className="text-amber-600 dark:text-amber-400 ml-auto">{r.reason}</span>
                  </div>
                  {(r.expected !== undefined || r.actual !== undefined) && (
                    <div className="mt-0.5 ml-6 text-[10px] text-muted-foreground">
                      <span>expected: {render(r.expected)}</span>
                      {" · "}
                      <span>actual: {render(r.actual)}</span>
                    </div>
                  )}
                  {r.evidence_ref && (
                    <div className="mt-0.5 ml-6 text-[10px] text-muted-foreground break-all">
                      evidence_ref: {r.evidence_ref}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </details>

        {/* Live truth */}
        <details className="rounded-md border border-border">
          <summary className="px-2 py-1.5 border-b border-border bg-muted/30 text-[11px] font-semibold cursor-pointer flex items-center gap-2">
            <Search className="h-3 w-3" /> Live truth (ground floor used for RC3)
          </summary>
          <pre className="p-2 text-[11px] font-mono whitespace-pre-wrap break-all max-h-48 overflow-y-auto">
            {JSON.stringify(report.live_truth, null, 2)}
          </pre>
        </details>

        <p className="text-[10px] text-muted-foreground italic pt-1 border-t">
          Every check runs deterministically against fileSystemMap, scannerV2, dependencyHeatmap,
          and architectureWatchdog. No caching. Generated: {report.generated_at}
        </p>
      </CardContent>
    </Card>
  );
};

const Cell = ({ label, value, tone }: { label: string; value: string | number; tone: "good" | "warn" | "bad" | "muted" }) => {
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

function render(v: unknown): string {
  if (v == null) return String(v);
  if (typeof v === "object") {
    try {
      const s = JSON.stringify(v);
      return s.length > 200 ? s.slice(0, 197) + "…" : s;
    } catch {
      return "[unserializable]";
    }
  }
  return String(v);
}
