/**
 * SAFE MODE SHELL
 *
 * Static, dependency-free UI rendered when the dashboard is in SAFE MODE.
 * It intentionally imports NO heavy engines (rule evolution, pattern memory,
 * architecture scoring). Only reads snapshots from the decoupled stores.
 *
 * Purpose: guarantee the Command Center renders *something* even when the
 * backend / scanning layer is unstable.
 */
import { AlertTriangle, ShieldAlert, PowerOff, Power } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useSystemStateStore } from "@/stores/systemStateStore";
import { useSafeModeStore } from "@/stores/safeModeStore";
import { MINIMAL_MODE_DISABLED_MODULES, MINIMAL_MODE_ACTIVE_MODULES } from "@/core/scanner/minimalMode";
import { exitSafeMode } from "@/lib/safeModeEvaluator";

interface Props {
  reason: string;
}

export function SafeModeShell({ reason }: Props) {
  const slots = useSystemStateStore((s) => s.slots);
  const safeEvents = useSafeModeStore((s) => s.events);
  const activatedAt = useSafeModeStore((s) => s.activatedAt);

  const slotEntries = Object.entries(slots);
  const errorCount = slotEntries.filter(([, s]) => s.health === "error").length;
  const okCount = slotEntries.filter(([, s]) => s.health === "ok").length;
  const emptyCount = slotEntries.filter(([, s]) => s.health === "empty").length;

  return (
    <div className="space-y-4">
      {/* Banner */}
      <Card className="border-destructive/40 bg-destructive/5">
        <CardContent className="py-4 flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-destructive mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold">Safe Mode aktivt</p>
              <Badge variant="destructive" className="text-[10px]">MINIMAL</Badge>
              <Badge variant="outline" className="text-[10px] font-mono">{reason}</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Dashboarden körs i minimalt läge. Tunga motorer (Rule Evolution, Pattern Memory,
              Architecture Scoring, Reality Check) är pausade för att förhindra total krasch när
              backend är instabil.
            </p>
            {activatedAt && (
              <p className="text-[10px] text-muted-foreground mt-1 font-mono">
                aktiverat: {new Date(activatedAt).toLocaleString("sv-SE")}
              </p>
            )}
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => exitSafeMode()}
            className="shrink-0"
          >
            <Power className="w-3 h-3 mr-1" />
            Återuppta full drift
          </Button>
        </CardContent>
      </Card>

      {/* Static status grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Systemhälsa
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">OK</span>
              <span className="font-mono">{okCount}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Fel</span>
              <span className="font-mono text-destructive">{errorCount}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Tomma</span>
              <span className="font-mono">{emptyCount}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <PowerOff className="w-3 h-3" />
              Pausade motorer
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-0.5">
              {MINIMAL_MODE_DISABLED_MODULES.map((m) => (
                <li key={m} className="text-[11px] font-mono text-muted-foreground">
                  · {m}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Power className="w-3 h-3" />
              Aktiva kärnmoduler
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-0.5">
              {MINIMAL_MODE_ACTIVE_MODULES.map((m) => (
                <li key={m} className="text-[11px] font-mono">
                  · {m}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Slot snapshot (read-only) */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Modulstatus (read-only)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {slotEntries.map(([key, slot]) => {
            const color =
              slot.health === "ok"
                ? "bg-primary/15 text-primary"
                : slot.health === "error"
                  ? "bg-destructive/15 text-destructive"
                  : slot.health === "degraded"
                    ? "bg-orange-500/15 text-orange-600"
                    : "bg-muted text-muted-foreground";
            return (
              <div
                key={key}
                className="flex items-center justify-between text-xs border border-border rounded px-2 py-1"
              >
                <span className="font-mono truncate">{key}</span>
                <div className="flex items-center gap-2 shrink-0">
                  {slot.error && (
                    <span className="text-[10px] text-destructive truncate max-w-[240px]">
                      {slot.error}
                    </span>
                  )}
                  <Badge variant="outline" className={`text-[10px] ${color}`}>
                    {slot.health}
                  </Badge>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Recent safe-mode events */}
      {safeEvents.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-orange-500" />
              Safe Mode-händelser
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {safeEvents.slice(-5).reverse().map((e, i) => (
              <div key={i} className="text-[11px] border-l-2 border-orange-500/40 pl-2">
                <p className="font-mono">{e.reason}</p>
                <p className="text-muted-foreground">{e.detail}</p>
                <p className="text-[10px] text-muted-foreground">
                  {new Date(e.timestamp).toLocaleString("sv-SE")}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default SafeModeShell;
