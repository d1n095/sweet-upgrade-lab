/**
 * DEVOS — full-screen developer operating system UI.
 *
 * RULE: every panel reads from the System State Registry, Command Layer log,
 *       Super Control mode store, or static fileSystemMap. Zero local UI state
 *       beyond hover/expand affordances and the pending command input buffer.
 *
 * Layout:
 *   ┌─ TopBar ─ command input · mode switcher · god overlay toggle ───────┐
 *   │                                                                     │
 *   │  ┌─ Left ──────────┐ ┌─ Center ───────────────┐ ┌─ Right ─────────┐ │
 *   │  │ FileTree        │ │ CodeView (live source) │ │ Health score    │ │
 *   │  │ Cluster list    │ │ Dependency highlights  │ │ Pipeline stages │ │
 *   │  │                 │ │                        │ │ Alerts          │ │
 *   │  └─────────────────┘ └────────────────────────┘ └─────────────────┘ │
 *   │  ┌─ Bottom: Failure Simulation Panel ──────────────────────────────┐│
 *   └────────────────────────────────────────────────────────────────────┘
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useSyncExternalStore } from "react";
import { systemStateRegistry } from "@/core/scanner/systemStateRegistry";
import { useCommandLayerStore } from "@/core/scanner/commandLayer";
import { useSuperControlStore, applyMode, SUPER_MODES, type SuperMode } from "@/core/scanner/superControl";
import { fileSystemMap, getFileContent } from "@/lib/fileSystemMap";
// blackboxHardening is not present in this project; derive a lightweight security report locally.
function getSecurityReport() {
  const snap = systemStateRegistry.snapshot();
  const invalid = snap.invalid_states.length;
  const integrity_score = Math.max(0, 100 - invalid * 10);
  return {
    integrity_score,
    security_status: invalid === 0 ? "SECURE" : invalid < 3 ? "DEGRADED" : "BLOCKED",
    detected_tampering: snap.invalid_states.map((i, idx) => ({
      id: `inv-${idx}`,
      kind: i.state_key,
      detail: i.reason,
    })),
  };
}
import { runFailureSimulation } from "@/core/evolution/failureSimulation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff, Cpu, Activity, AlertTriangle, FolderTree, Network, Play, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/*  External-store hooks (registry + command layer subscriptions)              */
/* -------------------------------------------------------------------------- */

function useRegistrySnapshot() {
  return useSyncExternalStore(
    (cb) => systemStateRegistry.subscribe(cb),
    () => systemStateRegistry.snapshot(),
    () => systemStateRegistry.snapshot(),
  );
}

/* -------------------------------------------------------------------------- */
/*  Derived data — purely from registry / fileSystemMap                       */
/* -------------------------------------------------------------------------- */

interface TreeNode {
  name: string;
  path: string;
  isFile: boolean;
  children: TreeNode[];
}

