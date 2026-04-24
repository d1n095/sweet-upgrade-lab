import { useEffect, useState } from "react";
import {
  getLikelyRootCause,
  getFieldTransitionTrace,
  type LikelyRootCause,
  type FieldTransitionTrace,
} from "@/lib/failureMemory";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Read-only debug panel exposing getLikelyRootCause() and the related
 * field-transition trace. No polling, no state beyond local snapshot.
 */
export function RootCausePanel() {
  const [snapshot, setSnapshot] = useState<LikelyRootCause | null>(null);
  const [trace, setTrace] = useState<FieldTransitionTrace | null>(null);
  const [loadedAt, setLoadedAt] = useState<string | null>(null);

  const load = () => {
    const root = getLikelyRootCause();
    setSnapshot(root);
    setTrace(
      root?.representative_cluster_id
        ? getFieldTransitionTrace(root.representative_cluster_id)
        : null,
    );
    setLoadedAt(new Date().toLocaleTimeString());
  };

  useEffect(() => {
    load();
  }, []);

  // Build per-entity grouping sorted by frequency (desc), then field name.
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
    // Sort groups by max frequency in group desc.
    out.sort((a, b) => (b.transitions[0]?.count ?? 0) - (a.transitions[0]?.count ?? 0));
    return out;
  })();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Likely Root Cause</CardTitle>
        <Button size="sm" variant="outline" onClick={load}>
          Refresh
        </Button>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {!snapshot ? (
          <p className="text-muted-foreground">
            No breakpoint clusters detected yet.
          </p>
        ) : (
          <>
            <div>
              <div className="text-muted-foreground">Top breakpoint cluster</div>
              <div className="font-mono text-xs break-all">
                {snapshot.representative_cluster_id ?? "—"}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">Affected entities</div>
              <div>{snapshot.affected_entities.join(", ") || "—"}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Most common missing fields</div>
              <ul className="list-disc pl-5">
                {snapshot.most_common_missing_fields.map((f) => (
                  <li key={f} className="font-mono text-xs">{f}</li>
                ))}
              </ul>
            </div>
            <div>
              <div className="text-muted-foreground">Occurrence frequency</div>
              <div>{snapshot.cluster_occurrences}</div>
            </div>

            <div className="pt-2 border-t">
              <div className="text-muted-foreground mb-2">Field transitions</div>
              {entityGroups.length === 0 ? (
                <p className="text-muted-foreground text-xs">No transitions recorded</p>
              ) : (
                <div className="space-y-3">
                  {entityGroups.map((g) => (
                    <div key={g.entity}>
                      <div className="text-xs font-semibold uppercase tracking-wide">
                        {g.entity}
                      </div>
                      <ul className="space-y-1 mt-1">
                        {g.transitions.map((t) => (
                          <li
                            key={`${t.field_path}|${t.before}->${t.after}`}
                            className="font-mono text-xs"
                          >
                            <div>{t.field_path}</div>
                            <div className="text-muted-foreground">
                              {t.before} → {t.after}
                              {t.count > 1 ? ` (×${t.count})` : ""}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
        {loadedAt && (
          <div className="text-xs text-muted-foreground pt-2 border-t">
            Loaded at {loadedAt}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default RootCausePanel;
