/**
 * LOOP PREVENTION PANEL
 *
 * Live readout of the deterministic loop prevention engine.
 * Includes a self-test that exercises L1 (identical output), L2 (stagnation
 * halt) and L3 (recursion block) so operators can verify the engine works.
 */

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, Repeat, ShieldAlert, ShieldCheck, Play, RotateCcw } from "lucide-react";
import {
  getReport,
  recordCycle,
  resetAll,
  withRecursionGuard,
  type LoopReport,
} from "@/core/scanner/loopPreventionEngine";

export const LoopPreventionPanel = () => {
  const [tick, setTick] = useState(0);
  const report: LoopReport = useMemo(() => getReport(), [tick]);

  const tone =
    report.loop_status === "SAFE"
      ? "good"
      : report.loop_status === "LOOP DETECTED"
      ? "warn"
      : "bad";

  const refresh = () => setTick((t) => t + 1);

  const runSelfTest = () => {
    // L1 + L2: same output 3 times triggers identical → stagnation halt
    recordCycle("self_test::stagnation", { value: 1 });
    recordCycle("self_test::stagnation", { value: 1 });
    recordCycle("self_test::stagnation", { value: 1 });
    // L3: recursion via direct stack reentry
    withRecursionGuard("self_test::recursion", () => {
      const r = withRecursionGuard("self_test::recursion", () => "should not run");
      recordCycle("self_test::recursion", r, ["self_test::recursion"]);
      return r;
    });
    refresh();
  };

  const reset = () => {
    resetAll();
    refresh();
  };

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
          ) : tone === "warn" ? (
            <Repeat className="h-4 w-4 text-yellow-600" />
          ) : (
            <ShieldCheck className="h-4 w-4 text-primary" />
          )}
          Loop Prevention Engine — L1 (identical) · L2 (stagnation) · L3 (recursion)
        </CardTitle>
        <div className="flex items-center gap-2">
          <Badge
            variant={tone === "good" ? "secondary" : tone === "warn" ? "outline" : "destructive"}
            className="text-[10px] uppercase"
          >
            {report.loop_status}
          </Badge>
          <Button size="sm" variant="outline" className="h-7" onClick={refresh}>
            <RefreshCw className="h-3 w-3 mr-1" /> Refresh
          </Button>
          <Button size="sm" variant="outline" className="h-7" onClick={runSelfTest}>
            <Play className="h-3 w-3 mr-1" /> Self-test
          </Button>
          <Button size="sm" variant="outline" className="h-7" onClick={reset}>
            <RotateCcw className="h-3 w-3 mr-1" /> Reset
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Top-line counts */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          <Cell label="Tracked modules" value={report.modules.length} tone="muted" />
          <Cell
            label="Blocked cycles"
            value={report.blocked_cycles}
            tone={report.blocked_cycles > 0 ? "bad" : "good"}
          />
          <Cell
            label="Halted modules"
            value={report.modules.filter((m) => m.halted).length}
            tone={report.modules.some((m) => m.halted) ? "bad" : "good"}
          />
          <Cell label="Recent events" value={report.recent_events.length} tone="muted" />
        </div>

        {/* Modules */}
        <details className="rounded-md border border-border" open={report.modules.length > 0}>
          <summary className="px-2 py-1.5 border-b border-border bg-muted/30 text-[11px] font-semibold cursor-pointer">
            Modules ({report.modules.length})
          </summary>
          {report.modules.length === 0 ? (
            <div className="p-2 text-xs text-muted-foreground italic">
              No cycles recorded yet. Run a scan or click "Self-test" to populate.
            </div>
          ) : (
            <ul className="divide-y divide-border text-[11px] font-mono max-h-56 overflow-y-auto">
              {report.modules.map((m) => (
                <li key={m.module} className="px-2 py-1">
                  <div className="flex flex-wrap gap-2 items-center">
                    <Badge
                      variant={m.status === "SAFE" ? "secondary" : "destructive"}
                      className="text-[9px]"
                    >
                      {m.status}
                    </Badge>
                    <span className="text-foreground font-semibold">{m.module}</span>
                    <span className="text-muted-foreground">cycles: {m.total_cycles}</span>
                    <span className="text-muted-foreground">blocked: {m.blocked_cycles}</span>
                    <span className="text-muted-foreground">streak: {m.identical_streak}</span>
                    {m.halted && (
                      <Badge variant="destructive" className="text-[9px] ml-auto">HALTED</Badge>
                    )}
                  </div>
                  {m.last_blocked_reason && (
                    <div className="mt-0.5 ml-2 text-[10px] text-amber-600 dark:text-amber-400">
                      {m.last_blocked_reason}
                    </div>
                  )}
                  {m.last_output_hash && (
                    <div className="mt-0.5 ml-2 text-[10px] text-muted-foreground break-all">
                      last_hash: {m.last_output_hash}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </details>

        {/* Recent events */}
        <details className="rounded-md border border-border">
          <summary className="px-2 py-1.5 border-b border-border bg-muted/30 text-[11px] font-semibold cursor-pointer">
            Recent events ({report.recent_events.length})
          </summary>
          {report.recent_events.length === 0 ? (
            <div className="p-2 text-xs text-muted-foreground italic">No events.</div>
          ) : (
            <ul className="divide-y divide-border text-[11px] font-mono max-h-56 overflow-y-auto">
              {report.recent_events.map((ev, i) => (
                <li key={i} className="px-2 py-1 flex flex-wrap gap-2">
                  <Badge
                    variant={ev.accepted ? "secondary" : "destructive"}
                    className="text-[9px]"
                  >
                    {ev.status}
                  </Badge>
                  <span className="text-foreground">{ev.module}</span>
                  <span className="text-muted-foreground">#{ev.cycle_index}</span>
                  <span className="text-muted-foreground break-all">{ev.output_hash}</span>
                  {ev.reason && (
                    <span className="text-amber-600 dark:text-amber-400 ml-auto">{ev.reason}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </details>

        <p className="text-[10px] text-muted-foreground italic pt-1 border-t">
          L1 blocks identical outputs. L2 halts after {2}+ identical streak. L3 rejects modules
          that re-enter their own call stack. Generated: {report.generated_at}
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
