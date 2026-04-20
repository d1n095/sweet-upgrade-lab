/**
 * ROLLBACK ENGINE PANEL
 *
 * Shows the active stable version, the rollback event log, and lets the
 * operator perform a manual rollback to any prior immutable version.
 */
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Undo2, RotateCcw, AlertTriangle, ArrowRight, ShieldCheck } from "lucide-react";
import {
  rollbackEngine,
  type RollbackEngineState,
  type RollbackEvent,
  SCORE_DROP_THRESHOLD,
  VIOLATION_INCREASE_THRESHOLD,
} from "@/core/scanner/rollbackEngine";
import {
  versionedArchitectureStore,
  type VersionedStoreState,
} from "@/core/scanner/versionedArchitectureStore";

export function RollbackEnginePanel() {
  const [state, setState] = useState<RollbackEngineState>(() => rollbackEngine.getState());
  const [versions, setVersions] = useState<VersionedStoreState>(() =>
    versionedArchitectureStore.getState()
  );
  const [targetId, setTargetId] = useState<string>("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    const tickRb = () => setState(rollbackEngine.getState());
    const tickV = () => setVersions(versionedArchitectureStore.getState());
    const off1 = rollbackEngine.subscribe(tickRb);
    const off2 = versionedArchitectureStore.subscribe(tickV);
    return () => {
      off1();
      off2();
    };
  }, []);

  const activeVersion = useMemo(
    () => versions.versions.find((v) => v.version_id === state.active_version_id) ?? null,
    [versions, state.active_version_id]
  );

  const rollbackOptions = useMemo(
    () => versions.versions.filter((v) => v.version_id !== state.active_version_id),
    [versions, state.active_version_id]
  );

  const doManualRollback = () => {
    if (!targetId) return;
    rollbackEngine.rollbackTo(targetId, reason.trim());
    setTargetId("");
    setReason("");
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Undo2 className="h-4 w-4" />
            Rollback Engine
            <Badge variant="outline" className="ml-1 font-mono text-[10px]">
              LAST-STABLE RESTORE
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-[10px]">
              rollbacks: {state.total_rollbacks}
            </Badge>
            {activeVersion && (
              <Badge variant="outline" className="font-mono text-[10px]">
                active {activeVersion.version_id}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Active baseline */}
        <div className="rounded-md border bg-muted/20 p-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-foreground" />
              <span className="font-medium">Active stable baseline</span>
            </div>
            {activeVersion ? (
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <span className="font-mono text-foreground">{activeVersion.version_id}</span>
                <span>· score {activeVersion.architecture_score}</span>
                <span>· violations {activeVersion.architecture_violations}</span>
                <span>· {new Date(activeVersion.created_at).toLocaleString()}</span>
              </div>
            ) : (
              <span className="text-[11px] text-muted-foreground">no versions yet</span>
            )}
          </div>
          <div className="mt-2 grid grid-cols-1 gap-1 text-[11px] text-muted-foreground sm:grid-cols-2">
            <div>
              Auto-rollback if <span className="font-mono">score drop ≥ {SCORE_DROP_THRESHOLD}</span> vs baseline
            </div>
            <div>
              Auto-rollback if{" "}
              <span className="font-mono">
                violations rise ≥ {VIOLATION_INCREASE_THRESHOLD}
              </span>{" "}
              vs baseline
            </div>
            <div>Auto-rollback on any pipeline FAILED status</div>
            <div>Versions remain immutable — rollback only changes the active pointer</div>
          </div>
        </div>

        {/* Manual rollback */}
        <div className="rounded-md border p-3">
          <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            <RotateCcw className="h-3 w-3" />
            Manual rollback
          </div>
          {rollbackOptions.length === 0 ? (
            <div className="text-xs text-muted-foreground">
              No alternative versions to roll back to.
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-[180px_1fr_auto]">
              <Select value={targetId} onValueChange={setTargetId}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Restore to…" />
                </SelectTrigger>
                <SelectContent>
                  {rollbackOptions.map((v) => (
                    <SelectItem key={v.version_id} value={v.version_id} className="text-xs">
                      {v.version_id} · score {v.architecture_score} · {v.architecture_status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason (optional)"
                className="h-8 text-xs"
              />
              <Button size="sm" onClick={doManualRollback} disabled={!targetId} className="h-8">
                <Undo2 className="mr-1 h-3 w-3" />
                Rollback
              </Button>
            </div>
          )}
        </div>

        {/* Event log */}
        <div className="rounded-md border bg-card">
          <div className="border-b px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Rollback log ({state.events.length})
          </div>
          {state.events.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-muted-foreground">
              No rollback events yet — system is stable.
            </div>
          ) : (
            <ul className="max-h-72 divide-y overflow-auto">
              {state.events.map((e) => (
                <RollbackRow key={e.id} event={e} />
              ))}
            </ul>
          )}
        </div>

        <p className="text-[11px] text-muted-foreground">
          The Rollback Engine is read-only with respect to the versioned store: it never deletes or
          rewrites a version. It only moves the active stable pointer back to a known-good
          immutable version when a trigger fires.
        </p>
      </CardContent>
    </Card>
  );
}

function RollbackRow({ event }: { event: RollbackEvent }) {
  const tone =
    event.trigger === "PIPELINE_FAILURE" || event.trigger === "RULE_VIOLATIONS_INCREASE"
      ? "destructive"
      : event.trigger === "ARCHITECTURE_SCORE_DROP"
        ? "outline"
        : ("secondary" as const);
  return (
    <li className="grid grid-cols-[1fr_auto] gap-x-3 px-3 py-2 text-xs">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={tone} className="text-[10px]">
            {event.trigger}
          </Badge>
          <span className="font-mono text-[11px]">{event.id}</span>
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            {event.rolled_back_from_version_id && (
              <>
                <span className="font-mono">{event.rolled_back_from_version_id}</span>
                <ArrowRight className="h-3 w-3" />
              </>
            )}
            {event.rollback_to_version ? (
              <span className="font-mono text-foreground">{event.rollback_to_version}</span>
            ) : (
              <span className="inline-flex items-center gap-1 text-destructive">
                <AlertTriangle className="h-3 w-3" />
                no target
              </span>
            )}
          </div>
        </div>
        <div className="text-[11px] text-muted-foreground">{event.reason}</div>
        {(event.metrics.score_before != null || event.metrics.violations_before != null) && (
          <div className="text-[11px] text-muted-foreground">
            score {event.metrics.score_before ?? "—"} → {event.metrics.score_after ?? "—"} ·
            violations {event.metrics.violations_before ?? "—"} →{" "}
            {event.metrics.violations_after ?? "—"}
          </div>
        )}
      </div>
      <div className="text-[10px] text-muted-foreground">
        {new Date(event.at).toLocaleTimeString()}
      </div>
    </li>
  );
}
