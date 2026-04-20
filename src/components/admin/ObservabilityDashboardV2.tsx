/**
 * OBSERVABILITY DASHBOARD v2
 *
 * Single-panel live view. Every value is read from the orchestrator on every
 * render — no caching, no synthetic defaults. If a value cannot be traced to
 * file evidence the cell renders "UNKNOWN (NO FILE TRUTH)".
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { runOrchestrator } from "@/core/scanner/orchestrator";
import { runScannerV2Verified } from "@/architecture/scannerV2";

const UNKNOWN = "UNKNOWN (NO FILE TRUTH)";

function Metric({ label, value, ok }: { label: string; value: string | number; ok: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 p-2 rounded border border-border/40 bg-muted/30">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className={`text-sm font-mono font-bold ${ok ? "text-foreground" : "text-destructive"}`}>{value}</span>
    </div>
  );
}

export default function ObservabilityDashboardV2() {
  const orch = runOrchestrator();
  const env = runScannerV2Verified();

  const truthOk = orch.steps[0]?.status !== "failed";
  const guardOk = env.verification_status === "TRUE";

  const fileCount = truthOk ? orch.summary.files : UNKNOWN;
  const components =
    guardOk && env.payload !== "STATE BLOCKED — NO VERIFIABLE DATA"
      ? env.payload.processed.components
      : UNKNOWN;
  const routes = truthOk ? `${orch.summary.routes_file_backed}/${orch.summary.routes_registered}` : UNKNOWN;
  const cycles = truthOk ? orch.summary.cycles : UNKNOWN;
  const archViolations = truthOk ? orch.summary.arch_violations : UNKNOWN;
  const confidence =
    guardOk && env.payload !== "STATE BLOCKED — NO VERIFIABLE DATA"
      ? `${env.confidence_score}%`
      : UNKNOWN;

  const depHealth =
    typeof cycles === "number"
      ? cycles === 0
        ? "GOOD"
        : cycles <= 2
        ? "WARNING"
        : "BROKEN"
      : UNKNOWN;
  const archHealth =
    typeof archViolations === "number"
      ? archViolations === 0
        ? "CLEAN"
        : archViolations < 50
        ? "WARNING"
        : "DIRTY"
      : UNKNOWN;

  const overallColor =
    orch.status === "VERIFIED"
      ? "text-primary"
      : orch.status === "WARNING"
      ? "text-amber-600 dark:text-amber-400"
      : "text-destructive";

  return (
    <Card className="border-primary/40 bg-primary/5">
      <CardHeader className="py-2 flex flex-row items-center justify-between">
        <CardTitle className="text-xs font-mono">📊 Observability v2 — Live System Truth</CardTitle>
        <Badge variant="outline" className="text-[10px]">
          status: <span className={`font-bold ${overallColor}`}>{orch.status}</span> · {orch.duration_ms}ms
        </Badge>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          <Metric label="files (real)" value={fileCount} ok={typeof fileCount === "number"} />
          <Metric label="components (real)" value={components} ok={typeof components === "number"} />
          <Metric label="routes file-backed" value={routes} ok={typeof routes === "string" && routes !== UNKNOWN} />
          <Metric label="dep cycles" value={cycles} ok={cycles === 0} />
          <Metric label="arch violations" value={archViolations} ok={archViolations === 0} />
          <Metric label="dep health" value={depHealth} ok={depHealth === "GOOD"} />
          <Metric label="arch health" value={archHealth} ok={archHealth === "CLEAN"} />
          <Metric label="scanner confidence" value={confidence} ok={confidence !== UNKNOWN && env.confidence_score >= 80} />
        </div>
        <div className="text-[10px] font-mono text-muted-foreground pt-1 border-t border-border/40">
          source: live orchestrator + zero-fake-state guard · generated_at {env.generated_at} · evidence {env.evidence.file_count} files / {env.evidence.raw_source_count} sources
        </div>
        {!truthOk && (
          <div className="text-destructive text-xs font-mono">
            ❌ truth layer failed — all metrics blocked. reason: {orch.steps[0]?.reason}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
