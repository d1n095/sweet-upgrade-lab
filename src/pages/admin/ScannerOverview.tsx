import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { patternMemory, type PatternMemoryState } from "@/core/scanner/patternMemory";
import {
  getLikelyRootCause,
  getTopCriticalEndpoints,
  getBreakpointClusters,
  getFieldTransitionTrace,
  type LikelyRootCause,
  type TopCriticalEndpoint,
  type BreakpointCluster,
  type FieldTransitionTrace,
} from "@/lib/failureMemory";

/**
 * Read-only unified scanner overview. Aggregates existing in-memory data
 * sources only — no polling, no fetching, no new logic. Refreshes by
 * re-reading the same getters on demand.
 */
export default function ScannerOverview() {
  const [pattern, setPattern] = useState<PatternMemoryState | null>(null);
  const [topEndpoints, setTopEndpoints] = useState<TopCriticalEndpoint[]>([]);
  const [rootCause, setRootCause] = useState<LikelyRootCause | null>(null);
  const [trace, setTrace] = useState<FieldTransitionTrace | null>(null);
  const [clusters, setClusters] = useState<ReadonlyArray<BreakpointCluster>>([]);
  const [loadedAt, setLoadedAt] = useState<string | null>(null);

  const load = () => {
    const root = getLikelyRootCause();
    setPattern(patternMemory.getState());
    setTopEndpoints(getTopCriticalEndpoints(10));
    setRootCause(root);
    setTrace(
      root?.representative_cluster_id
        ? getFieldTransitionTrace(root.representative_cluster_id)
        : null,
    );
    setClusters(getBreakpointClusters());
    setLoadedAt(new Date().toLocaleTimeString());
  };

  useEffect(() => {
    load();
  }, []);

  // Active patterns: combine endpoint mismatches sorted by occurrence DESC.
  const activePatterns = (pattern?.endpoint_mismatches ?? [])
    .slice()
    .sort((a, b) => b.occurrence_count - a.occurrence_count);

  // Field transition grouping (for section C).
  const entityGroups = (() => {
    if (!trace) return [] as Array<{
      entity: string;
      transitions: Array<{ field_path: string; before: string; after: string; count: number }>;
    }>;
    const out: Array<{
      entity: string;
      transitions: Array<{ field_path: string; before: string; after: string; count: number }>;
    }> = [];
    for (const [entity, list] of Object.entries(trace.by_entity)) {
      const seen = new Map<string, { field_path: string; before: string; after: string; count: number }>();
      for (const t of list) {
        const key = `${t.field_path}|${t.before}->${t.after}`;
        const existing = seen.get(key);
        if (existing) existing.count += 1;
        else
          seen.set(key, {
            field_path: t.field_path,
            before: t.before,
            after: t.after,
            count: trace.frequency[t.field_path] ?? 1,
          });
      }
      const transitions = [...seen.values()].sort(
        (a, b) => b.count - a.count || a.field_path.localeCompare(b.field_path),
      );
      out.push({ entity, transitions });
    }
    out.sort((a, b) => (b.transitions[0]?.count ?? 0) - (a.transitions[0]?.count ?? 0));
    return out;
  })();

  const maxTransitionCount = entityGroups.reduce(
    (m, g) => Math.max(m, g.transitions[0]?.count ?? 0),
    0,
  );

  return (
    <div className="container max-w-5xl py-6 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Scanner Overview</h1>
          <p className="text-sm text-muted-foreground">
            Unified read-only view of all scanner outputs.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {loadedAt && (
            <span className="text-xs text-muted-foreground">Loaded {loadedAt}</span>
          )}
          <Button size="sm" variant="outline" onClick={load}>
            Refresh
          </Button>
        </div>
      </header>

      {/* A. Top Critical Endpoints */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">A. Top Critical Endpoints</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          {topEndpoints.length === 0 ? (
            <p className="text-muted-foreground">No data available</p>
          ) : (
            <ul className="divide-y">
              {topEndpoints.map((e) => (
                <li key={e.endpoint} className="py-2 flex items-center justify-between gap-3">
                  <span className="font-mono text-xs break-all">{e.endpoint}</span>
                  <span className="text-xs whitespace-nowrap">
                    score <strong>{e.total_priority_score}</strong> · {e.number_of_flags} flag(s)
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* B. Root Cause Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">B. Root Cause Summary</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          {!rootCause ? (
            <p className="text-muted-foreground">No data available</p>
          ) : (
            <>
              <div>
                <div className="text-muted-foreground">Top breakpoint cluster</div>
                <div className="font-mono text-xs break-all">
                  {rootCause.representative_cluster_id ?? "—"}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Affected entities</div>
                <div>{rootCause.affected_entities.join(", ") || "—"}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Most common missing fields</div>
                <ul className="list-disc pl-5">
                  {rootCause.most_common_missing_fields.map((f) => (
                    <li key={f} className="font-mono text-xs">{f}</li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="text-muted-foreground">Occurrence frequency</div>
                <div>{rootCause.cluster_occurrences}</div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* C. Field Transition Trace */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">C. Field Transition Trace</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          {entityGroups.length === 0 ? (
            <p className="text-muted-foreground">No data available</p>
          ) : (
            <div className="space-y-4">
              {entityGroups.map((g) => (
                <div key={g.entity}>
                  <div className="text-xs font-semibold uppercase tracking-wide mb-1">
                    {g.entity}
                  </div>
                  <ul className="space-y-1">
                    {g.transitions.map((t) => {
                      const isMostFrequent =
                        t.count === maxTransitionCount && maxTransitionCount > 0;
                      return (
                        <li
                          key={`${t.field_path}|${t.before}->${t.after}`}
                          className={
                            "font-mono text-xs " +
                            (isMostFrequent ? "border-l-2 border-foreground pl-2" : "pl-2")
                          }
                        >
                          <div>{t.field_path}</div>
                          <div className="text-muted-foreground">
                            {t.before} → {t.after}
                            {t.count > 1 ? ` (×${t.count})` : ""}
                            {isMostFrequent ? " ★" : ""}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* D. Active Pattern Log */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">D. Active Pattern Log</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          {activePatterns.length === 0 ? (
            <p className="text-muted-foreground">No data available</p>
          ) : (
            <ul className="divide-y">
              {activePatterns.map((p) => (
                <li key={p.pattern_key} className="py-2 flex items-center justify-between gap-3">
                  <span className="font-mono text-xs break-all">{p.pattern_key}</span>
                  <span className="text-xs whitespace-nowrap">
                    occurrences <strong>{p.occurrence_count}</strong>
                    {p.persistent ? " · persistent" : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* E. Breakpoint Clusters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">E. Breakpoint Clusters</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          {clusters.length === 0 ? (
            <p className="text-muted-foreground">No data available</p>
          ) : (
            <ul className="divide-y">
              {clusters.map((c) => (
                <li key={c.breakpoint_cluster_id} className="py-2 space-y-1">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono text-xs break-all">
                      {c.breakpoint_cluster_id}
                    </span>
                    <span className="text-xs whitespace-nowrap">
                      frequency <strong>{c.occurrence_count}</strong>
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    entities: {c.affected_entities.join(", ") || "—"}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
