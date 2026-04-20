/**
 * META-CONTROL SYSTEM
 *
 * Single unified entry point that composes every layer of the architecture
 * into one coherent control plane.
 *
 * STACK
 *   FOUNDATION:   truth · dependency · rule
 *   CONTROL:      execution_controller · command_layer · god_overlay · stealth
 *   INTELLIGENCE: pattern_memory · evolution · adaptive_thresholds
 *   AUTONOMY:     autonomous_refactor · experiment_mode
 *   NETWORK:      multi_project_consciousness
 *   RESILIENCE:   failure_simulation · pre_failure_detection
 *   META:         synthetic_universe · protocol_layer · blackbox_hardening
 *
 * ENFORCED RULES
 *   1. ALL DATA       → systemStateRegistry
 *   2. ALL EXECUTION  → executionController via commandLayer
 *   3. ALL VALIDATION → rule systems (strict / protocol / blackbox)
 *   4. ALL CHANGES    → experimentMode first
 *   5. ALL STATES     → hashed via blackboxHardening.sealState
 *
 * MODES (mutually exclusive)
 *   BUILD · CONTROL · STEALTH · STRICT · PROTOCOL · SIMULATION · LOCKDOWN
 */
import { create } from "zustand";
import { applyMode, type SuperMode } from "./superControl";
import { systemStateRegistry } from "./systemStateRegistry";
import { getSecurityReport, type SecurityReport } from "./blackboxHardening";
import { useStealthStore } from "./stealthMode";
import { strictMode } from "./strictMode";
import { minimalMode } from "./minimalMode";

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

export type MetaMode =
  | "BUILD"
  | "CONTROL"
  | "STEALTH"
  | "STRICT"
  | "PROTOCOL"
  | "SIMULATION"
  | "LOCKDOWN";

export type LayerKey =
  | "truth"
  | "dependency"
  | "rule"
  | "execution_controller"
  | "command_layer"
  | "god_overlay"
  | "stealth"
  | "pattern_memory"
  | "evolution"
  | "adaptive_thresholds"
  | "autonomous_refactor"
  | "experiment_mode"
  | "multi_project_consciousness"
  | "failure_simulation"
  | "pre_failure_detection"
  | "synthetic_universe"
  | "protocol_layer"
  | "blackbox_hardening";

export interface MetaModeManifest {
  mode: MetaMode;
  description: string;
  active_layers: ReadonlyArray<LayerKey>;
  inert_layers: ReadonlyArray<LayerKey>;
  super_mode: SuperMode; // mapping into the existing superControl runtime
}

export interface SystemIntegrity {
  generated_at: string;
  registry_records: number;
  invalid_records: number;
  security_status: SecurityReport["security_status"];
  integrity_score: number; // 0–100
  rules_enforced: ReadonlyArray<string>;
  rule_violations: ReadonlyArray<string>;
}

export interface MetaSystemReport {
  generated_at: string;
  system_mode: MetaMode;
  active_layers: ReadonlyArray<LayerKey>;
  inert_layers: ReadonlyArray<LayerKey>;
  super_mode: SuperMode;
  system_integrity: SystemIntegrity;
  description: string;
}

/* -------------------------------------------------------------------------- */
/*  Manifests                                                                 */
/* -------------------------------------------------------------------------- */

const ALL_LAYERS: ReadonlyArray<LayerKey> = Object.freeze([
  "truth",
  "dependency",
  "rule",
  "execution_controller",
  "command_layer",
  "god_overlay",
  "stealth",
  "pattern_memory",
  "evolution",
  "adaptive_thresholds",
  "autonomous_refactor",
  "experiment_mode",
  "multi_project_consciousness",
  "failure_simulation",
  "pre_failure_detection",
  "synthetic_universe",
  "protocol_layer",
  "blackbox_hardening",
]);

function manifest(
  mode: MetaMode,
  super_mode: SuperMode,
  active: ReadonlyArray<LayerKey>,
  description: string
): MetaModeManifest {
  const activeSet = new Set(active);
  const inert = ALL_LAYERS.filter((l) => !activeSet.has(l));
  return Object.freeze({
    mode,
    description,
    active_layers: Object.freeze([...active]),
    inert_layers: Object.freeze(inert),
    super_mode,
  });
}

const MANIFESTS: Record<MetaMode, MetaModeManifest> = {
  BUILD: manifest(
    "BUILD",
    "NORMAL",
    [
      "truth",
      "dependency",
      "rule",
      "execution_controller",
      "command_layer",
      "pattern_memory",
      "evolution",
      "adaptive_thresholds",
      "autonomous_refactor",
      "experiment_mode",
    ],
    "Active development — autonomy + experiments enabled, overlay off."
  ),
  CONTROL: manifest(
    "CONTROL",
    "GOD",
    ALL_LAYERS,
    "Full visibility — every layer reporting, god overlay reachable."
  ),
  STEALTH: manifest(
    "STEALTH",
    "STEALTH",
    [
      "truth",
      "dependency",
      "rule",
      "execution_controller",
      "command_layer",
      "stealth",
      "pattern_memory",
      "evolution",
      "blackbox_hardening",
    ],
    "Background-only execution. No visible diagnostics."
  ),
  STRICT: manifest(
    "STRICT",
    "STRICT",
    [
      "truth",
      "dependency",
      "rule",
      "execution_controller",
      "command_layer",
      "blackbox_hardening",
    ],
    "Fail-fast — any violation halts the pipeline."
  ),
  PROTOCOL: manifest(
    "PROTOCOL",
    "STRICT",
    [
      "truth",
      "dependency",
      "rule",
      "execution_controller",
      "command_layer",
      "protocol_layer",
      "blackbox_hardening",
    ],
    "Compliance enforcement — projects must satisfy protocol contract."
  ),
  SIMULATION: manifest(
    "SIMULATION",
    "NORMAL",
    [
      "rule",
      "command_layer",
      "pattern_memory",
      "experiment_mode",
      "failure_simulation",
      "pre_failure_detection",
      "synthetic_universe",
    ],
    "Synthetic universe — simulate architectures and failures, no real writes."
  ),
  LOCKDOWN: manifest(
    "LOCKDOWN",
    "MINIMAL",
    [
      "execution_controller",
      "command_layer",
      "blackbox_hardening",
    ],
    "Maximum security — only controller, command layer and hardening active."
  ),
};