function buildTree(): TreeNode {
  const root: TreeNode = { name: "src", path: "", isFile: false, children: [] };
  for (const f of fileSystemMap) {
    const parts = f.path.replace(/^\/?src\//, "").split("/");
    let cur = root;
    for (let i = 0; i < parts.length; i++) {
      const isFile = i === parts.length - 1;
      let next = cur.children.find((c) => c.name === parts[i]);
      if (!next) {
        next = {
          name: parts[i],
          path: parts.slice(0, i + 1).join("/"),
          isFile,
          children: [],
        };
        cur.children.push(next);
      }
      cur = next;
    }
  }
  // sort: folders first, then files, alpha
  const sortNode = (n: TreeNode) => {
    n.children.sort((a, b) => (a.isFile === b.isFile ? a.name.localeCompare(b.name) : a.isFile ? 1 : -1));
    n.children.forEach(sortNode);
  };
  sortNode(root);
  return root;
}

function buildClusters(): Array<{ name: string; count: number; files: string[] }> {
  const map = new Map<string, string[]>();
  for (const f of fileSystemMap) {
    const folder = f.folder.replace(/^\/?src\/?/, "") || "root";
    const top = folder.split("/")[0];
    if (!map.has(top)) map.set(top, []);
    map.get(top)!.push(f.path);
  }
  return [...map.entries()]
    .map(([name, files]) => ({ name, count: files.length, files }))
    .sort((a, b) => b.count - a.count);
}

/* -------------------------------------------------------------------------- */
/*  Sub-panels                                                                */
/* -------------------------------------------------------------------------- */

function FileTreeNode({
  node,
  selected,
  onSelect,
  depth = 0,
}: {
  node: TreeNode;
  selected: string;
  onSelect: (p: string) => void;
  depth?: number;
}) {
  const [open, setOpen] = useState(depth < 1);
  if (node.isFile) {
    const isActive = selected === node.path;
    return (
      <button
        type="button"
        onClick={() => onSelect(node.path)}
        className={cn(
          "flex w-full items-center gap-1 px-2 py-0.5 text-left font-mono text-xs hover:bg-muted/50",
          isActive && "bg-primary/10 text-primary",
        )}
        style={{ paddingLeft: 8 + depth * 12 }}
      >
        <span className="truncate">{node.name}</span>
      </button>
    );
  }
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1 px-2 py-0.5 text-left font-mono text-xs text-muted-foreground hover:bg-muted/50"
        style={{ paddingLeft: 8 + depth * 12 }}
      >
        <span className="opacity-50">{open ? "▾" : "▸"}</span>
        <span className="truncate font-medium text-foreground">{node.name}</span>
      </button>
      {open && node.children.map((c) => (
        <FileTreeNode key={c.path} node={c} selected={selected} onSelect={onSelect} depth={depth + 1} />
      ))}
    </div>
  );
}

function LeftPanel({
  selectedFile,
  onSelectFile,
  selectedCluster,
  onSelectCluster,
}: {
  selectedFile: string;
  onSelectFile: (p: string) => void;
  selectedCluster: string | null;
  onSelectCluster: (c: string | null) => void;
}) {
  const tree = useMemo(buildTree, []);
  const clusters = useMemo(buildClusters, []);

  return (
    <aside className="flex h-full flex-col border-r border-border bg-card/50">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <FolderTree className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">File tree</span>
        <Badge variant="secondary" className="ml-auto text-[10px]">{fileSystemMap.length} files</Badge>
      </div>
      <ScrollArea className="flex-1 min-h-0">
        <div className="py-1">
          {tree.children.map((c) => (
            <FileTreeNode key={c.path} node={c} selected={selectedFile} onSelect={onSelectFile} />
          ))}
        </div>
      </ScrollArea>

      <div className="flex items-center gap-2 border-y border-border px-3 py-2">
        <Network className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Clusters</span>
        <Badge variant="secondary" className="ml-auto text-[10px]">{clusters.length}</Badge>
      </div>
      <ScrollArea className="h-48">
        <div className="space-y-1 p-2">
          {clusters.map((c) => {
            const active = selectedCluster === c.name;
            return (
              <button
                key={c.name}
                type="button"
                onClick={() => onSelectCluster(active ? null : c.name)}
                className={cn(
                  "flex w-full items-center justify-between rounded px-2 py-1 text-xs hover:bg-muted/50",
                  active && "bg-primary/10 text-primary",
                )}
              >
                <span className="font-mono truncate">{c.name}</span>
                <Badge variant="outline" className="ml-2 text-[10px]">{c.count}</Badge>
              </button>
            );
          })}
        </div>
      </ScrollArea>
    </aside>
  );
}

