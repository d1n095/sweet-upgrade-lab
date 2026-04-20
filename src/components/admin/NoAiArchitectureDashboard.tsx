/**
 * NO-AI ARCHITECTURE DASHBOARD
 *
 * Renders the three deterministic engines: dependency heatmap, self-healing
 * planner, and architecture watchdog. Every number on screen is recomputed
 * live from the file system — no caching, no AI, no synthetic values.
 */

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { runDependencyHeatmap } from "@/core/architecture/dependencyHeatmap";
import { runSelfHealing } from "@/core/architecture/selfHealingEngine";
import { runArchitectureWatchdog } from "@/core/architecture/architectureWatchdog";
import { Activity, Wrench, ShieldCheck, RefreshCw } from "lucide-react";

export const NoAiArchitectureDashboard = () => {
  const [tick, setTick] = useState(0);

  const heatmap = useMemo(() => runDependencyHeatmap(), [tick]);
  const heal = useMemo(() => runSelfHealing(), [tick]);
  const watchdog = useMemo(() => runArchitectureWatchdog(), [tick]);

  // Pure-math architecture health (no AI):
  // Average of (100 - cycles*5 - isolated_ratio*100) and watchdog compliance.
  const isolatedRatio = heatmap.metrics.total_nodes > 0
    ? heatmap.metrics.isolated / heatmap.metrics.total_nodes
    : 0;
  const depHealth = Math.max(0, Math.min(100, 100 - heatmap.metrics.cycles * 5 - Math.round(isolatedRatio * 100)));
  const archHealth = Math.round((depHealth + watchdog.compliance_score) / 2);

  return (
    <div className="space-y-3">
      <Card className="border-primary/30">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            No-AI Architecture Layer — Rule-Based Only
          </CardTitle>
          <Button size="sm" variant="outline" onClick={() => setTick((t) => t + 1)} className="h-7">
            <RefreshCw className="h-3 w-3 mr-1" /> Recompute
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Top-line deterministic score */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Metric label="System State" value={watchdog.system_state} tone={watchdog.system_state === "VALID" ? "good" : "bad"} />
            <Metric label="Compliance" value={`${watchdog.compliance_score}%`} tone={watchdog.compliance_score >= 80 ? "good" : "warn"} />
            <Metric label="Architecture Health" value={`${archHealth}/100`} tone={archHealth >= 80 ? "good" : archHealth >= 50 ? "warn" : "bad"} />
            <Metric label="Dependency Health" value={`${depHealth}/100`} tone={depHealth >= 80 ? "good" : depHealth >= 50 ? "warn" : "bad"} />
          </div>

          {/* === HEATMAP === */}
          <Section icon={<Activity className="h-3.5 w-3.5" />} title="1. Dependency Heatmap (rule-based static graph)">
            <div className="grid grid-cols-2 md:grid-cols-6 gap-2 text-xs">
              <Stat label="Nodes" value={heatmap.metrics.total_nodes} />
              <Stat label="Edges" value={heatmap.metrics.total_edges} />
              <Stat label="Cycles" value={heatmap.metrics.cycles} bad={heatmap.metrics.cycles > 0} />
              <Stat label="Isolated" value={heatmap.metrics.isolated} warn={heatmap.metrics.isolated > 0} />
              <Stat label="Avg coupling" value={heatmap.metrics.avg_coupling} />
              <Stat label="Max coupling" value={heatmap.metrics.max_coupling} />
            </div>
            <details className="mt-2">
              <summary className="text-xs cursor-pointer text-muted-foreground">Top 10 high-coupling nodes</summary>
              <ul className="mt-1 text-[11px] font-mono space-y-0.5">
                {heatmap.high_coupling.map((n) => (
                  <li key={n.id} className="flex justify-between gap-2">
                    <span className="truncate">{n.id}</span>
                    <span className="text-muted-foreground shrink-0">in:{n.imports_in} out:{n.imports_out} ▸ {n.coupling_score}</span>
                  </li>
                ))}
              </ul>
            </details>
            {heatmap.circular_dependencies.length > 0 && (
              <details className="mt-2">
                <summary className="text-xs cursor-pointer text-destructive">Circular dependencies ({heatmap.circular_dependencies.length})</summary>
                <ul className="mt-1 text-[11px] font-mono space-y-0.5">
                  {heatmap.circular_dependencies.slice(0, 20).map((cycle, i) => (
                    <li key={i} className="text-destructive">{cycle.join(" → ")}</li>
                  ))}
                </ul>
              </details>
            )}
          </Section>

          {/* === SELF-HEALING === */}
          <Section icon={<Wrench className="h-3.5 w-3.5" />} title="2. Self-Healing Plan (deterministic rules H1–H6)">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
              <Stat label="Moves" value={heal.summary.moves} warn={heal.summary.moves > 0} />
              <Stat label="Renames" value={heal.summary.renames} warn={heal.summary.renames > 0} />
              <Stat label="Deprecations" value={heal.summary.deprecations} warn={heal.summary.deprecations > 0} />
              <Stat label="Extractions" value={heal.summary.extractions} warn={heal.summary.extractions > 0} />
              <Stat label="Untouched" value={heal.summary.untouched} />
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Rules fired: {heal.applied_rules.length > 0 ? heal.applied_rules.join(", ") : "none"}
            </p>
            {heal.steps.length > 0 && (
              <details className="mt-2">
                <summary className="text-xs cursor-pointer text-muted-foreground">Proposed actions ({heal.steps.length})</summary>
                <ul className="mt-1 text-[11px] font-mono space-y-0.5 max-h-64 overflow-y-auto">
                  {heal.steps.slice(0, 100).map((s, i) => (
                    <li key={i} className="border-b border-border/40 py-0.5">
                      <Badge variant="outline" className="mr-1 text-[9px]">{s.rule}</Badge>
                      <span className="text-foreground">{s.action}</span>{" "}
                      <span className="text-muted-foreground">{s.file}</span>
                      {s.target && <span className="text-primary"> → {s.target}</span>}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </Section>

          {/* === WATCHDOG === */}
          <Section icon={<ShieldCheck className="h-3.5 w-3.5" />} title="3. Architecture Watchdog (rule checks W1–W6)">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
              {watchdog.rules_checked.map((r) => (
                <div key={r.id} className={`flex items-center justify-between rounded border px-2 py-1 ${r.passed ? "border-green-500/40 bg-green-500/5" : "border-destructive/40 bg-destructive/5"}`}>
                  <span className="font-mono">{r.id}</span>
                  <span className="text-[10px] text-muted-foreground truncate ml-2">{r.description}</span>
                  <Badge variant={r.passed ? "secondary" : "destructive"} className="ml-2 text-[9px]">
                    {r.passed ? "PASS" : "FAIL"}
                  </Badge>
                </div>
              ))}
            </div>
            {watchdog.violations.length > 0 && (
              <details className="mt-2" open>
                <summary className="text-xs cursor-pointer text-destructive">Violations ({watchdog.violations.length})</summary>
                <ul className="mt-1 text-[11px] font-mono space-y-0.5 max-h-64 overflow-y-auto">
                  {watchdog.violations.slice(0, 100).map((v, i) => (
                    <li key={i} className="border-b border-border/40 py-0.5">
                      <Badge variant="destructive" className="mr-1 text-[9px]">{v.rule_id}</Badge>
                      <span className="text-muted-foreground">[{v.category}]</span>{" "}
                      {v.file && <span className="text-foreground">{v.file}: </span>}
                      <span>{v.message}</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </Section>

          <p className="text-[10px] text-muted-foreground italic pt-1 border-t">
            All values computed deterministically from import.meta.glob at render time.
            No AI, no inference, no caching. Generated: {watchdog.generated_at}
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

const Metric = ({ label, value, tone }: { label: string; value: string | number; tone: "good" | "warn" | "bad" }) => {
  const cls =
    tone === "good" ? "border-green-500/40 bg-green-500/5 text-green-700 dark:text-green-400"
    : tone === "warn" ? "border-yellow-500/40 bg-yellow-500/5 text-yellow-700 dark:text-yellow-400"
    : "border-destructive/40 bg-destructive/5 text-destructive";
  return (
    <div className={`rounded-md border p-2 ${cls}`}>
      <div className="text-[10px] uppercase tracking-wide opacity-70">{label}</div>
      <div className="text-sm font-bold">{value}</div>
    </div>
  );
};

const Stat = ({ label, value, bad, warn }: { label: string; value: number | string; bad?: boolean; warn?: boolean }) => (
  <div className={`rounded border px-2 py-1 ${bad ? "border-destructive/40 bg-destructive/5" : warn ? "border-yellow-500/40 bg-yellow-500/5" : "border-border bg-muted/30"}`}>
    <div className="text-[9px] uppercase text-muted-foreground">{label}</div>
    <div className="text-xs font-mono font-semibold">{value}</div>
  </div>
);

const Section = ({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) => (
  <div className="rounded-md border border-border p-2 space-y-1">
    <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
      {icon}
      {title}
    </div>
    {children}
  </div>
);
