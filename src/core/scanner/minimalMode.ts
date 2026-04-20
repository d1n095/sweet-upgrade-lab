/**
 * MINIMAL MODE
 *
 * GOAL: Reduce the system to essential execution only when instability is
 * detected. In MINIMAL MODE the following subsystems become inert (no-op):
 *
 *   DISABLED:
 *     - selfHealingEngine        (auto-healing)
 *     - architectureWatchdog     (watchdog)
 *     - realityCheckEngine       (reality check)
 *     - loopPreventionEngine     (loop engine)
 *
 *   ACTIVE (always):
 *     - executionController      (orchestrator)
 *     - truthEngine              (truth layer)
 *     - architectureEnforcementCore (rule engine)
 *     - dependencyHeatmap        (dependency engine)
 *
 * AUTHORITY:
 *   This module is a flag/observer. Only the ExecutionController applies it.
 *   Disabled subsystems must call `isMinimalMode()` and short-circuit when true.
 *
 * TRIGGER:
 *   Call `evaluateInstability()` with current reporter signals. If instability
 *   exceeds the configured threshold, MINIMAL MODE is auto-enabled. Operators
 *   may also enable/disable it manually via `enable()` / `disable()`.
 */

export type MinimalModeReason =
  | "manual"
  | "auto_instability"
  | "boot_default";

export interface MinimalModeStatus {
  enabled: boolean;
  since: string | null;
  reason: MinimalModeReason | null;
  detail: string | null;
  disabled_modules: string[];
  active_modules: string[];
  instability_score: number;
  threshold: number;
}

export interface InstabilitySignal {
  module: string;
  /** Higher = more unstable. */
  weight: number;
  detail?: string;
}

const DISABLED_MODULES = [
  "selfHealingEngine",
  "architectureWatchdog",
  "realityCheckEngine",
  "loopPreventionEngine",
] as const;

const ACTIVE_MODULES = [
  "executionController",
  "truthEngine",
  "architectureEnforcementCore",
  "dependencyHeatmap",
] as const;

const DEFAULT_THRESHOLD = 50;

class MinimalModeController {
  private enabled = false;
  private since: string | null = null;
  private reason: MinimalModeReason | null = null;
  private detail: string | null = null;
  private lastScore = 0;
  private threshold = DEFAULT_THRESHOLD;
  private listeners = new Set<() => void>();

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private emit() {
    for (const fn of this.listeners) fn();
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /** Quick guard for disabled subsystems. */
  isModuleDisabled(moduleName: string): boolean {
    return this.enabled && (DISABLED_MODULES as readonly string[]).includes(moduleName);
  }

  enable(reason: MinimalModeReason, detail: string): void {
    if (this.enabled && this.reason === reason && this.detail === detail) return;
    this.enabled = true;
    this.since = new Date().toISOString();
    this.reason = reason;
    this.detail = detail;
    this.emit();
  }

  disable(detail = "operator action"): void {
    if (!this.enabled) return;
    this.enabled = false;
    this.since = null;
    this.reason = null;
    this.detail = detail;
    this.emit();
  }

  setThreshold(n: number): void {
    if (n <= 0 || !Number.isFinite(n)) return;
    this.threshold = Math.floor(n);
    this.emit();
  }

  /**
   * Evaluate instability and auto-toggle MINIMAL MODE.
   * Score = sum of signal weights. >= threshold triggers MINIMAL MODE.
   * Returns the final status.
   */
  evaluateInstability(signals: InstabilitySignal[]): MinimalModeStatus {
    const score = signals.reduce((sum, s) => sum + Math.max(0, s.weight), 0);
    this.lastScore = score;
    if (score >= this.threshold) {
      const top = [...signals].sort((a, b) => b.weight - a.weight)[0];
      const detail = top
        ? `auto-trigger: score=${score} (>=${this.threshold}); top=${top.module} (+${top.weight})${top.detail ? ` — ${top.detail}` : ""}`
        : `auto-trigger: score=${score} (>=${this.threshold})`;
      this.enable("auto_instability", detail);
    }
    return this.snapshot();
  }

  snapshot(): MinimalModeStatus {
    return {
      enabled: this.enabled,
      since: this.since,
      reason: this.reason,
      detail: this.detail,
      disabled_modules: [...DISABLED_MODULES],
      active_modules: [...ACTIVE_MODULES],
      instability_score: this.lastScore,
      threshold: this.threshold,
    };
  }
}

export const minimalMode = new MinimalModeController();

/** Convenience guard for disabled subsystems. */
export function isMinimalMode(): boolean {
  return minimalMode.isEnabled();
}

/** Returns true if a given module should short-circuit because of MINIMAL MODE. */
export function shouldSkipInMinimalMode(moduleName: string): boolean {
  return minimalMode.isModuleDisabled(moduleName);
}

export const MINIMAL_MODE_DISABLED_MODULES = DISABLED_MODULES;
export const MINIMAL_MODE_ACTIVE_MODULES = ACTIVE_MODULES;
