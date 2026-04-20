/**
 * ABSOLUTE CONTROL PANEL
 *
 * Single visualisation of:
 *   - role registry (who is AUTHORITY vs READ_ONLY_REPORTER vs DATA_PRODUCER)
 *   - the unified STOP/CONTINUE decision
 *   - which reporter signals were honored vs ignored
 *
 * Read-only — does not run the controller. Pure inspection of the absolute
 * control layer's deterministic decision.
 */
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  computeAbsoluteDecision,
  SYSTEM_ROLE_REGISTRY,
  type AbsoluteControlReport,
  type SystemRole,
} from "@/core/scanner/absoluteControlLayer";
import { Crown, RefreshCw, ShieldCheck, ShieldOff, Database, OctagonAlert, CheckCircle2 } from "lucide-react";

const ROLE_TONE: Record<SystemRole, string> = {
  AUTHORITY: "border-primary/50 bg-primary/10 text-primary",
  READ_ONLY_REPORTER: "border-amber-500/40 bg-amber-500/5 text-amber-700 dark:text-amber-400",
  DATA_PRODUCER: "border-border bg-muted/30 text-muted-foreground",
};

const ROLE_ICON: Record<SystemRole, React.ReactNode> = {
  AUTHORITY: <Crown className="h-3 w-3" />,
  READ_ONLY_REPORTER: <ShieldOff className="h-3 w-3" />,
  DATA_PRODUCER: <Database className="h-3 w-3" />,
};

export const AbsoluteControlPanel = () => {
  const [tick, setTick] = useState(0);
  const report: AbsoluteControlReport = useMemo(() => computeAbsoluteDecision(), [tick]);

  const isStop = report.decision === "STOP";

  return (
    <Card className={isStop ? "border-destructive/60 bg-destructive/5" : "border-primary/40"}>
      <CardHeader className="pb-2 flex flex-row items-center justify-between flex-wrap gap-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Crown className="h-4 w-4 text-primary" />
          Absolute Control Layer — single decision authority
        </CardTitle>
        <div className="flex items-center gap-2">
          <Badge variant={isStop ? "destructive" : "secondary"} className="text-[10px] uppercase font-mono">
            decision: {report.decision}
          </Badge>
          <Button size="sm" variant="outline" className="h-7" onClick={() => setTick((t) => t + 1)}>
            <RefreshCw className="h-3 w-3 mr-1" /> Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Unified decision banner */}
        <div
          className={`rounded border p-2 text-xs flex items-start gap-2 ${
            isStop ? "border-destructive/50 bg-destructive/10 text-destructive" : "border-primary/40 bg-primary/5 text-primary"
          }`}
        >
          {isStop ? (
            <OctagonAlert className="h-4 w-4 shrink-0 mt-0.5" />
          ) : (
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
          )}
          <div>
            <div className="font-bold">{report.decision}</div>
            <div className="text-[11px] mt-0.5 break-all">{report.reason}</div>
            <div className="text-[10px] mt-1 opacity-80 font-mono">
              basis: {report.decision_basis} · critical: {report.total_critical}/{report.critical_threshold}
              {report.conflict_fallback_triggered && " · CONFLICT FALLBACK ENGAGED"}
            </div>
          </div>
        </div>

        {/* Role registry */}
        <div className="rounded-md border border-border">
          <div className="px-2 py-1.5 border-b border-border bg-muted/30 text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
            <ShieldCheck className="h-3 w-3" />
            System role registry — only AUTHORITY may block ({SYSTEM_ROLE_REGISTRY.length} modules)
          </div>
          <ul className="divide-y divide-border text-[11px] font-mono">
            {SYSTEM_ROLE_REGISTRY.map((s) => (
              <li key={s.module} className="px-2 py-1.5 flex flex-wrap items-center gap-2">
                <Badge className={`text-[9px] border ${ROLE_TONE[s.role]}`} variant="outline">
                  <span className="flex items-center gap-1">
                    {ROLE_ICON[s.role]}
                    {s.role}
                  </span>
                </Badge>
                <span className="font-semibold text-foreground">{s.module}</span>
                <span className="text-muted-foreground text-[10px]">— {s.description}</span>
                {s.can_block_execution && (
                  <Badge variant="default" className="text-[9px] ml-auto">
                    can_block=true
                  </Badge>
                )}
              </li>
            ))}
          </ul>
        </div>

        {/* Honored reporter signals */}
        <div className="rounded-md border border-border">
          <div className="px-2 py-1.5 border-b border-border bg-muted/30 text-[11px] font-semibold text-muted-foreground">
            Reporter signals received ({report.reporter_signals.length})
          </div>
          {report.reporter_signals.length === 0 ? (
            <div className="p-2 text-xs text-muted-foreground italic">No signals.</div>
          ) : (
            <ul className="divide-y divide-border text-[11px] font-mono">
              {report.reporter_signals.map((s, i) => (
                <li key={`${s.module}-${i}`} className="px-2 py-1 flex flex-wrap items-center gap-2">
                  <Badge
                    variant={s.severity === "critical" ? "destructive" : "secondary"}
                    className="text-[9px]"
                  >
                    {s.severity}
                  </Badge>
                  <span className="font-semibold text-foreground">{s.module}</span>
                  <span className="text-muted-foreground">count: {s.count}</span>
                  <span className="text-muted-foreground">— {s.message}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Ignored signals */}
        {report.ignored_signals.length > 0 && (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/5">
            <div className="px-2 py-1.5 border-b border-amber-500/30 text-[11px] font-semibold text-amber-700 dark:text-amber-400">
              Ignored signals ({report.ignored_signals.length}) — disregarded by absolute authority
            </div>
            <ul className="divide-y divide-amber-500/20 text-[11px] font-mono">
              {report.ignored_signals.map((s, i) => (
                <li key={i} className="px-2 py-1 flex flex-wrap gap-2">
                  <span className="font-semibold text-foreground">{s.module}</span>
                  <span className="text-muted-foreground">— {s.ignored_because}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="text-[10px] text-muted-foreground italic pt-1 border-t">
          Generated {report.generated_at} — only executionController may STOP. All other engines
          are read-only. On disagreement → fall back to file-system truth.
        </p>
      </CardContent>
    </Card>
  );
};
