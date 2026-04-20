/**
 * FINAL SNAPSHOT PANEL
 *
 * Displays the immutable snapshot taken after the last successful
 * ExecutionController run, with a Verify button that re-derives the
 * verification hash from the live fileSystemMap.
 */
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Camera, ShieldCheck, ShieldAlert, RefreshCw, Lock } from "lucide-react";
import { finalSnapshotEngine, type SnapshotState, type ImmutableSnapshot } from "@/core/scanner/finalSnapshotEngine";

export function FinalSnapshotPanel() {
  const [state, setState] = useState<SnapshotState>(() => finalSnapshotEngine.getState());
  const [verification, setVerification] = useState<{ valid: boolean; live_hash: string; reason: string | null } | null>(null);

  useEffect(() => {
    const tick = () => setState(finalSnapshotEngine.getState());
    return finalSnapshotEngine.subscribe(tick);
  }, []);

  const verify = () => {
    if (!state.current) return;
    setVerification(finalSnapshotEngine.verify(state.current));
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Camera className="h-4 w-4" />
            Final Snapshot
            <Badge variant="outline" className="ml-1 font-mono text-[10px]">
              IMMUTABLE · RUN-ONCE
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-[10px]">
              committed: {state.total_committed}
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
        {!state.current ? (
          <div className="rounded-md border border-dashed bg-muted/30 px-3 py-6 text-center text-xs text-muted-foreground">
            <Lock className="mx-auto mb-2 h-4 w-4" />
            No snapshot yet. Run the ExecutionController to commit one.
          </div>
        ) : (
          <SnapshotCard
            snap={state.current}
            verification={verification}
            onVerify={verify}
          />
        )}

        {state.history.length > 1 && (
          <details className="rounded-md border">
            <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted/40">
              History ({state.history.length - 1} earlier snapshots)
            </summary>
            <ul className="divide-y border-t text-[11px]">
              {state.history.slice(1).map((s) => (
                <li key={s.snapshot_id} className="grid grid-cols-[1fr_auto] gap-x-3 px-3 py-2">
                  <div className="font-mono">{s.snapshot_id}</div>
                  <div className="text-muted-foreground">{new Date(s.created_at).toLocaleString()}</div>
                  <div className="col-span-2 font-mono text-muted-foreground">
                    files {s.file_count} · comps {s.component_count} · routes {s.route_count} ·
                    edges {s.dependency_graph.edges} · cycles {s.dependency_graph.cycles} ·
                    hash {s.verification_hash.slice(0, 16)}…
                  </div>
                </li>
              ))}
            </ul>
          </details>
        )}

        {state.rejected_attempts.length > 0 && (
          <details className="rounded-md border border-destructive/40">
            <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-destructive hover:bg-destructive/10">
              Rejected attempts ({state.rejected_attempts.length})
            </summary>
            <ul className="divide-y border-t text-[11px]">
              {state.rejected_attempts.slice(-10).reverse().map((r, i) => (
                <li key={i} className="grid grid-cols-[1fr_auto] gap-x-3 px-3 py-2">
                  <div className="font-mono">{r.run_id}</div>
                  <div className="text-muted-foreground">{new Date(r.at).toLocaleTimeString()}</div>
                  <div className="col-span-2 text-muted-foreground">{r.reason}</div>
                </li>
              ))}
            </ul>
          </details>
        )}

        <p className="text-[11px] text-muted-foreground">
          The snapshot is created once per controller run, frozen, and stored with a
          deterministic hash of the sorted file list. Use Verify to confirm the live
          file system still matches the captured state.
        </p>
      </CardContent>
    </Card>
  );
}

function SnapshotCard({
  snap,
  verification,
  onVerify,
}: {
  snap: ImmutableSnapshot;
  verification: { valid: boolean; live_hash: string; reason: string | null } | null;
  onVerify: () => void;
}) {
  return (
    <div className="space-y-3 rounded-md border bg-muted/20 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="font-mono">{snap.snapshot_id}</div>
        <div className="text-muted-foreground">
          run <span className="font-mono">{snap.run_id}</span> ·{" "}
          {new Date(snap.created_at).toLocaleString()}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Files" value={snap.file_count} />
        <Stat label="Components" value={snap.component_count} />
        <Stat label="Routes" value={snap.route_count} />
        <Stat
          label="Deps (e/c/i)"
          value={`${snap.dependency_graph.edges}/${snap.dependency_graph.cycles}/${snap.dependency_graph.isolated}`}
        />
      </div>

      <div className="rounded-md border bg-card p-2 text-xs">
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Verification hash
          </span>
          <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={onVerify}>
            <RefreshCw className="h-3 w-3" />
            Verify
          </Button>
        </div>
        <div className="break-all font-mono text-[11px]">{snap.verification_hash}</div>
        <div className="mt-1 text-[11px] text-muted-foreground">
          fingerprint: {snap.file_list_fingerprint.count} files · first{" "}
          <span className="font-mono">{snap.file_list_fingerprint.first}</span> · last{" "}
          <span className="font-mono">{snap.file_list_fingerprint.last}</span>
        </div>
        {verification && (
          <div
            className={`mt-2 flex items-start gap-1.5 rounded px-2 py-1.5 text-[11px] ${
              verification.valid
                ? "bg-primary/10 text-primary"
                : "bg-destructive/10 text-destructive"
            }`}
          >
            {verification.valid ? (
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            ) : (
              <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            )}
            <div>
              {verification.valid
                ? "Snapshot valid — live file list matches the captured hash."
                : verification.reason}
              <div className="mt-0.5 font-mono opacity-70">live: {verification.live_hash}</div>
            </div>
          </div>
        )}
      </div>
    </div>
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
