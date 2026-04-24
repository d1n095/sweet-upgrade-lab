import { useEffect, useState } from "react";
import { getLikelyRootCause, type LikelyRootCause } from "@/lib/failureMemory";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Read-only debug panel that exposes getLikelyRootCause().
 * No polling, no state management beyond local snapshot. Refreshes only on
 * mount and when the user clicks "Refresh".
 */
export function RootCausePanel() {
  const [snapshot, setSnapshot] = useState<LikelyRootCause | null>(null);
  const [loadedAt, setLoadedAt] = useState<string | null>(null);

  const load = () => {
    setSnapshot(getLikelyRootCause());
    setLoadedAt(new Date().toLocaleTimeString());
  };

  useEffect(() => {
    load();
  }, []);

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
