/**
 * SUPER CONTROL MODE
 *
 * Single orchestrator that unifies:
 *   - Command Layer    (all actions originate here)
 *   - God Mode Overlay (all visibility goes through it)
 *   - Stealth Mode     (hidden execution scheduler)
 *   - Execution Controller (sole pipeline runner)
 *   - Strict Mode      (binary fail-fast verdict)
 *   - Minimal Mode     (core-only when unstable)
 *
 * Modes are mutually exclusive. Switching always:
 *   1. tears down previous mode side effects
 *   2. applies new mode
 *   3. records the transition in commandLayer
 *   4. the mode itself is then visible via systemStateRegistry-backed reads
 */
import { create } from "zustand";
import { useStealthStore } from "./stealthMode";
import { strictMode } from "./strictMode";
import { minimalMode } from "./minimalMode";

export type SuperMode = "NORMAL" | "GOD" | "STEALTH" | "STRICT" | "MINIMAL";

export interface ModeManifest {
  mode: SuperMode;
  enabled_systems: string[];
  disabled_systems: string[];
  description: string;
}

const MANIFEST: Record<SuperMode, ModeManifest> = {
  NORMAL: {
    mode: "NORMAL",
    enabled_systems: ["command_layer", "execution_controller", "ui", "registry"],
    disabled_systems: ["stealth_scheduler", "strict_gate", "minimal_freeze"],
    description: "Default — UI visible, all subsystems active.",
  },
  GOD: {
    mode: "GOD",
    enabled_systems: ["command_layer", "execution_controller", "god_overlay", "registry"],
    disabled_systems: ["stealth_scheduler", "strict_gate", "minimal_freeze"],
    description: "Overlay forced visible (CTRL+SHIFT+G open) for full inspection.",
  },
  STEALTH: {
    mode: "STEALTH",
    enabled_systems: ["command_layer", "execution_controller", "stealth_scheduler", "registry"],
    disabled_systems: ["god_overlay", "mini_workbench"],
    description: "Background-only execution, all visible diagnostics hidden.",
  },
  STRICT: {
    mode: "STRICT",
    enabled_systems: ["command_layer", "execution_controller", "strict_gate", "registry"],
    disabled_systems: ["stealth_scheduler"],
    description: "Fail-fast — any violation halts pipeline. Binary verdict.",
  },
  MINIMAL: {
    mode: "MINIMAL",
    enabled_systems: ["command_layer", "execution_controller", "registry"],
    disabled_systems: [
      "self_healing",
      "watchdog",
      "reality_check_engine",
      "loop_prevention",
      "stealth_scheduler",
      "god_overlay",
    ],
    description: "Core-only. Auxiliary engines inert.",
  },
};

interface SuperControlStore {
  active_mode: SuperMode;
  switched_at: string;
  switch_history: Array<{ from: SuperMode; to: SuperMode; at: string }>;
  setMode: (mode: SuperMode) => void;
}

export const useSuperControlStore = create<SuperControlStore>((set, get) => ({
  active_mode: "NORMAL",
  switched_at: new Date().toISOString(),
  switch_history: [],
  setMode: (mode) => {
    const prev = get().active_mode;
    if (prev === mode) return;
    set((s) => ({
      active_mode: mode,
      switched_at: new Date().toISOString(),
      switch_history: [{ from: prev, to: mode, at: new Date().toISOString() }, ...s.switch_history].slice(0, 50),
    }));
  },
}));

/**
 * Apply a mode. Returns the new manifest. Pure side-effect orchestration —
 * never mutates registry directly; subsystems publish their own state.
 */
export function applyMode(mode: SuperMode): ModeManifest {
  // 1. Tear down everything that's mode-exclusive
  if (useStealthStore.getState().status === "ACTIVE") useStealthStore.getState().disable("mode_switch");
  if (strictMode.isEnabled()) strictMode.setEnabled(false);
  if (minimalMode.isEnabled()) minimalMode.disable("mode_switch");

  // 2. Apply new mode
  switch (mode) {
    case "NORMAL":
    case "GOD":
      // Nothing to enable beyond defaults; overlay visibility is keyboard-driven (CTRL+SHIFT+G).
      break;
    case "STEALTH":
      useStealthStore.getState().enable();
      break;
    case "STRICT":
      strictMode.setEnabled(true);
      break;
    case "MINIMAL":
      minimalMode.enable("manual", "super_control mode=MINIMAL");
      break;
  }

  useSuperControlStore.getState().setMode(mode);
  return MANIFEST[mode];
}

/** Read current mode + enabled/disabled systems. */
export function getModeStatus(): {
  active_mode: SuperMode;
  enabled_systems: string[];
  disabled_systems: string[];
  switched_at: string;
} {
  const m = useSuperControlStore.getState().active_mode;
  const manifest = MANIFEST[m];
  return {
    active_mode: m,
    enabled_systems: manifest.enabled_systems,
    disabled_systems: manifest.disabled_systems,
    switched_at: useSuperControlStore.getState().switched_at,
  };
}

export const SUPER_MODES: ReadonlyArray<SuperMode> = ["NORMAL", "GOD", "STEALTH", "STRICT", "MINIMAL"];
export const MODE_MANIFESTS = MANIFEST;
