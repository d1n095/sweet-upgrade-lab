/**
 * GOD MODE UI OVERLAY
 *
 * Read-only, fixed top layer (z-index max). Toggle with CTRL+SHIFT+G.
 * Pure subscription to systemStateStore + systemStateRegistry.
 * Never writes, never mutates, never affects app logic.
 *
 * Missing data → "UNKNOWN". No synthetic values.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useSystemStateStore, type ModuleKey } from "@/stores/systemStateStore";
import { systemStateRegistry, type RegistrySnapshot } from "@/core/scanner/systemStateRegistry";
import { useStealthStore } from "@/core/scanner/stealthMode";
import { useCommandLayerStore } from "@/core/scanner/commandLayer";
import { useAdminRole } from "@/hooks/useAdminRole";

type PanelId = "system" | "heatmap" | "clusters" | "execution" | "reality" | "command";

interface PanelPos {
  x: number;
  y: number;
}

const DEFAULT_POS: Record<PanelId, PanelPos> = {
  system: { x: 16, y: 16 },
  heatmap: { x: 360, y: 16 },
  clusters: { x: 704, y: 16 },
  execution: { x: 16, y: 280 },
  reality: { x: 360, y: 280 },
  command: { x: 704, y: 280 },
};

const PANEL_LABELS: Record<PanelId, string> = {
  system: "SYSTEM STATE",
  heatmap: "DEPENDENCY HEATMAP",
  clusters: "CLUSTER VIEW",
  execution: "EXECUTION FLOW",
  reality: "REALITY CHECK",
  command: "COMMAND LAYER",
};

function useRegistrySnapshot(): RegistrySnapshot {
  const [snap, setSnap] = useState<RegistrySnapshot>(() => systemStateRegistry.snapshot());
  useEffect(() => {
    return systemStateRegistry.subscribe(() => setSnap(systemStateRegistry.snapshot()));
  }, []);
  return snap;
}

function fmt(v: unknown): string {
  if (v === null || v === undefined) return "UNKNOWN";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "UNKNOWN";
  if (typeof v === "string") return v.length > 0 ? v : "UNKNOWN";
  try {
    return JSON.stringify(v);
  } catch {
    return "UNKNOWN";
  }
}

function healthColor(h: string): string {
  switch (h) {
    case "ok":
      return "bg-emerald-500";
    case "degraded":
      return "bg-amber-500";
    case "error":
      return "bg-red-500";
    case "empty":
    default:
      return "bg-zinc-600";
  }
}

export default function GodModeOverlay() {
  const { isAdmin } = useAdminRole();
  const [open, setOpen] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [positions, setPositions] = useState<Record<PanelId, PanelPos>>(() => {
    try {
      const raw = localStorage.getItem("godmode_positions_v1");
      if (raw) return { ...DEFAULT_POS, ...JSON.parse(raw) };
    } catch {}
    return DEFAULT_POS;
  });
  const [hoverFile, setHoverFile] = useState<string | null>(null);
  const [openChain, setOpenChain] = useState<string | null>(null);
  const dragRef = useRef<{ id: PanelId; offX: number; offY: number } | null>(null);

  const slots = useSystemStateStore((s) => s.slots);
  const recoveryMode = useSystemStateStore((s) => s.recoveryMode);
  const registry = useRegistrySnapshot();

  // Keyboard toggle
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && (e.key === "G" || e.key === "g")) {
        e.preventDefault();
        setOpen((v) => {
          setLogs((l) => [`${new Date().toISOString().slice(11, 19)} toggle ${!v ? "OPEN" : "CLOSE"}`, ...l].slice(0, 50));
          return !v;
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Persist positions
  useEffect(() => {
    try {
      localStorage.setItem("godmode_positions_v1", JSON.stringify(positions));
    } catch {}
  }, [positions]);

  // Drag handlers
  useEffect(() => {
    if (!open) return;
    const onMove = (e: MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;
      setPositions((p) => ({
        ...p,
        [d.id]: { x: Math.max(0, e.clientX - d.offX), y: Math.max(0, e.clientY - d.offY) },
      }));
    };
    const onUp = () => {
      dragRef.current = null;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [open]);

  const beginDrag = (id: PanelId) => (e: React.MouseEvent) => {
    const rect = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
    dragRef.current = { id, offX: e.clientX - rect.left, offY: e.clientY - rect.top };
  };

  // ── Derived data (READ-ONLY, no synthesis) ───────────────────────────
  const archScoring = slots.architecture_scoring?.value as
    | { score?: number; status?: string; active_module?: string }
    | null
    | undefined;
  const ruleEvo = slots.rule_evolution?.value as { stage?: string } | null | undefined;

  const archScore = archScoring?.score ?? null;
  const systemValid = archScoring?.status
    ? archScoring.status === "valid" || archScoring.status === "healthy"
    : null;
  const activeModule =
    archScoring?.active_module ??
    Object.entries(slots).find(([, s]) => s.health === "ok" && s.updated_at)?.[0] ??
    null;
  const pipelineStage = ruleEvo?.stage ?? registry.last_validated_state?.state_key ?? null;

  const heatmap = slots.dependency_heatmap?.value as
    | {
        high_coupling?: Array<{ file: string; degree: number }>;
        circular?: Array<string[]>;
        orphans?: string[];
      }
    | null
    | undefined;

  const clusterer = slots.architecture_clusterer?.value as
    | { clusters?: Array<{ id: string; files: string[]; failure_risk: number; render_heat: number }> }
    | null
    | undefined;

  const realityCheck = slots.reality_check?.value as
    | { valid?: number; invalid?: number; rejected?: number }
    | null
    | undefined;

  const failingModules = useMemo(
    () => Object.entries(slots).filter(([, s]) => s.health === "error").map(([k]) => k as ModuleKey),
    [slots],
  );
  const emptyModules = useMemo(
    () => Object.entries(slots).filter(([, s]) => s.health === "empty").map(([k]) => k as ModuleKey),
    [slots],
  );

  const visibleModules: PanelId[] = open ? ["system", "heatmap", "clusters", "execution", "reality"] : [];

  if (!isAdmin) return null;

  // ── Render ───────────────────────────────────────────────────────────
  return (
    <>
      {/* HUD trigger hint */}
      {!open && (
        <div
          className="fixed bottom-2 right-2 text-[10px] font-mono text-zinc-500 pointer-events-none select-none"
          style={{ zIndex: 2147483646 }}
        >
          CTRL+SHIFT+G
        </div>
      )}

      {open && (
        <div
          className="fixed inset-0 pointer-events-none font-mono text-xs"
          style={{ zIndex: 2147483647 }}
          data-godmode-overlay
        >
          {/* Header bar */}
          <div className="absolute top-0 left-0 right-0 h-7 bg-black/85 text-emerald-400 border-b border-emerald-700/40 flex items-center justify-between px-3 pointer-events-auto">
            <span className="font-bold tracking-widest">⚡ GOD MODE</span>
            <span className="text-zinc-400">
              registry v{registry.last_validated_state?.version ?? "—"} · slots {Object.keys(slots).length} ·{" "}
              {recoveryMode ? <span className="text-red-400">RECOVERY</span> : "live"}
            </span>
            <button
              onClick={() => setOpen(false)}
              className="text-zinc-300 hover:text-white px-2"
              aria-label="Close god mode"
            >
              ✕
            </button>
          </div>

          {/* Panels */}
          {/* 1. SYSTEM STATE */}
          <Panel id="system" pos={positions.system} onDragStart={beginDrag("system")}>
            <Row k="pipeline_stage" v={fmt(pipelineStage)} />
            <Row k="architecture_score" v={archScore == null ? "UNKNOWN" : `${archScore}`} />
            <Row
              k="system_state"
              v={systemValid == null ? "UNKNOWN" : systemValid ? "VALID" : "BROKEN"}
              tone={systemValid == null ? undefined : systemValid ? "ok" : "err"}
            />
            <Row k="active_module" v={fmt(activeModule)} />
            <Row k="recovery_mode" v={recoveryMode ? "ON" : "OFF"} tone={recoveryMode ? "err" : "ok"} />
          </Panel>

          {/* 2. DEPENDENCY HEATMAP */}
          <Panel id="heatmap" pos={positions.heatmap} onDragStart={beginDrag("heatmap")}>
            {!heatmap ? (
              <div className="text-zinc-500">UNKNOWN — dependency_heatmap not written</div>
            ) : (
              <>
                <Section label="HIGH COUPLING">
                  {(heatmap.high_coupling ?? []).slice(0, 5).map((n) => (
                    <FileLine
                      key={n.file}
                      file={n.file}
                      meta={`deg ${n.degree}`}
                      tone="warn"
                      onHover={setHoverFile}
                      onClick={() => setOpenChain(n.file)}
                    />
                  )) || <div className="text-zinc-500">none</div>}
                  {(heatmap.high_coupling ?? []).length === 0 && <div className="text-zinc-500">none</div>}
                </Section>
                <Section label="CIRCULAR">
                  {(heatmap.circular ?? []).slice(0, 3).map((cyc, i) => (
                    <div key={i} className="text-red-400 truncate">
                      {cyc.join(" → ")}
                    </div>
                  ))}
                  {(heatmap.circular ?? []).length === 0 && <div className="text-zinc-500">none</div>}
                </Section>
                <Section label="ORPHANS">
                  {(heatmap.orphans ?? []).slice(0, 3).map((f) => (
                    <FileLine key={f} file={f} tone="dim" onHover={setHoverFile} onClick={() => setOpenChain(f)} />
                  ))}
                  {(heatmap.orphans ?? []).length === 0 && <div className="text-zinc-500">none</div>}
                </Section>
              </>
            )}
          </Panel>

          {/* 3. CLUSTER VIEW */}
          <Panel id="clusters" pos={positions.clusters} onDragStart={beginDrag("clusters")}>
            {!clusterer?.clusters?.length ? (
              <div className="text-zinc-500">UNKNOWN — architecture_clusterer not written</div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {clusterer.clusters.slice(0, 24).map((c) => {
                  const size = Math.min(56, 14 + c.render_heat * 1.2);
                  const risk = c.failure_risk;
                  const color =
                    risk >= 20
                      ? "bg-red-500/80 border-red-300"
                      : risk >= 10
                        ? "bg-amber-500/80 border-amber-300"
                        : "bg-emerald-500/70 border-emerald-300";
                  return (
                    <div
                      key={c.id}
                      title={`${c.id} · files ${c.files.length} · risk ${risk}`}
                      className={`rounded border ${color} flex items-center justify-center text-[9px] text-black font-bold cursor-pointer hover:ring-2 hover:ring-white`}
                      style={{ width: size, height: size }}
                      onMouseEnter={() => setHoverFile(`${c.id} (${c.files.length} files)`)}
                      onMouseLeave={() => setHoverFile(null)}
                      onClick={() => setOpenChain(c.id)}
                    >
                      {c.id.split("/").pop()?.slice(0, 6)}
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>

          {/* 4. EXECUTION FLOW */}
          <Panel id="execution" pos={positions.execution} onDragStart={beginDrag("execution")}>
            <Row k="current_step" v={fmt(pipelineStage)} />
            <Section label="MODULE HEALTH">
              <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 max-h-32 overflow-auto">
                {Object.entries(slots).map(([k, s]) => (
                  <div key={k} className="flex items-center gap-1.5 truncate" title={s.error ?? ""}>
                    <span className={`inline-block w-1.5 h-1.5 rounded-full ${healthColor(s.health)}`} />
                    <span className="truncate text-zinc-300">{k}</span>
                  </div>
                ))}
              </div>
            </Section>
            <Row k="failing" v={failingModules.length === 0 ? "0" : failingModules.join(", ")} tone={failingModules.length ? "err" : "ok"} />
            <Row k="empty" v={emptyModules.length === 0 ? "0" : `${emptyModules.length} module(s)`} tone={emptyModules.length ? "warn" : "ok"} />
          </Panel>

          {/* 5. REALITY CHECK */}
          <Panel id="reality" pos={positions.reality} onDragStart={beginDrag("reality")}>
            <Row k="valid_outputs" v={fmt(realityCheck?.valid)} tone="ok" />
            <Row k="invalid_outputs" v={fmt(realityCheck?.invalid)} tone="err" />
            <Row
              k="rejected_states"
              v={String(registry.invalid_states.length)}
              tone={registry.invalid_states.length ? "err" : "ok"}
            />
            <Row k="registry_records" v={String(registry.total_records)} />
            <Section label="LAST REJECTIONS">
              {registry.invalid_states.slice(0, 3).map((r, i) => (
                <div key={i} className="text-red-400 truncate" title={r.reason}>
                  {r.state_key}: {r.reason}
                </div>
              ))}
              {registry.invalid_states.length === 0 && <div className="text-zinc-500">none</div>}
            </Section>
          </Panel>

          {/* Hover detail */}
          {hoverFile && (
            <div className="absolute bottom-8 left-2 bg-black/90 border border-emerald-700/40 text-emerald-300 px-2 py-1 rounded pointer-events-none">
              {hoverFile}
            </div>
          )}

          {/* Chain modal */}
          {openChain && (
            <div
              className="absolute inset-0 bg-black/70 flex items-center justify-center pointer-events-auto"
              onClick={() => setOpenChain(null)}
            >
              <div
                className="bg-zinc-950 border border-emerald-700/60 rounded p-3 min-w-[480px] max-w-[80vw] max-h-[70vh] overflow-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="text-emerald-400 font-bold mb-2">DEPENDENCY CHAIN — {openChain}</div>
                <ChainView target={openChain} heatmap={heatmap} clusterer={clusterer} />
                <button
                  onClick={() => setOpenChain(null)}
                  className="mt-2 text-zinc-400 hover:text-white text-[11px]"
                >
                  close
                </button>
              </div>
            </div>
          )}

          {/* Interaction log */}
          <div className="absolute bottom-0 left-0 right-0 h-6 bg-black/85 border-t border-emerald-700/40 text-[10px] text-zinc-400 px-3 flex items-center gap-3 overflow-x-auto pointer-events-auto">
            <span className="text-emerald-400">log:</span>
            {logs.length === 0 ? <span>—</span> : logs.slice(0, 6).map((l, i) => <span key={i}>{l}</span>)}
            <span className="ml-auto">visible: {visibleModules.join(", ")}</span>
          </div>
        </div>
      )}
    </>
  );
}

// ── Subcomponents ────────────────────────────────────────────────────
function Panel({
  id,
  pos,
  onDragStart,
  children,
}: {
  id: PanelId;
  pos: PanelPos;
  onDragStart: (e: React.MouseEvent) => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="absolute w-[336px] bg-black/90 border border-emerald-700/50 rounded shadow-2xl pointer-events-auto text-zinc-200"
      style={{ left: pos.x, top: pos.y + 28 }}
    >
      <div
        className="cursor-move bg-emerald-950/60 text-emerald-300 px-2 py-1 text-[10px] font-bold tracking-wider border-b border-emerald-700/40 select-none"
        onMouseDown={onDragStart}
      >
        {PANEL_LABELS[id]}
      </div>
      <div className="p-2 space-y-1">{children}</div>
    </div>
  );
}

function Row({ k, v, tone }: { k: string; v: string; tone?: "ok" | "warn" | "err" }) {
  const color =
    tone === "ok"
      ? "text-emerald-400"
      : tone === "warn"
        ? "text-amber-400"
        : tone === "err"
          ? "text-red-400"
          : v === "UNKNOWN"
            ? "text-zinc-500"
            : "text-zinc-100";
  return (
    <div className="flex justify-between gap-2">
      <span className="text-zinc-500">{k}</span>
      <span className={`${color} truncate text-right`} title={v}>
        {v}
      </span>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-1.5">
      <div className="text-[9px] tracking-wider text-emerald-500/80 mb-0.5">{label}</div>
      {children}
    </div>
  );
}

function FileLine({
  file,
  meta,
  tone,
  onHover,
  onClick,
}: {
  file: string;
  meta?: string;
  tone?: "warn" | "dim";
  onHover: (f: string | null) => void;
  onClick: () => void;
}) {
  const color = tone === "warn" ? "text-amber-300" : tone === "dim" ? "text-zinc-500" : "text-zinc-200";
  return (
    <div
      className={`flex justify-between gap-2 cursor-pointer hover:bg-emerald-900/30 px-1 ${color}`}
      onMouseEnter={() => onHover(file)}
      onMouseLeave={() => onHover(null)}
      onClick={onClick}
    >
      <span className="truncate" title={file}>
        {file}
      </span>
      {meta && <span className="text-zinc-500 shrink-0">{meta}</span>}
    </div>
  );
}

function ChainView({
  target,
  heatmap,
  clusterer,
}: {
  target: string;
  heatmap?: { high_coupling?: Array<{ file: string; degree: number }>; circular?: Array<string[]>; orphans?: string[] } | null;
  clusterer?: { clusters?: Array<{ id: string; files: string[]; failure_risk: number; render_heat: number }> } | null;
}) {
  const cycles = (heatmap?.circular ?? []).filter((c) => c.includes(target));
  const cluster = clusterer?.clusters?.find((c) => c.id === target || c.files.includes(target));
  const coupling = heatmap?.high_coupling?.find((n) => n.file === target);

  return (
    <div className="text-xs space-y-2 text-zinc-200">
      {coupling && (
        <div>
          <span className="text-emerald-400">coupling degree:</span> {coupling.degree}
        </div>
      )}
      {cluster && (
        <div>
          <div>
            <span className="text-emerald-400">cluster:</span> {cluster.id} · risk {cluster.failure_risk} · heat {cluster.render_heat}
          </div>
          <div className="mt-1 max-h-40 overflow-auto text-zinc-400">
            {cluster.files.map((f) => (
              <div key={f}>{f}</div>
            ))}
          </div>
        </div>
      )}
      {cycles.length > 0 && (
        <div>
          <div className="text-red-400">circular chains:</div>
          {cycles.map((c, i) => (
            <div key={i} className="text-zinc-300">
              {c.join(" → ")}
            </div>
          ))}
        </div>
      )}
      {!coupling && !cluster && cycles.length === 0 && (
        <div className="text-zinc-500">UNKNOWN — no chain data in registry for this target.</div>
      )}
    </div>
  );
}
