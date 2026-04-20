/**
 * SAFE MODE EVALUATOR
 *
 * Decides whether the System Dashboard should render in MINIMAL (safe) mode.
 *
 * Triggers (any one is enough):
 *   - systemStateStore.recoveryMode === true
 *   - ≥ 2 module slots in "error" health
 *   - ≥ 3 total error-or-empty slots after any writes have occurred
 *   - safeModeStore.active === true (manually forced)
 *
 * When SAFE MODE engages it:
 *   - activates safeModeStore with reason="critical_error"
 *   - enables minimalMode controller (disables heavy engines)
 *
 * This is a pure derivation — never throws, never calls the engines directly.
 */
import { useSystemStateStore } from "@/stores/systemStateStore";
import { useSafeModeStore } from "@/stores/safeModeStore";
import { minimalMode } from "@/core/scanner/minimalMode";

export interface SafeModeEvaluation {
  active: boolean;
  reason: string;
  errorSlots: number;
  totalSlots: number;
  recoveryMode: boolean;
}

export function evaluateSafeMode(): SafeModeEvaluation {
  const stateStore = useSystemStateStore.getState();
  const safeStore = useSafeModeStore.getState();

  const slots = Object.values(stateStore.slots);
  const errorSlots = slots.filter((s) => s.health === "error").length;
  const totalSlots = slots.length;
  const anyWritten = slots.some((s) => s.updated_at !== null);

  let active = false;
  let reason = "ok";

  if (safeStore.active) {
    active = true;
    reason = "manual_override";
  } else if (stateStore.recoveryMode) {
    active = true;
    reason = "recovery_mode";
  } else if (errorSlots >= 2) {
    active = true;
    reason = `${errorSlots}_module_errors`;
  } else if (anyWritten && errorSlots >= 1 && totalSlots >= 3) {
    // Soft threshold — at least one engine failed after boot
    active = false; // soft only; do not force SAFE MODE
    reason = "partial_degradation";
  }

  if (active && !safeStore.active) {
    safeStore.activate(
      "critical_error",
      `safe mode auto-trigger: ${reason} (errors=${errorSlots}/${totalSlots})`,
    );
  }

  if (active && !minimalMode.isEnabled()) {
    minimalMode.enable(
      "auto_instability",
      `safe mode dashboard shell active (${reason})`,
    );
  }

  return { active, reason, errorSlots, totalSlots, recoveryMode: stateStore.recoveryMode };
}

/** Manually leave SAFE MODE (operator override). */
export function exitSafeMode(): void {
  useSafeModeStore.getState().deactivate();
  minimalMode.disable("operator exit safe mode");
  useSystemStateStore.getState().setRecoveryMode(false);
}
