/**
 * COMMAND LAYER
 *
 * Single dispatch surface for every external system command (devtools,
 * overlay buttons, automation). Each invocation:
 *   1. records the command intent
 *   2. snapshots registry version BEFORE
 *   3. executes the handler (async-safe)
 *   4. snapshots registry version AFTER → derives affected_modules
 *   5. writes the result entry to the log
 *
 * The overlay subscribes to this store — there is NO direct UI state path.
 * Commands ALWAYS flow: command → execution → registry → overlay.
 */
import { create } from "zustand";
import { systemStateRegistry } from "./systemStateRegistry";
import { useSystemStateStore } from "@/stores/systemStateStore";
import { useStealthStore, StealthScheduler } from "./stealthMode";
import { predictNextActions, resetIntentHistory } from "./systemIntent";

export type CommandStatus = "pending" | "ok" | "error";

export interface CommandEntry {
  id: string;
  name: string;
  args_preview: string;
  status: CommandStatus;
  result_preview: string;
  affected_modules: string[];
  registry_version_before: number;
  registry_version_after: number;
  started_at: string;
  finished_at: string | null;
  error: string | null;
}

interface CommandStore {
  log: CommandEntry[];
  last_command: CommandEntry | null;
  sync_status: "in_sync" | "syncing" | "stale";
  ui_update_log: string[];
  push: (e: CommandEntry) => void;
  patch: (id: string, patch: Partial<CommandEntry>) => void;
  noteUiUpdate: (msg: string) => void;
}

const MAX_LOG = 100;
const MAX_UI_LOG = 50;

export const useCommandLayerStore = create<CommandStore>((set) => ({
  log: [],
  last_command: null,
  sync_status: "in_sync",
  ui_update_log: [],
  push: (e) =>
    set((s) => ({
      log: [e, ...s.log].slice(0, MAX_LOG),
      last_command: e,
      sync_status: e.status === "pending" ? "syncing" : "in_sync",
    })),
  patch: (id, patch) =>
    set((s) => {
      const log = s.log.map((x) => (x.id === id ? { ...x, ...patch } : x));
      const last = log[0] ?? null;
      return {
        log,
        last_command: last,
        sync_status: last?.status === "pending" ? "syncing" : "in_sync",
      };
    }),
  noteUiUpdate: (msg) =>
    set((s) => ({
      ui_update_log: [`${new Date().toISOString().slice(11, 19)} ${msg}`, ...s.ui_update_log].slice(0, MAX_UI_LOG),
    })),
}));

// Subscribe to registry → mark UI updates so overlay can show sync trail
let unsub: (() => void) | null = null;
function ensureRegistrySubscription() {
  if (unsub) return;
  unsub = systemStateRegistry.subscribe(() => {
    const snap = systemStateRegistry.snapshot();
    const last = snap.last_validated_state;
    if (last) {
      useCommandLayerStore.getState().noteUiUpdate(
        `registry v${last.version} ← ${last.state_key} (${last.source_module})`,
      );
    }
  });
}

function previewArgs(args: unknown[]): string {
  if (!args.length) return "()";
  try {
    return args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(", ").slice(0, 80);
  } catch {
    return "(unserializable)";
  }
}

function previewResult(v: unknown): string {
  try {
    const s = typeof v === "string" ? v : JSON.stringify(v);
    if (s == null) return String(v);
    return s.length > 120 ? s.slice(0, 117) + "…" : s;
  } catch {
    return String(v);
  }
}

function snapshotModuleVersions(): Record<string, string | null> {
  const slots = useSystemStateStore.getState().slots;
  const out: Record<string, string | null> = {};
  for (const [k, v] of Object.entries(slots)) out[k] = v.updated_at;
  return out;
}

function diffAffected(before: Record<string, string | null>, after: Record<string, string | null>): string[] {
  const changed: string[] = [];
  for (const k of Object.keys(after)) if (before[k] !== after[k]) changed.push(k);
  return changed;
}

let counter = 0;
const nextId = () => `cmd-${Date.now()}-${++counter}`;

/**
 * Dispatch a command through the layer. Always returns the entry — never throws.
 * Use for ALL programmatic system invocations.
 */
export async function dispatchCommand<T>(name: string, handler: () => Promise<T> | T, args: unknown[] = []): Promise<CommandEntry> {
  ensureRegistrySubscription();
  const id = nextId();
  const versionBefore = systemStateRegistry.snapshot().last_validated_state?.version ?? 0;
  const slotsBefore = snapshotModuleVersions();

  const entry: CommandEntry = {
    id,
    name,
    args_preview: previewArgs(args),
    status: "pending",
    result_preview: "",
    affected_modules: [],
    registry_version_before: versionBefore,
    registry_version_after: versionBefore,
    started_at: new Date().toISOString(),
    finished_at: null,
    error: null,
  };
  useCommandLayerStore.getState().push(entry);

  try {
    const value = await handler();
    const versionAfter = systemStateRegistry.snapshot().last_validated_state?.version ?? versionBefore;
    const affected = diffAffected(slotsBefore, snapshotModuleVersions());
    useCommandLayerStore.getState().patch(id, {
      status: "ok",
      result_preview: previewResult(value),
      affected_modules: affected,
      registry_version_after: versionAfter,
      finished_at: new Date().toISOString(),
    });
    return useCommandLayerStore.getState().log[0];
  } catch (err) {
    const versionAfter = systemStateRegistry.snapshot().last_validated_state?.version ?? versionBefore;
    const affected = diffAffected(slotsBefore, snapshotModuleVersions());
    useCommandLayerStore.getState().patch(id, {
      status: "error",
      result_preview: "",
      affected_modules: affected,
      registry_version_after: versionAfter,
      finished_at: new Date().toISOString(),
      error: err instanceof Error ? err.message : String(err),
    });
    return useCommandLayerStore.getState().log[0];
  }
}

// ── Devtools facade — every call now flows through dispatchCommand ───
declare global {
  interface Window {
    __godmode?: {
      enableStealth: () => Promise<CommandEntry>;
      disableStealth: () => Promise<CommandEntry>;
      status: () => Promise<CommandEntry>;
      logs: () => Promise<CommandEntry>;
      registry: () => Promise<CommandEntry>;
      slots: () => Promise<CommandEntry>;
      predict: () => Promise<CommandEntry>;
      resetIntent: () => Promise<CommandEntry>;
      lastCommand: () => CommandEntry | null;
      commandLog: () => CommandEntry[];
    };
  }
}

if (typeof window !== "undefined") {
  ensureRegistrySubscription();
  window.__godmode = {
    enableStealth: () => dispatchCommand("stealth.enable", () => {
      useStealthStore.getState().enable();
      return useStealthStore.getState().status;
    }),
    disableStealth: () => dispatchCommand("stealth.disable", () => {
      useStealthStore.getState().disable("manual");
      StealthScheduler.stop();
      return useStealthStore.getState().status;
    }),
    status: () => dispatchCommand("system.status", () => useStealthStore.getState().status),
    logs: () => dispatchCommand("system.logs", () => useStealthStore.getState().hidden_logs),
    registry: () => dispatchCommand("registry.snapshot", () => systemStateRegistry.snapshot()),
    slots: () => dispatchCommand("store.slots", () => useSystemStateStore.getState().slots),
    predict: () => dispatchCommand("intent.predict", () => predictNextActions()),
    resetIntent: () => dispatchCommand("intent.reset", () => {
      resetIntentHistory();
      return "ok";
    }),
    lastCommand: () => useCommandLayerStore.getState().last_command,
    commandLog: () => useCommandLayerStore.getState().log,
  };
}