function CenterPanel({
  selectedFile,
  selectedCluster,
}: {
  selectedFile: string;
  selectedCluster: string | null;
}) {
  const content = useMemo(() => (selectedFile ? getFileContent(selectedFile) : null), [selectedFile]);
  const fileEntry = useMemo(
    () => fileSystemMap.find((f) => f.path === selectedFile || f.path === "/" + selectedFile),
    [selectedFile],
  );
  const dependencies = fileEntry?.used_in ?? [];
  const clusterFiles = useMemo(
    () => (selectedCluster ? buildClusters().find((c) => c.name === selectedCluster)?.files ?? [] : []),
    [selectedCluster],
  );

  return (
    <section className="flex h-full min-w-0 flex-1 flex-col bg-background">
      <div className="flex items-center gap-2 border-b border-border bg-card/30 px-3 py-2">
        <Cpu className="h-4 w-4 text-muted-foreground" />
        <span className="truncate font-mono text-xs text-foreground">
          {selectedFile || "no file selected"}
        </span>
        {fileEntry && (
          <Badge variant="outline" className="ml-2 text-[10px]">{fileEntry.type}</Badge>
        )}
      </div>

      <div className="flex min-h-0 flex-1">
        <ScrollArea className="flex-1 min-w-0">
          <pre className="p-4 font-mono text-[11px] leading-relaxed text-foreground whitespace-pre-wrap break-words">
            {content ?? "// Select a file from the tree to view its source."}
          </pre>
        </ScrollArea>

        <aside className="w-64 shrink-0 border-l border-border bg-card/30">
          <div className="border-b border-border px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Dependency chain
          </div>
          <ScrollArea className="h-[40vh]">
            <div className="space-y-1 p-2">
              {dependencies.length === 0 && (
                <p className="px-2 py-4 text-xs text-muted-foreground">No outbound dependencies tracked.</p>
              )}
              {dependencies.map((d) => (
                <div key={d} className="rounded bg-muted/40 px-2 py-1 font-mono text-[11px]">{d}</div>
              ))}
            </div>
          </ScrollArea>
          {selectedCluster && (
            <>
              <div className="border-y border-border px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Cluster: {selectedCluster}
              </div>
              <ScrollArea className="h-[30vh]">
                <div className="space-y-1 p-2">
                  {clusterFiles.slice(0, 50).map((f) => (
                    <div key={f} className="truncate rounded px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                      {f}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </>
          )}
        </aside>
      </div>
    </section>
  );
}

function RightPanel() {
  const snapshot = useRegistrySnapshot();
  const security = useMemo(getSecurityReport, [snapshot.total_records]);
  const log = useCommandLayerStore((s) => s.log);
  const recentStages = log.slice(0, 8);

  const archStatus = snapshot.current_state_snapshot.architecture_status;
  const score =
    typeof (archStatus?.value as { score?: number })?.score === "number"
      ? (archStatus!.value as { score: number }).score
      : security.integrity_score;

  return (
    <aside className="flex h-full w-80 shrink-0 flex-col border-l border-border bg-card/50">
      <div className="border-b border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Consciousness
          </span>
        </div>
      </div>

      <div className="border-b border-border px-4 py-4">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Health score</p>
        <p className="mt-1 text-4xl font-bold text-foreground tabular-nums">{score}</p>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full transition-all",
              score >= 80 ? "bg-primary" : score >= 50 ? "bg-secondary" : "bg-destructive",
            )}
            style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
          />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
          <div className="rounded bg-muted/40 px-2 py-1">
            <p className="text-muted-foreground">Records</p>
            <p className="font-mono text-foreground">{snapshot.total_records}</p>
          </div>
          <div className="rounded bg-muted/40 px-2 py-1">
            <p className="text-muted-foreground">Invalid</p>
            <p className="font-mono text-foreground">{snapshot.invalid_states.length}</p>
          </div>
          <div className="rounded bg-muted/40 px-2 py-1">
            <p className="text-muted-foreground">Security</p>
            <p className="font-mono text-foreground">{security.security_status}</p>
          </div>
          <div className="rounded bg-muted/40 px-2 py-1">
            <p className="text-muted-foreground">Tampers</p>
            <p className="font-mono text-foreground">{security.detected_tampering.length}</p>
          </div>
        </div>
      </div>

      <div className="border-b border-border px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pipeline</span>
      </div>
      <ScrollArea className="max-h-56">
        <ol className="space-y-1 p-2">
          {recentStages.length === 0 && (
            <li className="px-2 py-2 text-[11px] text-muted-foreground">No commands dispatched yet.</li>
          )}
          {recentStages.map((s) => (
            <li
              key={s.id}
              className={cn(
                "flex items-center gap-2 rounded border px-2 py-1 text-[11px]",
                s.status === "ok" && "border-primary/30 bg-primary/5",
                s.status === "error" && "border-destructive/40 bg-destructive/5",
                s.status === "pending" && "border-secondary bg-secondary/30",
              )}
            >
              <span className="h-2 w-2 shrink-0 rounded-full bg-current opacity-60" />
              <span className="truncate font-mono">{s.name}</span>
              <span className="ml-auto text-[10px] uppercase opacity-70">{s.status}</span>
            </li>
          ))}
        </ol>
      </ScrollArea>

      <div className="border-y border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Alerts</span>
        </div>
      </div>
      <ScrollArea className="flex-1 min-h-0">
        <ul className="space-y-1 p-2">
          {snapshot.invalid_states.length === 0 && security.detected_tampering.length === 0 && (
            <li className="px-2 py-2 text-[11px] text-muted-foreground">All clear.</li>
          )}
          {snapshot.invalid_states.slice(0, 10).map((i, idx) => (
            <li key={`inv-${idx}`} className="rounded bg-destructive/10 px-2 py-1 text-[11px]">
              <span className="font-mono">{i.state_key}</span> · {i.reason}
            </li>
          ))}
          {security.detected_tampering.slice(0, 10).map((t) => (
            <li key={t.id} className="rounded bg-secondary/40 px-2 py-1 text-[11px]">
              <span className="font-mono">{t.kind}</span> · {t.detail}
            </li>
          ))}
        </ul>
      </ScrollArea>
    </aside>
  );
}

function FailureSimulationPanel() {
  const [report, setReport] = useState<ReturnType<typeof runFailureSimulation> | null>(null);

  const run = () => {
    const sample = fileSystemMap.slice(0, 20).map((f) => f.path);
    const dependency_graph: Record<string, string[]> = {};
    for (let i = 0; i < sample.length - 1; i++) {
      dependency_graph[sample[i]] = [sample[i + 1]];
    }
    const r = runFailureSimulation({
      dependency_graph,
      cluster_map: { core: sample },
      route_map: {},
      architecture_rules: [{ id: "layered_imports", enabled: true }],
      scenarios: [
        { id: "node-fail-1", type: "NODE_FAILURE", target: sample[0], description: "Remove root module" },
        {
          id: "dep-break-1",
          type: "DEPENDENCY_BREAK",
          edge: { from: sample[1], to: sample[2] },
          description: "Break first dependency",
        },
      ],
    });
    setReport(r);
  };

  const aggImpact = report
    ? Math.round(
        report.simulation_results.reduce((s, r) => s + r.failure_impact_score, 0) /
          Math.max(1, report.simulation_results.length),
      )
    : 0;
  const aggResilience = report
    ? Math.round(
        report.simulation_results.reduce((s, r) => s + r.resilience_score, 0) /
          Math.max(1, report.simulation_results.length),
      )
    : 0;

  return (
    <section className="border-t border-border bg-card/30">
      <div className="flex items-center gap-3 px-4 py-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Failure simulation
        </span>
        <Button size="sm" variant="outline" onClick={run} className="h-7 gap-1 text-xs">
          <Play className="h-3 w-3" /> Run stress test
        </Button>
        {report && (
          <span className="text-[11px] text-muted-foreground">
            impact <span className="font-mono text-foreground">{aggImpact}</span> · resilience{" "}
            <span className="font-mono text-foreground">{aggResilience}</span>
          </span>
        )}
      </div>
      {report && (
        <ScrollArea className="max-h-40 border-t border-border">
          <div className="grid grid-cols-1 gap-2 p-3 md:grid-cols-2">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Weak points</p>
              <ul className="mt-1 space-y-0.5">
                {report.weak_points.slice(0, 6).map((w) => (
                  <li key={w.node} className="font-mono text-[11px]">
                    {w.node} <span className="text-muted-foreground">· {w.reason}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Mitigations</p>
              <ul className="mt-1 space-y-0.5 text-[11px]">
                {report.mitigation_suggestions.slice(0, 6).map((m, i) => (
                  <li key={i}><span className="font-mono">{m.action}</span> — {m.rationale}</li>
                ))}
              </ul>
            </div>
          </div>
        </ScrollArea>
      )}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  TopBar                                                                    */
/* -------------------------------------------------------------------------- */

function TopBar({
  godVisible,
  setGodVisible,
}: {
  godVisible: boolean;
  setGodVisible: (v: boolean) => void;
}) {
  const navigate = useNavigate();
  const mode = useSuperControlStore((s) => s.active_mode);
  const [cmd, setCmd] = useState("");
  const [result, setResult] = useState<string | null>(null);

  const exec = async () => {
    const trimmed = cmd.trim();
    if (!trimmed) return;
    const fn = (window as Window & typeof globalThis).__godmode as Record<string, unknown> | undefined;
    if (!fn) {
      setResult("__godmode not available");
      return;
    }
    try {
      const handler = fn[trimmed] as (() => Promise<unknown>) | undefined;
      if (typeof handler !== "function") {
        setResult(`unknown command "${trimmed}" — try: status, registry, modeStatus, securityReport`);
        return;
      }
      const r = await handler();
      setResult(typeof r === "string" ? r : JSON.stringify(r).slice(0, 160));
      setCmd("");
    } catch (e) {
      setResult(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <header className="flex flex-col border-b border-border bg-card/70 backdrop-blur">
      <div className="flex items-center gap-2 px-3 py-2">
        <Button variant="ghost" size="sm" onClick={() => navigate("/admin")} className="h-7 gap-1 text-xs">
          <ArrowLeft className="h-3 w-3" /> Admin
        </Button>
        <span className="font-mono text-xs font-bold tracking-wider text-primary">DEVOS</span>
        <Badge variant="outline" className="text-[10px]">mode: {mode}</Badge>

        <div className="ml-3 flex flex-1 items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground">$</span>
          <Input
            value={cmd}
            onChange={(e) => setCmd(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && exec()}
            placeholder="command (e.g. status, registry, modeStatus, securityReport)"
            className="h-7 flex-1 bg-background font-mono text-xs"
          />
          <Button size="sm" onClick={exec} className="h-7 text-xs">Run</Button>
        </div>

        <div className="flex items-center gap-1">
          {SUPER_MODES.map((m) => (
            <Button
              key={m}
              size="sm"
              variant={mode === m ? "default" : "ghost"}
              className="h-7 px-2 text-[10px]"
              onClick={() => applyMode(m as SuperMode)}
            >
              {m}
            </Button>
          ))}
        </div>

        <Button
          size="sm"
          variant={godVisible ? "default" : "outline"}
          onClick={() => setGodVisible(!godVisible)}
          className="ml-2 h-7 gap-1 text-xs"
        >
          {godVisible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
          God overlay
        </Button>
      </div>
      {result && (
        <div className="border-t border-border bg-muted/30 px-3 py-1 font-mono text-[11px] text-muted-foreground">
          → {result}
        </div>
      )}
    </header>
  );
}

/* -------------------------------------------------------------------------- */
/*  Page shell                                                                */
/* -------------------------------------------------------------------------- */

export default function DevOS() {
  const [selectedFile, setSelectedFile] = useState<string>("");
  const [selectedCluster, setSelectedCluster] = useState<string | null>(null);
  const [godVisible, setGodVisible] = useState(true);

  // Force the top-level overlay to honor the toggle by writing a body class —
  // the GodModeOverlay reads its own visibility but we hide it visually here.
  useEffect(() => {
    document.body.classList.toggle("devos-hide-god-overlay", !godVisible);
    return () => document.body.classList.remove("devos-hide-god-overlay");
  }, [godVisible]);

  return (
    <>
      <Helmet>
        <title>DevOS — system command surface</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <style>{`.devos-hide-god-overlay [data-godmode-overlay]{display:none!important}`}</style>
      <div className="flex h-screen w-full flex-col overflow-hidden bg-background text-foreground">
        <TopBar godVisible={godVisible} setGodVisible={setGodVisible} />
        <div className="flex min-h-0 flex-1">
          <div className="w-72 shrink-0">
            <LeftPanel
              selectedFile={selectedFile}
              onSelectFile={setSelectedFile}
              selectedCluster={selectedCluster}
              onSelectCluster={setSelectedCluster}
            />
          </div>
          <CenterPanel selectedFile={selectedFile} selectedCluster={selectedCluster} />
          <RightPanel />
        </div>
        <FailureSimulationPanel />
      </div>
    </>
  );
}
