/**
 * COMMAND LAYER — single dispatch path for all system actions.
 * Tracks last_command, result, affected_modules, sync_status.
 * Overlay subscribes; never bypassed.
 */
import { create } from "zustand";
import { systemStateRegistry } from "./systemStateRegistry";
import { useSystemStateStore } from "@/stores/systemStateStore";
import { useStealthStore, StealthScheduler } from "./stealthMode";
import { predictNextActions, resetIntentHistory } from "./systemIntent";
import { applyMode, getModeStatus, SUPER_MODES, type SuperMode } from "./superControl";
import {
  runRefactorCycle,
  type RefactorCycleInput,
  type RefactorCycleReport,
} from "@/core/evolution/autonomousRefactor";
import {
  runFailureSimulation,
  type FailureSimulationInput,
  type FailureSimulationReport,
} from "@/core/evolution/failureSimulation";
import {
  runCrossSystemEvolution,
  type CrossSystemEvolutionInput,
  type CrossSystemEvolutionReport,
} from "@/core/evolution/crossSystemEvolution";
import {
  detectPreFailures,
  type PreFailureInput,
  type PreFailureReport,
} from "@/core/evolution/preFailureDetection";
import {
  generateSyntheticUniverse,
  type SyntheticUniverseInput,
  type SyntheticUniverseReport,
} from "@/core/evolution/syntheticUniverse";
import {
  evaluateProtocolCompliance,
  getProtocolSpec,
  type ProjectProtocolSubmission,
  type ComplianceReport,
  type ProtocolSpec,
} from "@/core/evolution/protocolLayer";
import {
  buildConsciousness,
  type ProjectSnapshot,
  type ConsciousnessReport,
} from "@/core/evolution/multiProjectConsciousness";

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

export async function dispatchCommand<T>(
  name: string,
  handler: () => Promise<T> | T,
  args: unknown[] = [],
): Promise<CommandEntry> {
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
      mode: (type: SuperMode | string) => Promise<CommandEntry>;
      modeStatus: () => Promise<CommandEntry>;
      refactorCycle: (input: RefactorCycleInput) => Promise<CommandEntry>;
      consciousness: (snapshots: ReadonlyArray<ProjectSnapshot>) => Promise<CommandEntry>;
      lastCommand: () => CommandEntry | null;
      commandLog: () => CommandEntry[];
      lastRefactor: () => RefactorCycleReport | null;
      lastConsciousness: () => ConsciousnessReport | null;
      simulateFailures: (input: FailureSimulationInput) => Promise<CommandEntry>;
      lastFailureSim: () => FailureSimulationReport | null;
      evolveAcrossSystems: (input: CrossSystemEvolutionInput) => Promise<CommandEntry>;
      lastCrossEvolution: () => CrossSystemEvolutionReport | null;
      detectPreFailures: (input: PreFailureInput) => Promise<CommandEntry>;
      lastPreFailure: () => PreFailureReport | null;
      generateSyntheticUniverse: (input: SyntheticUniverseInput) => Promise<CommandEntry>;
      lastSyntheticUniverse: () => SyntheticUniverseReport | null;
      protocolSpec: () => Promise<CommandEntry>;
      protocolEvaluate: (submissions: ReadonlyArray<ProjectProtocolSubmission>) => Promise<CommandEntry>;
      lastProtocolReport: () => ComplianceReport | null;
      lastProtocolSpec: () => ProtocolSpec;
    };
  }
}

let lastRefactorReport: RefactorCycleReport | null = null;
let lastConsciousnessReport: ConsciousnessReport | null = null;
let lastFailureSimReport: FailureSimulationReport | null = null;
let lastCrossEvolutionReport: CrossSystemEvolutionReport | null = null;
let lastPreFailureReport: PreFailureReport | null = null;
let lastSyntheticUniverseReport: SyntheticUniverseReport | null = null;
let lastProtocolReport: ComplianceReport | null = null;

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
    mode: (type) => dispatchCommand(`mode.${String(type).toUpperCase()}`, () => {
      const upper = String(type).toUpperCase() as SuperMode;
      if (!SUPER_MODES.includes(upper)) {
        throw new Error(`unknown mode "${type}" — must be one of ${SUPER_MODES.join(", ")}`);
      }
      return applyMode(upper);
    }, [type]),
    modeStatus: () => dispatchCommand("mode.status", () => getModeStatus()),
    refactorCycle: (input) => dispatchCommand("refactor.runCycle", () => {
      const report = runRefactorCycle(input);
      lastRefactorReport = report;
      return report;
    }, [`v${input.current_version}`]),
    consciousness: (snapshots) => dispatchCommand("consciousness.build", () => {
      const report = buildConsciousness(snapshots);
      lastConsciousnessReport = report;
      return report;
    }, [`${snapshots.length} projects`]),
    lastCommand: () => useCommandLayerStore.getState().last_command,
    commandLog: () => useCommandLayerStore.getState().log,
    lastRefactor: () => lastRefactorReport,
    lastConsciousness: () => lastConsciousnessReport,
    simulateFailures: (input) => dispatchCommand("failure.simulate", () => {
      const report = runFailureSimulation(input);
      lastFailureSimReport = report;
      return report;
    }, [`${input.scenarios.length} scenarios`]),
    lastFailureSim: () => lastFailureSimReport,
    evolveAcrossSystems: (input) => dispatchCommand("crossSystem.evolve", () => {
      const report = runCrossSystemEvolution(input);
      lastCrossEvolutionReport = report;
      return report;
    }, [`${input.reports.length} projects`]),
    lastCrossEvolution: () => lastCrossEvolutionReport,
    detectPreFailures: (input) => dispatchCommand("preFailure.detect", () => {
      const report = detectPreFailures(input);
      lastPreFailureReport = report;
      return report;
    }, [`${input.failure_chains.length} chains`]),
    lastPreFailure: () => lastPreFailureReport,
    generateSyntheticUniverse: (input) => dispatchCommand("syntheticUniverse.generate", () => {
      const report = generateSyntheticUniverse(input);
      lastSyntheticUniverseReport = report;
      return report;
    }, [`${(input.known_patterns ?? []).length} patterns`]),
    lastSyntheticUniverse: () => lastSyntheticUniverseReport,
    protocolSpec: () => dispatchCommand("protocol.spec", () => getProtocolSpec()),
    protocolEvaluate: (submissions) => dispatchCommand("protocol.evaluate", () => {
      const report = evaluateProtocolCompliance(submissions);
      lastProtocolReport = report;
      return report;
    }, [`${submissions.length} projects`]),
    lastProtocolReport: () => lastProtocolReport,
    lastProtocolSpec: () => getProtocolSpec(),
  };
}
