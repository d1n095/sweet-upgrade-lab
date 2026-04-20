/**
 * MINIMAL MODE PANEL
 *
 * Visualises which subsystems are active vs disabled, the trigger reason,
 * the current instability score, and lets the operator toggle MINIMAL MODE.
 */
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Minimize2, Power, Activity, ShieldCheck, ShieldOff } from "lucide-react";
import { minimalMode, type MinimalModeStatus } from "@/core/scanner/minimalMode";
import { toast } from "sonner";

export function MinimalModePanel() {
  const [snap, setSnap] = useState<MinimalModeStatus>(() => minimalMode.snapshot());

  useEffect(() => {
    const tick = () => setSnap(minimalMode.snapshot());
    const unsub = minimalMode.subscribe(tick);
    const id = window.setInterval(tick, 4000);
    return () => {
      unsub();
      window.clearInterval(id);
    };
  }, []);

  const handleToggle = (next: boolean) => {
    if (next) {
      minimalMode.enable("manual", "operator action from UI");
      toast.warning("MINIMAL MODE aktiverat — sekundära system pausade");
    } else {
      minimalMode.disable("operator action from UI");
      toast.success("MINIMAL MODE avstängt — alla system aktiva");
    }
  };

  const scorePct = Math.min(100, Math.round((snap.instability_score / snap.threshold) * 100));

  return (
    <Card className={snap.enabled ? "border-amber-500/50" : ""}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Minimize2 className="h-4 w-4" />
            Minimal Mode
            <Badge variant="outline" className="ml-1 font-mono text-[10px]">
              FLAG · OBSERVER
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-3">
            <Badge
              variant={snap.enabled ? "default" : "secondary"}
              className={`gap-1 ${snap.enabled ? "bg-amber-500 text-amber-950 hover:bg-amber-500/90" : ""}`}
            >
              {snap.enabled ? (
                <>
                  <ShieldOff className="h-3 w-3" />
                  ACTIVE
                </>
              ) : (
                <>
                  <ShieldCheck className="h-3 w-3" />
                  STANDBY
                </>
              )}
            </Badge>
            <Switch checked={snap.enabled} onCheckedChange={handleToggle} aria-label="Toggle minimal mode" />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {snap.enabled && snap.detail && (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs">
            <div className="flex items-center gap-1.5 font-medium">
              <Power className="h-3.5 w-3.5" />
              Trigger: <span className="font-mono">{snap.reason}</span>
              {snap.since && (
                <span className="ml-auto text-muted-foreground">
                  since {new Date(snap.since).toLocaleTimeString()}
                </span>
              )}
            </div>
            <div className="mt-1 text-muted-foreground break-words">{snap.detail}</div>
          </div>
        )}

        <div className="rounded-md border bg-muted/30 p-3 text-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Activity className="h-3 w-3" />
              Instability score
            </span>
            <span className="font-mono font-medium">
              {snap.instability_score} / {snap.threshold}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full transition-all ${snap.enabled ? "bg-amber-500" : "bg-primary"}`}
              style={{ width: `${scorePct}%` }}
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            Minimal Mode auto-aktiveras när poängen når tröskelvärdet.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ModuleList
            title="Active modules"
            tone="active"
            modules={snap.active_modules}
            note="Always running — essential for execution."
          />
          <ModuleList
            title="Disabled in Minimal Mode"
            tone={snap.enabled ? "disabled" : "standby"}
            modules={snap.disabled_modules}
            note={
              snap.enabled
                ? "Currently bypassed — engines short-circuit on entry."
                : "Will be bypassed if Minimal Mode activates."
            }
          />
        </div>

        <div className="flex items-center gap-2 pt-1">
          {snap.enabled ? (
            <Button size="sm" variant="outline" onClick={() => handleToggle(false)}>
              Exit Minimal Mode
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleToggle(true)}
              className="border-amber-500/50 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10"
            >
              Force Minimal Mode
            </Button>
          )}
        </div>

        <p className="text-[11px] text-muted-foreground">
          Minimal Mode disables auto-healing, watchdog, reality check, and loop engine.
          The ExecutionController, truth layer, rule engine, and dependency engine remain active.
          The mode is observed by each subsystem and auto-triggered by the controller after DEPENDENCIES.
        </p>
      </CardContent>
    </Card>
  );
}

function ModuleList({
  title,
  modules,
  tone,
  note,
}: {
  title: string;
  modules: string[];
  tone: "active" | "disabled" | "standby";
  note: string;
}) {
  const dotCls =
    tone === "active"
      ? "bg-primary"
      : tone === "disabled"
      ? "bg-amber-500"
      : "bg-muted-foreground/40";
  return (
    <div className="rounded-md border bg-card p-3">
      <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </div>
      <ul className="space-y-1">
        {modules.map((m) => (
          <li key={m} className="flex items-center gap-2 text-xs">
            <span className={`h-1.5 w-1.5 rounded-full ${dotCls}`} aria-hidden />
            <span className="font-mono">{m}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[11px] text-muted-foreground">{note}</p>
    </div>
  );
}
