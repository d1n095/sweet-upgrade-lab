/**
 * PATTERN MEMORY PANEL
 *
 * Read-only view of historical architecture patterns: top-connected files,
 * repeated violations, stable structures, and frequently moved files. The
 * engine stores raw counts only — this panel renders them without scoring.
 */
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Brain,
  History as HistoryIcon,
  GitBranch,
  AlertOctagon,
  Anchor,
  Move,
  Camera,
} from "lucide-react";
import {
  patternMemory,
  type PatternMemoryEntry,
} from "@/core/scanner/patternMemory";
import { versionedArchitectureStore } from "@/core/scanner/versionedArchitectureStore";

export function PatternMemoryPanel() {
  const [state, setState] = useState(() => patternMemory.getState());
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);

  useEffect(() => {
    const tick = () => setState(patternMemory.getState());
    return patternMemory.subscribe(tick);
  }, []);

  useEffect(() => {
    if (!selectedVersionId && state.entries[0]) {
      setSelectedVersionId(state.entries[0].version_id);
    }
  }, [state.entries, selectedVersionId]);

  const selected: PatternMemoryEntry | null = useMemo(
    () =>
      state.entries.find((e) => e.version_id === selectedVersionId) ??
      state.entries[0] ??
      null,
    [state.entries, selectedVersionId]
  );

  const onObserveCurrent = () => {
    const v = versionedArchitectureStore.getState().current;
    if (!v) return;
    patternMemory.observe(v);
    setSelectedVersionId(v.version_id);
  };

  const currentVersion = versionedArchitectureStore.getState().current;
  const canObserve =
    !!currentVersion && !state.entries.some((e) => e.version_id === currentVersion.version_id);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Brain className="h-4 w-4" />
            Pattern Memory
            <Badge variant="outline" className="ml-1 font-mono text-[10px]">
              NO INTERPRETATION
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-[10px]">
              observations: {state.total_observations}
            </Badge>
            {state.duplicate_observations > 0 && (
              <Badge variant="outline" className="text-[10px]">
                deduped: {state.duplicate_observations}
              </Badge>
            )}
            <Button
              size="sm"
              onClick={onObserveCurrent}
              disabled={!canObserve}
              className="h-7"
              title={
                !currentVersion
                  ? "No committed architecture version yet."
                  : !canObserve
                    ? "Current version already observed."
                    : `Observe ${currentVersion.version_id}`
              }
            >
              <Camera className="mr-1 h-3 w-3" />
              Observe current
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {state.total_observations === 0 ? (
          <div className="rounded-md border border-dashed bg-muted/30 px-3 py-6 text-center text-xs text-muted-foreground">
            No observations yet. Pattern Memory records one entry per committed architecture
            version. Run the deterministic build pipeline (or click{" "}
            <span className="font-medium">Observe current</span>) to populate it.
          </div>
        ) : (
          <>
            {/* Headline counters */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="Observations" value={state.total_observations} />
              <Stat label="Stable files" value={state.stable_files.length} />
              <Stat label="Repeated violations" value={state.repeated_violations.length} />
              <Stat label="Moved files" value={state.frequently_moved_files.length} />
            </div>

            <div className="grid gap-3 lg:grid-cols-[220px_1fr]">
              {/* Per-version list */}
              <div className="rounded-md border bg-card">
                <div className="flex items-center gap-1.5 border-b px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  <HistoryIcon className="h-3 w-3" />
                  History
                </div>
                <ul className="max-h-96 divide-y overflow-auto">
                  {state.entries.map((e) => (
                    <li key={e.version_id}>
                      <button
                        type="button"
                        onClick={() => setSelectedVersionId(e.version_id)}
                        className={`w-full px-3 py-2 text-left text-xs transition-colors hover:bg-muted/40 ${
                          selected?.version_id === e.version_id ? "bg-muted/60" : ""
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-[11px] font-semibold">
                            {e.version_id}
                          </span>
                          <Badge variant="outline" className="text-[10px]">
                            score {e.architecture_score}
                          </Badge>
                        </div>
                        <div className="mt-0.5 flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
                          <span>{new Date(e.observed_at).toLocaleString()}</span>
                          <span className="font-mono">
                            {e.top_connected.length}/{e.violations.length}
                          </span>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Per-version detail */}
              {selected && <EntryDetail entry={selected} />}
            </div>

            {/* Stable patterns */}
            <Section
              icon={<Anchor className="h-3 w-3" />}
              title={`Stable structures — files present in EVERY observation (${state.stable_files.length})`}
            >
              <ScrollList items={state.stable_files} mono cap={300} />
            </Section>

            {/* Repeated violations */}
            <Section
              icon={<AlertOctagon className="h-3 w-3" />}
              title={`Repeated violations (${state.repeated_violations.length})`}
            >
              {state.repeated_violations.length === 0 ? (
                <Empty>No violations recorded across observations.</Empty>
              ) : (
                <ul className="max-h-56 divide-y overflow-auto text-[11px]">
                  {state.repeated_violations.slice(0, 100).map((r) => (
                    <li
                      key={r.key}
                      className="grid grid-cols-[60px_120px_1fr_auto] items-center gap-2 px-3 py-1.5"
                    >
                      <Badge variant="outline" className="justify-self-start text-[10px]">
                        ×{r.occurrences}
                      </Badge>
                      <span className="font-mono text-[11px]">{r.rule}</span>
                      <span className="truncate font-mono text-[11px] text-muted-foreground">
                        {r.file}
                      </span>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {r.versions.slice(0, 4).join(",")}
                        {r.versions.length > 4 ? "…" : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            {/* Frequently moved */}
            <Section
              icon={<Move className="h-3 w-3" />}
              title={`Frequently moved files (${state.frequently_moved_files.length})`}
            >
              {state.frequently_moved_files.length === 0 ? (
                <Empty>No file kind changes recorded across observations.</Empty>
              ) : (
                <ul className="max-h-56 divide-y overflow-auto text-[11px]">
                  {state.frequently_moved_files.slice(0, 100).map((f) => (
                    <li
                      key={f.file}
                      className="grid grid-cols-[60px_1fr_auto] items-start gap-2 px-3 py-1.5"
                    >
                      <Badge variant="outline" className="justify-self-start text-[10px]">
                        ×{f.moves}
                      </Badge>
                      <span className="truncate font-mono text-[11px]">{f.file}</span>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {f.history
                          .slice(-3)
                          .map((h) => `${h.from}→${h.to}@${h.at_version}`)
                          .join(" · ")}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            {/* Repeated top-connected */}
            <Section
              icon={<GitBranch className="h-3 w-3" />}
              title={`Recurring top-connected files (${state.repeated_top_connected.length})`}
            >
              {state.repeated_top_connected.length === 0 ? (
                <Empty>No top-connected files recorded yet.</Empty>
              ) : (
                <ul className="max-h-56 divide-y overflow-auto text-[11px]">
                  {state.repeated_top_connected.slice(0, 50).map((r) => (
                    <li
                      key={r.file}
                      className="grid grid-cols-[60px_1fr_auto] items-center gap-2 px-3 py-1.5"
                    >
                      <Badge variant="outline" className="justify-self-start text-[10px]">
                        ×{r.appearances}
                      </Badge>
                      <span className="truncate font-mono text-[11px]">{r.file}</span>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        avg coupling {r.avg_coupling}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </>
        )}

        <p className="text-[11px] text-muted-foreground">
          Pattern Memory only stores raw counts and lists across versions. It performs no scoring,
          no ranking decisions, and no interpretation — judgment is left to the operator.
        </p>
      </CardContent>
    </Card>
  );
}

function EntryDetail({ entry }: { entry: PatternMemoryEntry }) {
  return (
    <div className="space-y-3">
      <div className="rounded-md border bg-muted/20 p-3 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-semibold">{entry.version_id}</span>
            <Badge variant="outline" className="text-[10px]">
              v{entry.version_number}
            </Badge>
            <Badge variant="secondary" className="text-[10px]">
              score {entry.architecture_score}
            </Badge>
          </div>
          <div className="text-[11px] text-muted-foreground">
            {new Date(entry.observed_at).toLocaleString()} · {entry.file_set_size} files
          </div>
        </div>
      </div>

      <div className="rounded-md border bg-card">
        <div className="flex items-center gap-1.5 border-b px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          <GitBranch className="h-3 w-3" />
          Top 10 most connected
        </div>
        {entry.top_connected.length === 0 ? (
          <Empty>No coupling data captured.</Empty>
        ) : (
          <ul className="divide-y text-[11px]">
            {entry.top_connected.map((t) => (
              <li
                key={t.file}
                className="grid grid-cols-[60px_1fr_auto] items-center gap-2 px-3 py-1.5"
              >
                <Badge variant="outline" className="justify-self-start text-[10px]">
                  {t.coupling_score}
                </Badge>
                <span className="truncate font-mono">{t.file}</span>
                <span className="font-mono text-[10px] text-muted-foreground">{t.kind}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-md border bg-card">
        <div className="flex items-center gap-1.5 border-b px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          <AlertOctagon className="h-3 w-3" />
          Violations in this version ({entry.violations.length})
        </div>
        {entry.violations.length === 0 ? (
          <Empty>No violations recorded.</Empty>
        ) : (
          <ul className="max-h-40 divide-y overflow-auto text-[11px]">
            {entry.violations.map((v, i) => (
              <li
                key={i}
                className="grid grid-cols-[80px_1fr_auto] items-center gap-2 px-3 py-1.5"
              >
                <Badge variant="outline" className="justify-self-start text-[10px]">
                  {v.rule}
                </Badge>
                <span className="truncate font-mono">{v.file}</span>
                <span className="font-mono text-[10px] text-muted-foreground">
                  L{v.line_hint}
                </span>
              </li>
            ))}
          </ul>
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
    <details className="rounded-md border bg-card" open>
      <summary className="flex cursor-pointer items-center gap-1.5 border-b px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground hover:bg-muted/40">
        {icon}
        {title}
      </summary>
      <div className="text-xs">{children}</div>
    </details>
  );
}

function ScrollList({
  items,
  mono = false,
  cap = 200,
}: {
  items: ReadonlyArray<string>;
  mono?: boolean;
  cap?: number;
}) {
  if (items.length === 0) {
    return <Empty>(empty)</Empty>;
  }
  return (
    <ul className={`max-h-56 divide-y overflow-auto ${mono ? "font-mono" : ""}`}>
      {items.slice(0, cap).map((it, i) => (
        <li key={i} className="px-3 py-1 text-[11px]">
          {it}
        </li>
      ))}
      {items.length > cap && (
        <li className="px-3 py-1 text-[10px] text-muted-foreground">
          … {items.length - cap} more (truncated)
        </li>
      )}
    </ul>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 py-3 text-center text-[11px] text-muted-foreground">{children}</div>
  );
}
