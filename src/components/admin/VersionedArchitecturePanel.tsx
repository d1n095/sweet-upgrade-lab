/**
 * VERSIONED ARCHITECTURE PANEL
 *
 * Shows every immutable architecture version (v1, v2, …) created after a
 * successful build pipeline. Lets the operator inspect any version and view
 * the diff against the previous one.
 */
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GitBranch, ArrowRight, Lock, History, Minus, Plus, Equal } from "lucide-react";
import {
  versionedArchitectureStore,
  type ArchitectureVersion,
  type VersionDiff,
  type VersionedStoreState,
} from "@/core/scanner/versionedArchitectureStore";

export function VersionedArchitecturePanel() {
  const [state, setState] = useState<VersionedStoreState>(() => versionedArchitectureStore.getState());
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const tick = () => setState(versionedArchitectureStore.getState());
    return versionedArchitectureStore.subscribe(tick);
  }, []);

  // Default selection = newest version.
  useEffect(() => {
    if (!selectedId && state.current) setSelectedId(state.current.version_id);
  }, [state.current, selectedId]);

  const selected = useMemo(
    () => state.versions.find((v) => v.version_id === selectedId) ?? state.current,
    [state, selectedId]
  );

  const diff = useMemo<VersionDiff | null>(() => {
    if (!selected) return null;
    const idx = state.versions.findIndex((v) => v.version_id === selected.version_id);
    const prev = idx >= 0 ? state.versions[idx + 1] ?? null : null;
    return versionedArchitectureStore.computeDiff(prev, selected);
  }, [state, selected]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <GitBranch className="h-4 w-4" />
            Versioned Architecture State
            <Badge variant="outline" className="ml-1 font-mono text-[10px]">
              IMMUTABLE · APPEND-ONLY
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-[10px]">
              versions: {state.total}
            </Badge>
            {state.rejected_attempts.length > 0 && (
              <Badge variant="destructive" className="text-[10px]">
                rejected: {state.rejected_attempts.length}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {state.total === 0 ? (
          <div className="rounded-md border border-dashed bg-muted/30 px-3 py-6 text-center text-xs text-muted-foreground">
            <Lock className="mx-auto mb-2 h-4 w-4" />
            No versions yet. Run the Deterministic Build Pipeline; a version is created on SUCCESS.
          </div>
        ) : (
          <>
            <div className="grid gap-3 lg:grid-cols-[220px_1fr]">
              {/* Version list */}
              <div className="rounded-md border bg-card">
                <div className="flex items-center gap-1.5 border-b px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  <History className="h-3 w-3" />
                  Versions
                </div>
                <ul className="max-h-72 divide-y overflow-auto">
                  {state.versions.map((v) => (
                    <li key={v.version_id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(v.version_id)}
                        className={`w-full px-3 py-2 text-left text-xs transition-colors hover:bg-muted/40 ${
                          selected?.version_id === v.version_id ? "bg-muted/60" : ""
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono font-semibold">{v.version_id}</span>
                          <ScoreBadge score={v.architecture_score} />
                        </div>
                        <div className="mt-0.5 text-[10px] text-muted-foreground">
                          {new Date(v.created_at).toLocaleString()}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Selected version detail */}
              {selected && (
                <div className="space-y-3">
                  <VersionDetail v={selected} />
                  {diff && <DiffView diff={diff} />}
                </div>
              )}
            </div>
          </>
        )}

        {state.rejected_attempts.length > 0 && (
          <details className="rounded-md border border-destructive/40">
            <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-destructive hover:bg-destructive/10">
              Rejected attempts ({state.rejected_attempts.length})
            </summary>
            <ul className="divide-y border-t text-[11px]">
              {state.rejected_attempts.slice(-10).reverse().map((r, i) => (
                <li key={i} className="grid grid-cols-[1fr_auto] gap-x-3 px-3 py-2">
                  <div className="font-mono">{r.pipeline_id}</div>
                  <div className="text-muted-foreground">{new Date(r.at).toLocaleTimeString()}</div>
                  <div className="col-span-2 text-muted-foreground">{r.reason}</div>
                </li>
              ))}
            </ul>
          </details>
        )}

        <p className="text-[11px] text-muted-foreground">
          Versions are created only on pipeline SUCCESS, are frozen at write time, and can never be
          modified. Each version is anchored to its source pipeline run id and (when present) the
          immutable snapshot hash.
        </p>
      </CardContent>
    </Card>
  );
}

function VersionDetail({ v }: { v: ArchitectureVersion }) {
  return (
    <div className="rounded-md border bg-muted/20 p-3 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-semibold">{v.version_id}</span>
          <Badge variant="outline" className="text-[10px]">
            {v.architecture_status}
          </Badge>
          <ScoreBadge score={v.architecture_score} />
        </div>
        <div className="text-[11px] text-muted-foreground">
          run <span className="font-mono">{v.source_pipeline_id}</span> ·{" "}
          {new Date(v.created_at).toLocaleString()}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Files" value={v.file_count} />
        <Stat label="Components" value={v.component_count} />
        <Stat label="Routes" value={v.route_count} />
        <Stat label="Violations" value={v.architecture_violations} />
        <Stat label="Edges" value={v.dependency_graph.edges} />
        <Stat label="Cycles" value={v.dependency_graph.cycles} />
        <Stat label="Isolated" value={v.dependency_graph.isolated} />
        <Stat label="Score" value={v.architecture_score} />
      </div>

      {v.snapshot_hash && (
        <div className="mt-2 rounded border bg-card px-2 py-1.5">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Snapshot hash</div>
          <div className="break-all font-mono text-[11px]">{v.snapshot_hash}</div>
        </div>
      )}
    </div>
  );
}

function DiffView({ diff }: { diff: VersionDiff }) {
  if (diff.is_first_version) {
    return (
      <div className="rounded-md border bg-card px-3 py-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Initial version</span> — no predecessor to
        diff against.
      </div>
    );
  }

  const changedKeys = Object.keys(diff.changes);
  return (
    <div className="rounded-md border bg-card p-3 text-xs">
      <div className="mb-2 flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        <span className="font-mono text-foreground">{diff.from_version_id}</span>
        <ArrowRight className="h-3 w-3" />
        <span className="font-mono text-foreground">{diff.to_version_id}</span>
        <span className="ml-auto">
          {changedKeys.length} change{changedKeys.length === 1 ? "" : "s"}
        </span>
      </div>

      {changedKeys.length === 0 ? (
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Equal className="h-3 w-3" />
          No field changes — system state unchanged since previous version.
        </div>
      ) : (
        <ul className="divide-y">
          {changedKeys.map((key) => {
            const change = diff.changes[key];
            if (change.kind === "scalar") {
              return (
                <li key={key} className="grid grid-cols-[140px_1fr_auto] items-center gap-2 py-1.5">
                  <span className="font-mono text-foreground">{key}</span>
                  <span className="font-mono text-muted-foreground">
                    {String(change.from)} <ArrowRight className="inline h-3 w-3" />{" "}
                    <span className="text-foreground">{String(change.to)}</span>
                  </span>
                  <DeltaBadge delta={change.delta} />
                </li>
              );
            }
            return (
              <li key={key} className="grid grid-cols-[140px_1fr] gap-2 py-1.5">
                <span className="font-mono text-foreground">{key}</span>
                <div className="space-y-0.5 font-mono text-[11px] text-muted-foreground">
                  <div>
                    edges: {change.from.edges} <ArrowRight className="inline h-3 w-3" />{" "}
                    <span className="text-foreground">{change.to.edges}</span>{" "}
                    <DeltaBadge delta={change.delta.edges} inline />
                  </div>
                  <div>
                    cycles: {change.from.cycles} <ArrowRight className="inline h-3 w-3" />{" "}
                    <span className="text-foreground">{change.to.cycles}</span>{" "}
                    <DeltaBadge delta={change.delta.cycles} inline />
                  </div>
                  <div>
                    isolated: {change.from.isolated} <ArrowRight className="inline h-3 w-3" />{" "}
                    <span className="text-foreground">{change.to.isolated}</span>{" "}
                    <DeltaBadge delta={change.delta.isolated} inline />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {diff.unchanged.length > 0 && (
        <div className="mt-2 text-[11px] text-muted-foreground">
          Unchanged: {diff.unchanged.join(", ")}
        </div>
      )}
    </div>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const tone =
    score >= 90 ? "secondary" : score >= 70 ? "outline" : ("destructive" as const);
  return (
    <Badge variant={tone} className="font-mono text-[10px]">
      score {score}
    </Badge>
  );
}

function DeltaBadge({ delta, inline = false }: { delta: number | null; inline?: boolean }) {
  if (delta == null) {
    return inline ? null : <span className="text-[10px] text-muted-foreground">—</span>;
  }
  if (delta === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
        <Equal className="h-3 w-3" />0
      </span>
    );
  }
  const positive = delta > 0;
  const Icon = positive ? Plus : Minus;
  const tone = positive ? "text-foreground" : "text-foreground";
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-medium ${tone}`}>
      <Icon className="h-3 w-3" />
      {Math.abs(delta)}
    </span>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-md border bg-card px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-mono text-sm font-medium">{value}</div>
    </div>
  );
}

export function Stub() {
  return null;
}

// Re-export for any external consumer wishing to render a single version.
export { VersionDetail as ArchitectureVersionDetail };