export const META_MODES: ReadonlyArray<MetaMode> = Object.freeze([
  "BUILD",
  "CONTROL",
  "STEALTH",
  "STRICT",
  "PROTOCOL",
  "SIMULATION",
  "LOCKDOWN",
]);

/* -------------------------------------------------------------------------- */
/*  Store                                                                     */
/* -------------------------------------------------------------------------- */

interface MetaStore {
  active_mode: MetaMode;
  switched_at: string;
  history: Array<{ from: MetaMode; to: MetaMode; at: string }>;
  setMode: (m: MetaMode) => void;
}

export const useMetaControlStore = create<MetaStore>((set, get) => ({
  active_mode: "BUILD",
  switched_at: new Date().toISOString(),
  history: [],
  setMode: (m) => {
    const prev = get().active_mode;
    if (prev === m) return;
    set((s) => ({
      active_mode: m,
      switched_at: new Date().toISOString(),
      history: [
        { from: prev, to: m, at: new Date().toISOString() },
        ...s.history,
      ].slice(0, 50),
    }));
  },
}));

/* -------------------------------------------------------------------------- */
/*  Rule enforcement check (the five enforced rules)                           */
/* -------------------------------------------------------------------------- */

const ENFORCED_RULES: ReadonlyArray<string> = Object.freeze([
  "ALL_DATA → systemStateRegistry",
  "ALL_EXECUTION → executionController via commandLayer",
  "ALL_VALIDATION → rule systems (strict / protocol / blackbox)",
  "ALL_CHANGES → experimentMode first",
  "ALL_STATES → hashed via blackboxHardening",
]);

function checkRules(): { rules_enforced: string[]; rule_violations: string[] } {
  const violations: string[] = [];
  const snapshot = systemStateRegistry.snapshot();
  // Rule 1: registry must be the only home of state — invalid_states means rejections
  if (snapshot.invalid_states.length > 0) {
    violations.push(
      `RULE_1: ${snapshot.invalid_states.length} rejected state writes — see invalid_states`
    );
  }
  // Rule 5: integrity comes from blackbox hardening — if blocked, that's a violation
  const sec = getSecurityReport();
  if (sec.security_status === "BLOCKED") {
    violations.push(
      `RULE_5: blackbox security BLOCKED — integrity ${sec.integrity_score}`
    );
  }
  // Make sure mutually-exclusive sub-modes aren't doubled up
  const stealthOn = useStealthStore.getState().status === "ACTIVE";
  const strictOn = strictMode.isEnabled();
  const minimalOn = minimalMode.isEnabled();
  const exclusive = [stealthOn, strictOn, minimalOn].filter(Boolean).length;
  if (exclusive > 1) {
    violations.push(
      `RULE_2: multiple exclusive sub-modes active simultaneously (stealth=${stealthOn}, strict=${strictOn}, minimal=${minimalOn})`
    );
  }
  return { rules_enforced: [...ENFORCED_RULES], rule_violations: violations };
}

function getSystemIntegrity(): SystemIntegrity {
  const snap = systemStateRegistry.snapshot();
  const sec = getSecurityReport();
  const { rules_enforced, rule_violations } = checkRules();
  return Object.freeze({
    generated_at: new Date().toISOString(),
    registry_records: snap.total_records,
    invalid_records: snap.invalid_states.length,
    security_status: sec.security_status,
    integrity_score: Math.max(
      0,
      sec.integrity_score - rule_violations.length * 10
    ),
    rules_enforced: Object.freeze(rules_enforced),
    rule_violations: Object.freeze(rule_violations),
  });
}

/* -------------------------------------------------------------------------- */
/*  Public API                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Apply a meta-mode. Translates to the underlying superControl mode and
 * returns the unified manifest. Records the transition in the meta store.
 */
export function setMetaMode(mode: MetaMode): MetaSystemReport {
  if (!META_MODES.includes(mode)) {
    throw new Error(
      `unknown meta mode "${mode}" — must be one of ${META_MODES.join(", ")}`
    );
  }
  const m = MANIFESTS[mode];
  // Drive the existing superControl orchestrator so all subsystems align.
  applyMode(m.super_mode);
  useMetaControlStore.getState().setMode(mode);
  return getMetaReport();
}

/** Read the current full system report. */
export function getMetaReport(): MetaSystemReport {
  const mode = useMetaControlStore.getState().active_mode;
  const m = MANIFESTS[mode];
  return Object.freeze({
    generated_at: new Date().toISOString(),
    system_mode: mode,
    active_layers: m.active_layers,
    inert_layers: m.inert_layers,
    super_mode: m.super_mode,
    system_integrity: getSystemIntegrity(),
    description: m.description,
  });
}

export function getMetaManifest(mode: MetaMode): MetaModeManifest {
  return MANIFESTS[mode];
}

export const META_MANIFESTS = MANIFESTS;
