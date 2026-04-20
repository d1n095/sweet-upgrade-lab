/**
 * SYSTEM STATE REGISTRY PANEL
 *
 * Live view of the append-only state registry: current snapshot, last
 * validated record, and rejected attempts. Includes a "Refresh from sources"
 * button that re-derives all five tracked states from their evidence files
 * (fileSystemMap, scannerV2, dependencyHeatmap, architectureWatchdog) and
 * pushes them through the registry's validation pipeline.
 */

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { systemStateRegistry, type RegistrySnapshot, type StateKey } from "@/core/scanner/systemStateRegistry";
import { fileSystemMap, scanInputSummary } from "@/lib/fileSystemMap";
import { runScannerV2 } from "@/architecture/scannerV2";
import { runDependencyHeatmap } from "@/core/architecture/dependencyHeatmap";
import { runArchitectureWatchdog } from "@/core/architecture/architectureWatchdog";
import { Database, RefreshCw, ShieldCheck, AlertTriangle } from "lucide-react";

const ALL_KEYS: StateKey[] = [
  "file_count",
  "component_count",
  "route_count",
  "dependency_graph",
  "architecture_status",
];

export const SystemStateRegistryPanel = () => {
  const [snap, setSnap] = useState<RegistrySnapshot>(() => systemStateRegistry.snapshot());

  useEffect(() => {
    const refresh = () => setSnap(systemStateRegistry.snapshot());
    return systemStateRegistry.subscribe(refresh);
  }, []);

  // Auto-publish once on mount so the registry is never empty when first viewed.
  useEffect(() => {
    if (snap.total_records === 0) refreshFromSources();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const missing = ALL_KEYS.filter((k) => !snap.current_state_snapshot[k]);

  return (
    <Card className="border-border">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Database className="h-4 w-4 text-primary" />
          System State Registry — Single Source of Truth
        </CardTitle>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px]">
            records: {snap.total_records}
          </Badge>
          <Badge variant={missing.length === 0 ? "secondary" : "destructive"} className="text-[10px]">
            {missing.length === 0 ? "ALL TRACKED" : `MISSING ${missing.length}`}
          </Badge>
          <Button size="sm" variant="outline" className="h-7" onClick={refreshFromSources}>
            <RefreshCw className="h-3 w-3 mr-1" /> Refresh from sources
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Current snapshot grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {ALL_KEYS.map((key) => {
            const rec = snap.current_state_snapshot[key];
            return (
              <div
                key={key}
                className={`rounded-md border p-2 text-xs ${
                  rec ? "border-border bg-muted/30" : "border-destructive/50 bg-destructive/5"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-semibold text-foreground">{key}</span>
                  {rec ? (
                    <Badge variant="secondary" className="text-[9px] flex items-center gap-1">
                      <ShieldCheck className="h-3 w-3" /> v{rec.version}
                    </Badge>
                  ) : (
                    <Badge variant="destructive" className="text-[9px]">
                      NO RECORD
                    </Badge>
                  )}
                </div>
                {rec ? (
                  <>
                    <div className="mt-1 font-mono text-[11px] text-foreground break-all">
                      {renderValue(rec.value)}
                    </div>
                    <div className="mt-1 text-[10px] text-muted-foreground flex flex-wrap gap-x-2">
                      <span>src: {rec.source_module}</span>
                      <span>evidence: {rec.file_evidence_ref}</span>
                      <span>at: {new Date(rec.timestamp).toLocaleTimeString("sv-SE")}</span>
                    </div>
                  </>
                ) : (
                  <div className="mt-1 text-[10px] text-destructive">
                    UNKNOWN — no source has published this state yet
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Last validated */}
        <div className="rounded-md border border-border p-2 text-xs">
          <div className="text-[10px] uppercase text-muted-foreground mb-1">Last validated state</div>
          {snap.last_validated_state ? (
            <div className="font-mono text-[11px] flex flex-wrap gap-x-2">
              <Badge variant="outline" className="text-[9px]">v{snap.last_validated_state.version}</Badge>
              <span className="text-foreground">{snap.last_validated_state.state_key}</span>
              <span className="text-muted-foreground">by {snap.last_validated_state.source_module}</span>
              <span className="text-muted-foreground">at {new Date(snap.last_validated_state.timestamp).toLocaleString("sv-SE")}</span>
            </div>
          ) : (
            <div className="text-muted-foreground italic">No records yet.</div>
          )}
        </div>

        {/* History */}
        <details className="rounded-md border border-border">
          <summary className="px-2 py-1.5 border-b border-border bg-muted/30 text-[11px] font-semibold cursor-pointer">
            History (last {snap.history.length})
          </summary>
          {snap.history.length === 0 ? (
            <div className="p-2 text-xs text-muted-foreground italic">Empty.</div>
          ) : (
            <ul className="divide-y divide-border text-[11px] font-mono max-h-48 overflow-y-auto">
              {snap.history.map((r) => (
                <li key={r.version} className="px-2 py-1 flex flex-wrap gap-2">
                  <Badge variant="outline" className="text-[9px]">v{r.version}</Badge>
                  <span className="text-foreground">{r.state_key}</span>
                  <span className="text-muted-foreground">{renderValue(r.value)}</span>
                  <span className="text-muted-foreground ml-auto">{r.source_module}</span>
                  <span className="text-muted-foreground">{new Date(r.timestamp).toLocaleTimeString("sv-SE")}</span>
                </li>
              ))}
            </ul>
          )}
        </details>

        {/* Invalid states */}
        <details className="rounded-md border border-border" open={snap.invalid_states.length > 0}>
          <summary className="px-2 py-1.5 border-b border-border bg-muted/30 text-[11px] font-semibold cursor-pointer flex items-center gap-2">
            <AlertTriangle className="h-3 w-3 text-destructive" />
            Invalid / rejected states ({snap.invalid_states.length})
          </summary>
          {snap.invalid_states.length === 0 ? (
            <div className="p-2 text-xs text-muted-foreground italic">No rejections recorded.</div>
          ) : (
            <ul className="divide-y divide-border text-[11px] font-mono max-h-48 overflow-y-auto">
              {snap.invalid_states.map((r, i) => (
                <li key={i} className="px-2 py-1 flex flex-wrap gap-2">
                  <Badge variant="destructive" className="text-[9px]">REJECTED</Badge>
                  <span className="text-foreground">{r.state_key}</span>
                  <span className="text-muted-foreground">by {r.source_module}</span>
                  <span className="text-amber-600 dark:text-amber-400">{r.reason}</span>
                  <span className="text-muted-foreground ml-auto">{new Date(r.attempt_at).toLocaleTimeString("sv-SE")}</span>
                </li>
              ))}
            </ul>
          )}
        </details>

        <p className="text-[10px] text-muted-foreground italic pt-1 border-t">
          Append-only ledger. Every record carries source_module + file_evidence_ref + timestamp.
          Snapshot generated: {snap.generated_at}
        </p>
      </CardContent>
    </Card>
  );
};

function renderValue(v: unknown): string {
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

/**
 * Re-derive every tracked state from its source-of-truth evidence and push
 * each through the registry's validator. Anything that fails validation is
 * captured in `invalid_states`.
 */
function refreshFromSources() {
  const scanner = runScannerV2();
  const heat = runDependencyHeatmap();
  const watch = runArchitectureWatchdog();

  systemStateRegistry.recordBatch([
    {
      state_key: "file_count",
      value: fileSystemMap.length,
      source_module: "fileSystemMap",
      file_evidence_ref: "src/lib/fileSystemMap.ts → fileSystemMap.length",
    },
    {
      state_key: "component_count",
      value: scanner.processed.components,
      source_module: "scannerV2",
      file_evidence_ref: `src/architecture/scannerV2.ts → processed.components (sample: ${scanInputSummary.sample_components.slice(0, 2).join(", ")})`,
    },
    {
      state_key: "route_count",
      value: scanner.processed.routes,
      source_module: "scannerV2",
      file_evidence_ref: "src/architecture/scannerV2.ts → processed.routes",
    },
    {
      state_key: "dependency_graph",
      value: {
        nodes: heat.metrics.total_nodes,
        edges: heat.metrics.total_edges,
        cycles: heat.metrics.cycles,
        isolated: heat.metrics.isolated,
      },
      source_module: "dependencyHeatmap",
      file_evidence_ref: "src/core/architecture/dependencyHeatmap.ts → metrics",
    },
    {
      state_key: "architecture_status",
      value: {
        system_state: watch.system_state,
        compliance_score: watch.compliance_score,
        violations: watch.violations.length,
      },
      source_module: "architectureWatchdog",
      file_evidence_ref: "src/core/architecture/architectureWatchdog.ts → report",
    },
  ]);
}
