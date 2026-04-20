/**
 * EXECUTION GOVERNOR PANEL
 *
 * Live read-only view of the deterministic execution governor: active module,
 * locked modules, owned state-keys, conflict log, and truth-layer gate state.
 * Provides a manual "Resolve halt" action when conflicts force a stop.
 */

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { executionGovernor, type GovernorSnapshot } from "@/core/scanner/executionGovernor";
import { Lock, Activity, ShieldAlert, Unlock } from "lucide-react";

export const ExecutionGovernorPanel = () => {
  const [snap, setSnap] = useState<GovernorSnapshot>(() => executionGovernor.snapshot());

  useEffect(() => {
    const refresh = () => setSnap(executionGovernor.snapshot());
    const unsub = executionGovernor.subscribe(refresh);
    const t = setInterval(refresh, 2000); // also poll for time-display updates
    return () => {
      unsub();
      clearInterval(t);
    };
  }, []);

  const phaseTone =
    snap.phase === "halted"
      ? "destructive"
      : snap.phase === "running"
      ? "default"
      : snap.phase === "awaiting_verification"
      ? "secondary"
      : "outline";

  return (
    <Card className={snap.halted_reason ? "border-destructive/60 bg-destructive/5" : "border-border"}>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          Execution Governor — Single-Flight Scheduler
        </CardTitle>
        <div className="flex items-center gap-2">
          <Badge variant={phaseTone as any} className="text-[10px] uppercase">
            phase: {snap.phase}
          </Badge>
          {snap.halted_reason && (
            <Button
              size="sm"
              variant="outline"
              className="h-7"
              onClick={() => executionGovernor.resolveHalt("operator unblocked governor from UI")}
            >
              <Unlock className="h-3 w-3 mr-1" /> Resolve Halt
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Top-line state */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          <Cell label="Active module" value={snap.active_module || "—"} tone={snap.active_module ? "good" : "muted"} />
          <Cell label="Active run id" value={snap.active_run_id ? snap.active_run_id.slice(0, 24) + "…" : "—"} tone="muted" />
          <Cell label="Locked modules" value={snap.locked_modules.length} tone={snap.locked_modules.length > 0 ? "warn" : "muted"} />
          <Cell
            label="Truth-layer gate"
            value={snap.truth_layer_verified ? "OPEN" : "CLOSED"}
            tone={snap.truth_layer_verified ? "good" : "warn"}
          />
        </div>

        {/* Halt banner */}
        {snap.halted_reason && (
          <div className="rounded border border-destructive/50 bg-destructive/10 p-2 text-xs text-destructive flex items-start gap-2">
            <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold">EXECUTION HALTED</div>
              <div className="text-[11px] mt-0.5">{snap.halted_reason}</div>
            </div>
          </div>
        )}

        {/* Modules table */}
        <div className="rounded-md border border-border">
          <div className="px-2 py-1.5 border-b border-border bg-muted/30 text-[11px] font-semibold text-muted-foreground">
            Registered modules ({snap.modules.length})
          </div>
          {snap.modules.length === 0 ? (
            <div className="p-3 text-xs text-muted-foreground italic">
              No modules have run yet. The first acquire() will register them.
            </div>
          ) : (
            <ul className="divide-y divide-border text-[11px] font-mono">
              {snap.modules.map((m) => (
                <li key={m.id} className="px-2 py-1 flex flex-wrap items-center gap-2">
                  <Badge variant={m.verified ? "secondary" : "destructive"} className="text-[9px]">
                    {m.verified ? "VERIFIED" : "LOCKED"}
                  </Badge>
                  <span className="font-semibold text-foreground">{m.id}</span>
                  <span className="text-muted-foreground">runs: {m.runs}</span>
                  {m.last_run_at && (
                    <span className="text-muted-foreground">
                      last_run: {new Date(m.last_run_at).toLocaleTimeString("sv-SE")}
                    </span>
                  )}
                  {m.last_verified_at && (
                    <span className="text-muted-foreground">
                      verified: {new Date(m.last_verified_at).toLocaleTimeString("sv-SE")}
                    </span>
                  )}
                  {m.owned_keys.length > 0 && (
                    <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      <Lock className="h-3 w-3" />
                      keys: {m.owned_keys.join(", ")}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Locked keys */}
        {snap.locked_keys.length > 0 && (
          <details className="rounded-md border border-border" open>
            <summary className="px-2 py-1.5 border-b border-border bg-muted/30 text-[11px] font-semibold cursor-pointer">
              Locked state-keys ({snap.locked_keys.length})
            </summary>
            <ul className="divide-y divide-border text-[11px] font-mono">
              {snap.locked_keys.map((k) => (
                <li key={k.key} className="px-2 py-1 flex justify-between gap-2">
                  <span className="text-foreground">{k.key}</span>
                  <span className="text-muted-foreground">owned by {k.owner}</span>
                </li>
              ))}
            </ul>
          </details>
        )}

        {/* Conflict log */}
        <details className="rounded-md border border-border" open={snap.conflict_log.length > 0}>
          <summary className="px-2 py-1.5 border-b border-border bg-muted/30 text-[11px] font-semibold cursor-pointer">
            Conflict log ({snap.conflict_log.length})
          </summary>
          {snap.conflict_log.length === 0 ? (
            <div className="p-2 text-xs text-muted-foreground italic">No conflicts recorded.</div>
          ) : (
            <ul className="divide-y divide-border text-[11px] font-mono max-h-48 overflow-y-auto">
              {snap.conflict_log.map((c, i) => (
                <li key={i} className="px-2 py-1 flex flex-wrap gap-2">
                  <span className="text-muted-foreground">{new Date(c.at).toLocaleTimeString("sv-SE")}</span>
                  <Badge variant="destructive" className="text-[9px]">CONFLICT</Badge>
                  <span className="text-foreground">{c.module}</span>
                  <span className="text-muted-foreground">vs</span>
                  <span className="text-foreground">{c.conflictingWith}</span>
                  <span className="text-amber-600 dark:text-amber-400">key: {c.stateKey}</span>
                </li>
              ))}
            </ul>
          )}
        </details>

        <p className="text-[10px] text-muted-foreground italic pt-1 border-t">
          Singleton governor enforces R1 (single active), R2 (no re-entry until verified),
          R3 (state locking), R4 (conflict halt). Generated: {snap.generated_at}
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
      <div className="text-xs font-mono font-semibold text-foreground break-all">{value}</div>
    </div>
  );
};
