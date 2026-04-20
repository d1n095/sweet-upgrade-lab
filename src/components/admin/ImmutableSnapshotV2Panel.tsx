/**
 * IMMUTABLE SNAPSHOT v2 PANEL
 *
 * Lets the operator capture and audit full system snapshots: file list,
 * dependency graph, route registry, and architecture violations — bound
 * together by a deterministic integrity hash.
 */
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Camera,
  ShieldCheck,
  ShieldAlert,
  History as HistoryIcon,
  FileText,
  GitBranch,
  Map as MapIcon,
  AlertOctagon,
  Hash,
  Copy,
  Check,
} from "lucide-react";
import {
  snapshotStoreV2,
  type ImmutableSnapshotV2,
  type SnapshotV2State,
} from "@/core/scanner/immutableSnapshotV2";

export function ImmutableSnapshotV2Panel() {
  const [state, setState] = useState<SnapshotV2State>(() => snapshotStoreV2.getState());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [verify, setVerify] = useState<
    Record<string, { ok: boolean; expected: string; actual: string }>
  >({});
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    const tick = () => setState(snapshotStoreV2.getState());
    return snapshotStoreV2.subscribe(tick);
  }, []);

  useEffect(() => {
    if (!selectedId && state.current) setSelectedId(state.current.snapshot_id);
  }, [state.current, selectedId]);

  const selected = useMemo(
    () => state.history.find((s) => s.snapshot_id === selectedId) ?? state.current,
    [state, selectedId]
  );

  const onCommit = () => {
    const snap = snapshotStoreV2.commit({ source: "manual:admin" });
    setSelectedId(snap.snapshot_id);
  };

  const onVerify = (id: string) => {
    const res = snapshotStoreV2.verify(id);
    if (res) setVerify((m) => ({ ...m, [id]: res }));
  };

  const onCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(null), 1200);
    } catch {
      /* ignore */
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Camera className="h-4 w-4" />
            Immutable Snapshot v2
            <Badge variant="outline" className="ml-1 font-mono text-[10px]">
              FULL AUDIT EVIDENCE
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-[10px]">
              committed: {state.total_committed}
            </Badge>
            {state.duplicate_hits > 0 && (
              <Badge variant="outline" className="text-[10px]">
                deduped: {state.duplicate_hits}
              </Badge>
            )}
            <Button size="sm" onClick={onCommit} className="h-7">
              <Camera className="mr-1 h-3 w-3" />
              Capture
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {state.total_committed === 0 ? (
          <div className="rounded-md border border-dashed bg-muted/30 px-3 py-6 text-center text-xs text-muted-foreground">
            No snapshots yet. Click <span className="font-medium">Capture</span> to record the
            current full system state with an integrity hash.
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-[220px_1fr]">
            {/* History */}
            <div className="rounded-md border bg-card">
              <div className="flex items-center gap-1.5 border-b px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                <HistoryIcon className="h-3 w-3" />
                History
              </div>
              <ul className="max-h-96 divide-y overflow-auto">
                {state.history.map((s) => (
                  <li key={s.snapshot_id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(s.snapshot_id)}
                      className={`w-full px-3 py-2 text-left text-xs transition-colors hover:bg-muted/40 ${
                        selected?.snapshot_id === s.snapshot_id ? "bg-muted/60" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-mono text-[11px] font-semibold">
                          {s.snapshot_id}
                        </span>
                        <Badge variant="outline" className="text-[10px]">
                          {s.file_count} files
                        </Badge>
                      </div>
                      <div className="mt-0.5 truncate text-[10px] text-muted-foreground">
                        {new Date(s.created_at).toLocaleString()} · {s.source}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {/* Detail */}
            {selected && (
              <SnapshotDetail
                snap={selected}
                verify={verify[selected.snapshot_id]}
                copied={copied === selected.snapshot_id}
                onVerify={() => onVerify(selected.snapshot_id)}
                onCopyHash={() => onCopy(selected.snapshot_id, selected.integrity_hash)}
              />
            )}
          </div>
        )}

        <p className="text-[11px] text-muted-foreground">
          v2 stores the full file list, dependency graph, route registry, and architecture
          violations. The integrity hash is derived from a deterministic JSON canonicalisation of
          all stored fields — any tamper changes the hash.
        </p>
      </CardContent>
    </Card>
  );
}

function SnapshotDetail({
  snap,
  verify,
  copied,
  onVerify,
  onCopyHash,
}: {
  snap: ImmutableSnapshotV2;
  verify: { ok: boolean; expected: string; actual: string } | undefined;
  copied: boolean;
  onVerify: () => void;
  onCopyHash: () => void;
}) {
  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="rounded-md border bg-muted/20 p-3 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-semibold">{snap.snapshot_id}</span>
            <Badge variant="outline" className="text-[10px]">
              v{snap.version}
            </Badge>
            <Badge variant="secondary" className="text-[10px]">
              {snap.architecture_status}
            </Badge>
          </div>
          <div className="text-[11px] text-muted-foreground">
            {new Date(snap.created_at).toLocaleString()} · {snap.source}
          </div>
        </div>

        {/* Integrity hash */}
        <div className="mt-3 rounded border bg-card px-2 py-1.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
              <Hash className="h-3 w-3" />
              integrity_hash
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-1.5"
                onClick={onCopyHash}
                title="Copy hash"
              >
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              </Button>
              <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]" onClick={onVerify}>
                Verify
              </Button>
            </div>
          </div>
          <div className="break-all font-mono text-[11px]">{snap.integrity_hash}</div>
          {verify && (
            <div
              className={`mt-1 inline-flex items-center gap-1 text-[11px] ${
                verify.ok ? "text-foreground" : "text-destructive"
              }`}
            >
              {verify.ok ? (
                <>
                  <ShieldCheck className="h-3 w-3" /> integrity verified
                </>
              ) : (
                <>
                  <ShieldAlert className="h-3 w-3" /> tamper detected — actual {verify.actual.slice(0, 12)}…
                </>
              )}
            </div>
          )}
        </div>

        {/* Counts */}
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Files" value={snap.file_count} />
          <Stat label="Routes" value={snap.route_count} />
          <Stat label="Edges" value={snap.dependency_graph.edges_count} />
          <Stat label="Cycles" value={snap.dependency_graph.cycles_count} />
          <Stat label="Isolated" value={snap.dependency_graph.isolated_count} />
          <Stat label="Violations" value={snap.architecture_violation_count} />
          <Stat label="Components" value={snap.file_types.component ?? 0} />
          <Stat label="Pages" value={snap.file_types.page ?? 0} />
        </div>
      </div>

      {/* Section: Files */}
      <Section icon={<FileText className="h-3 w-3" />} title={`File list (${snap.file_count})`}>
        <ScrollList items={snap.files.slice(0, 500)} mono />
        {snap.files.length > 500 && (
          <div className="px-3 py-1 text-[10px] text-muted-foreground">
            … {snap.files.length - 500} more files (truncated)
          </div>
        )}
      </Section>

      {/* Section: Dependency graph */}
      <Section
        icon={<GitBranch className="h-3 w-3" />}
        title={`Dependency graph (${snap.dependency_graph.edges_count} edges · ${snap.dependency_graph.cycles_count} cycles · ${snap.dependency_graph.isolated_count} isolated)`}
      >
        {snap.dependency_graph.cycles_count > 0 && (
          <div className="border-b bg-destructive/5 px-3 py-1.5 text-[11px]">
            <span className="font-medium text-destructive">Cycles:</span>{" "}
            <span className="text-muted-foreground">
              {snap.dependency_graph.cycles
                .slice(0, 5)
                .map((c) => c.join(" → "))
                .join("  |  ")}
            </span>
          </div>
        )}
        {snap.dependency_graph.isolated_count > 0 && (
          <div className="border-b px-3 py-1.5 text-[11px] text-muted-foreground">
            Isolated: {snap.dependency_graph.isolated.slice(0, 12).join(", ")}
            {snap.dependency_graph.isolated_count > 12 && " …"}
          </div>
        )}
        <ScrollList
          items={snap.dependency_graph.edges
            .slice(0, 200)
            .map(([a, b]) => `${a} → ${b}`)}
          mono
        />
        {snap.dependency_graph.edges_count > 200 && (
          <div className="px-3 py-1 text-[10px] text-muted-foreground">
            … {snap.dependency_graph.edges_count - 200} more edges (truncated)
          </div>
        )}
      </Section>

      {/* Section: Routes */}
      <Section icon={<MapIcon className="h-3 w-3" />} title={`Route registry (${snap.route_count})`}>
        <ScrollList
          items={snap.route_registry.map(
            (r) => `${r.path}  ·  ${r.element}  ·  ${r.area}  ·  ${r.file}`
          )}
          mono
        />
      </Section>

      {/* Section: Violations */}
      <Section
        icon={<AlertOctagon className="h-3 w-3" />}
        title={`Architecture violations (${snap.architecture_violation_count})`}
      >
        {snap.architecture_violations.length === 0 ? (
          <div className="px-3 py-3 text-center text-[11px] text-muted-foreground">
            No violations recorded.
          </div>
        ) : (
          <ul className="max-h-56 divide-y overflow-auto text-[11px]">
            {snap.architecture_violations.map((v, i) => (
              <li key={i} className="grid grid-cols-[80px_1fr] gap-2 px-3 py-1.5">
                <Badge
                  variant={
                    v.severity === "critical" || v.severity === "error"
                      ? "destructive"
                      : "outline"
                  }
                  className="self-start text-[10px]"
                >
                  {v.severity}
                </Badge>
                <div>
                  <div className="font-mono text-foreground">{v.rule}</div>
                  <div className="text-muted-foreground">{v.message}</div>
                  {v.source && (
                    <div className="font-mono text-[10px] text-muted-foreground">{v.source}</div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>
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

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <details className="rounded-md border bg-card">
      <summary className="flex cursor-pointer items-center gap-1.5 border-b px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground hover:bg-muted/40">
        {icon}
        {title}
      </summary>
      <div className="text-xs">{children}</div>
    </details>
  );
}

function ScrollList({ items, mono = false }: { items: ReadonlyArray<string>; mono?: boolean }) {
  if (items.length === 0) {
    return (
      <div className="px-3 py-3 text-center text-[11px] text-muted-foreground">
        (empty)
      </div>
    );
  }
  return (
    <ul className={`max-h-56 divide-y overflow-auto ${mono ? "font-mono" : ""}`}>
      {items.map((it, i) => (
        <li key={i} className="px-3 py-1 text-[11px]">
          {it}
        </li>
      ))}
    </ul>
  );
}
