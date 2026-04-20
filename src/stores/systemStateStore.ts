/**
 * SYSTEM_STATE_STORE — single source of truth for Command Center.
 *
 * GOAL (SYSTEM RECOVERY MODE):
 *   Break circular dependencies between:
 *     - Command Center
 *     - Rule Evolution Engine
 *     - Architecture Scoring
 *     - Pattern Memory
 *
 *   Each module WRITES its output here, and the Command Center READS only
 *   from here. No panel is allowed to call another panel's engine directly.
 *   If a writer fails, readers receive SAFE DEFAULTS (never undefined, never
 *   throws). The UI always renders.
 *
 * This store is intentionally pure Zustand — no side effects at import.
 */
import { create } from "zustand";

export type ModuleKey =
  | "architecture_scoring"
  | "rule_evolution"
  | "pattern_memory"
  | "dependency_heatmap"
  | "reality_check"
  | "drift_detector"
  | "strict_mode"
  | "minimal_mode"
  // Evolution Lab engines (suggest-only, internal_only by default)
  | "risk_heatmap"
  | "in_frontend_ci"
  | "integrity_monitor"
  | "production_readiness"
  | "evolution_tracker"
  | "architecture_clusterer"
  | "live_system_model"
  | "failure_predictor"
  | "intent_alignment"
  | "complexity_reducer"
  | "code_quarantine"
  | "change_simulator";

export type ModuleHealth = "ok" | "degraded" | "empty" | "error";

export interface ModuleSlot<T = unknown> {
  /** Last successful value; `null` when never written */
  value: T | null;
  /** Health derived from the last write */
  health: ModuleHealth;
  /** Last writer ISO timestamp — null before first write */
  updated_at: string | null;
  /** Error string from last failed write; null otherwise */
  error: string | null;
}

export type SystemStateSlots = Record<ModuleKey, ModuleSlot>;

interface SystemStateStore {
  slots: SystemStateSlots;
  /** Global recovery flag — forces all panels into empty-state mode */
  recoveryMode: boolean;
  setRecoveryMode: (on: boolean) => void;
  write: <T>(key: ModuleKey, value: T, health?: ModuleHealth) => void;
  writeError: (key: ModuleKey, error: unknown) => void;
  read: <T = unknown>(key: ModuleKey) => ModuleSlot<T>;
  reset: () => void;
}

const EMPTY_SLOT: ModuleSlot = {
  value: null,
  health: "empty",
  updated_at: null,
  error: null,
};

const MODULE_KEYS: ReadonlyArray<ModuleKey> = [
  "architecture_scoring",
  "rule_evolution",
  "pattern_memory",
  "dependency_heatmap",
  "reality_check",
  "drift_detector",
  "strict_mode",
  "minimal_mode",
  "risk_heatmap",
  "in_frontend_ci",
  "integrity_monitor",
  "production_readiness",
  "evolution_tracker",
  "architecture_clusterer",
  "live_system_model",
  "failure_predictor",
  "intent_alignment",
  "complexity_reducer",
  "code_quarantine",
  "change_simulator",
];

const INITIAL_SLOTS: SystemStateSlots = MODULE_KEYS.reduce((acc, k) => {
  acc[k] = { ...EMPTY_SLOT };
  return acc;
}, {} as SystemStateSlots);

export const useSystemStateStore = create<SystemStateStore>((set, get) => ({
  slots: INITIAL_SLOTS,
  recoveryMode: false,

  setRecoveryMode: (on) => set({ recoveryMode: on }),

  write: (key, value, health = "ok") => {
    set((s) => ({
      slots: {
        ...s.slots,
        [key]: {
          value: value ?? null,
          health: value == null ? "empty" : health,
          updated_at: new Date().toISOString(),
          error: null,
        },
      },
    }));
  },

  writeError: (key, error) => {
    const msg = error instanceof Error ? error.message : String(error);
    set((s) => ({
      slots: {
        ...s.slots,
        [key]: {
          value: s.slots[key]?.value ?? null, // keep last good value
          health: "error",
          updated_at: new Date().toISOString(),
          error: msg,
        },
      },
    }));
    // If multiple modules fail, auto-enter recovery mode
    const failing = Object.values(get().slots).filter((s) => s.health === "error").length;
    if (failing >= 3) set({ recoveryMode: true });
  },

  read: <T = unknown>(key: ModuleKey): ModuleSlot<T> => {
    const slot = get().slots[key];
    return (slot as ModuleSlot<T>) ?? ({ ...EMPTY_SLOT } as ModuleSlot<T>);
  },

  reset: () => set({ slots: INITIAL_SLOTS, recoveryMode: false }),
}));

/**
 * Safe runner — executes a writer fn, catches anything thrown, stores either
 * the value or the error. Never throws to the caller.
 */
export async function runAndStore<T>(
  key: ModuleKey,
  fn: () => Promise<T> | T,
): Promise<ModuleSlot<T>> {
  const store = useSystemStateStore.getState();
  try {
    const value = await fn();
    store.write<T>(key, value);
  } catch (err) {
    store.writeError(key, err);
  }
  return store.read<T>(key);
}
