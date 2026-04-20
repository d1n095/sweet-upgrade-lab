/**
 * HARD STATE LOCK PANEL
 *
 * Read-only view of the lock status, the locked state snapshot, and any
 * unauthorized write attempts.
 */
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Lock, ShieldAlert, ShieldCheck, RotateCcw, Trash2 } from "lucide-react";
import { hardStateLock, type LockSnapshot } from "@/core/scanner/hardStateLock";
import { toast } from "sonner";

export function HardStateLockPanel() {
  const [snap, setSnap] = useState<LockSnapshot>(() => hardStateLock.snapshot());

  useEffect(() => {
    const tick = () => setSnap(hardStateLock.snapshot());
    const unsub = hardStateLock.subscribe(tick);
    const id = window.setInterval(tick, 4000);
    return () => {
      unsub();
      window.clearInterval(id);
    };
  }, []);

  const blocked = snap.status === "BLOCKED";

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Lock className="h-4 w-4" />
            Hard State Lock
            <Badge variant="outline" className="ml-1 font-mono text-[10px]">
              READ-ONLY REPORTER
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            {blocked ? (
              <Badge variant="destructive" className="gap-1">
                <ShieldAlert className="h-3 w-3" />
                BLOCKED
              </Badge>
            ) : (
              <Badge variant="secondary" className="gap-1">
                <ShieldCheck className="h-3 w-3" />
                OPEN
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="rounded-md border bg-muted/30 p-3 text-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Authority</span>
            <span className="font-mono font-medium">{snap.authority_module}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Authorized writes</span>
            <span className="font-mono font-medium">{snap.total_authorized_writes}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Last write</span>
            <span className="font-mono">
              {snap.last_authorized_write_at
                ? new Date(snap.last_authorized_write_at).toLocaleTimeString()
                : "—"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Unauthorized attempts</span>
            <span className={`font-mono font-medium ${blocked ? "text-destructive" : ""}`}>
              {snap.total_unauthorized_attempts}
            </span>
          </div>
        </div>

        <div>
          <div className="text-xs font-medium text-muted-foreground mb-2">
            Locked state ({Object.keys(snap.locked_state).length} keys)
          </div>
          {Object.keys(snap.locked_state).length === 0 ? (
            <div className="rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground">
              No locked state yet — run the controller pipeline.
            </div>
          ) : (
            <ScrollArea className="max-h-56 rounded-md border">
              <ul className="divide-y">
                {Object.entries(snap.locked_state).map(([key, rec]) => (
                  <li key={key} className="p-2 text-xs">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-[10px] h-4 font-mono">
                        {key}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] h-4">
                        v{rec?.version}
                      </Badge>
                      <span className="font-mono text-[10px] text-muted-foreground truncate">
                        by {rec?.source_module}
                      </span>
                    </div>
                    <pre className="mt-1 whitespace-pre-wrap break-words font-mono text-[10px] text-muted-foreground">
                      {previewValue(rec?.value)}
                    </pre>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-medium text-muted-foreground">
              Unauthorized attempts ({snap.unauthorized_attempts.length})
            </div>
            <div className="flex items-center gap-1">
              {blocked && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 text-[11px]"
                  onClick={() => {
                    hardStateLock.reset();
                    toast.success("Lock återställt");
                  }}
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  Reset
                </Button>
              )}
              {snap.unauthorized_attempts.length > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-[11px]"
                  onClick={() => {
                    hardStateLock.clearAttempts();
                    toast.info("Logg rensad");
                  }}
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Clear log
                </Button>
              )}
            </div>
          </div>
          {snap.unauthorized_attempts.length === 0 ? (
            <div className="rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground">
              Inga otillåtna skrivförsök loggade.
            </div>
          ) : (
            <ScrollArea className="max-h-56 rounded-md border">
              <ul className="divide-y">
                {snap.unauthorized_attempts.map((a, i) => (
                  <li key={i} className="p-2 text-xs">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="destructive" className="text-[10px] h-4">
                        DENIED
                      </Badge>
                      <Badge variant="outline" className="text-[10px] h-4 font-mono">
                        {a.state_key}
                      </Badge>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {new Date(a.attempted_at).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="mt-1">
                      <span className="text-muted-foreground">writer: </span>
                      <span className="font-mono">{a.writer_module}</span>
                    </div>
                    <div className="mt-0.5 text-muted-foreground">{a.reason}</div>
                    <pre className="mt-1 whitespace-pre-wrap break-words font-mono text-[10px] text-muted-foreground">
                      {a.rejected_value_preview}
                    </pre>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          )}
        </div>

        <p className="text-[11px] text-muted-foreground">
          Only the AUTHORITY module ({snap.authority_module}) may write to system state.
          All other writers are denied and logged. The lock returns control to the
          ExecutionController; it does not stop other systems on its own.
        </p>
      </CardContent>
    </Card>
  );
}

function previewValue(v: unknown): string {
  try {
    const s = typeof v === "string" ? v : JSON.stringify(v, null, 2);
    return s == null ? String(v) : s.length > 240 ? s.slice(0, 237) + "…" : s;
  } catch {
    return String(v);
  }
}
