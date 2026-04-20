/**
 * FEATURE FLAGS — staged rollout for evolution engines.
 *
 * Each flag has 3 states:
 *   - "off"           → engine is dormant, panel hidden
 *   - "internal_only" → engine runs, panel visible to founders only (observability)
 *   - "on"            → engine runs, panel visible to all admins
 *
 * All 7 evolution engines default to "internal_only" so we get observability
 * BEFORE we let them affect anything. They are pure-read by default; any
 * mutation requires "on" + an explicit gesture.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type FlagState = "off" | "internal_only" | "on";

export type EvolutionFlagKey =
  | "adaptive_thresholds"
  | "controlled_mutation"
  | "experiment_mode"
  | "evolution_guard"
  | "evolution_loop"
  | "cluster_intelligence"
  | "cluster_visualization";

interface FeatureFlagsState {
  flags: Record<EvolutionFlagKey, FlagState>;
  setFlag: (key: EvolutionFlagKey, state: FlagState) => void;
  isVisible: (key: EvolutionFlagKey, isFounder: boolean) => boolean;
  isActive: (key: EvolutionFlagKey) => boolean;
}

const DEFAULTS: Record<EvolutionFlagKey, FlagState> = {
  adaptive_thresholds: "internal_only",
  controlled_mutation: "internal_only",
  experiment_mode: "internal_only",
  evolution_guard: "internal_only",
  evolution_loop: "internal_only",
  cluster_intelligence: "internal_only",
  cluster_visualization: "internal_only",
};

export const useFeatureFlagsStore = create<FeatureFlagsState>()(
  persist(
    (set, get) => ({
      flags: DEFAULTS,
      setFlag: (key, state) =>
        set((s) => ({ flags: { ...s.flags, [key]: state } })),
      isVisible: (key, isFounder) => {
        const f = get().flags[key];
        if (f === "off") return false;
        if (f === "internal_only") return isFounder;
        return true;
      },
      isActive: (key) => get().flags[key] !== "off",
    }),
    { name: "evolution-feature-flags" }
  )
);

export const FLAG_LABELS: Record<EvolutionFlagKey, string> = {
  adaptive_thresholds: "Adaptive Thresholds",
  controlled_mutation: "Controlled Mutation",
  experiment_mode: "Experiment Mode",
  evolution_guard: "Evolution Guard",
  evolution_loop: "Evolution Loop",
  cluster_intelligence: "Cluster Intelligence",
  cluster_visualization: "Cluster Visualization",
};
