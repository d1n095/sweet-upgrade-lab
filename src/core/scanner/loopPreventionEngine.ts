/**
 * LOOP PREVENTION ENGINE — deterministic guard against infinite scan loops.
 *
 * RULES (no AI, no inference):
 *   L1. IDENTICAL OUTPUT — if a module's new output hash equals its previous
 *       output hash, block the cycle.
 *   L2. STAGNATION — if the module produces the same hash for 2+ consecutive
 *       cycles, escalate to "analysis halt" and refuse further runs until reset.
 *   L3. RECURSION — every recordCycle() must declare the calling module. If a
 *       module is already on the active call stack (direct or indirect), the
 *       cycle is rejected and counted as a recursion violation.
 *
 * State is in-memory and per-tab. UI surfaces it via LoopPreventionPanel.
 */

export type LoopStatus = "SAFE" | "LOOP DETECTED" | "STAGNATION HALT" | "RECURSION BLOCKED";

export interface ModuleLoopState {
  module: string;
  last_output_hash: string | null;
  identical_streak: number;
  total_cycles: number;
  blocked_cycles: number;
  status: LoopStatus;
  last_blocked_reason: string | null;
  last_updated_at: string;
  halted: boolean;
}

export interface CycleResult {
  accepted: boolean;
  status: LoopStatus;
  reason: string | null;
  module: string;
  output_hash: string;
  cycle_index: number;
}

export interface LoopReport {
  generated_at: string;
  loop_status: LoopStatus;
  blocked_cycles: number;
  modules: ModuleLoopState[];
  recent_events: CycleResult[];
}

const STAGNATION_THRESHOLD = 2; // identical outputs in a row → halt
const MAX_EVENTS = 50;

const moduleStates = new Map<string, ModuleLoopState>();
const callStack: string[] = [];
const events: CycleResult[] = [];

function hashOutput(output: unknown): string {
  let s: string;
  try { s = typeof output === "string" ? output : JSON.stringify(output); }
  catch { s = String(output); }
  // Deterministic 32-bit FNV-1a — no randomness, no Date.now
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return "h_" + h.toString(16).padStart(8, "0") + "_" + s.length;
}

function pushEvent(ev: CycleResult) {
  events.unshift(ev);
  if (events.length > MAX_EVENTS) events.length = MAX_EVENTS;
}

function getOrCreate(module: string): ModuleLoopState {
  let st = moduleStates.get(module);
  if (!st) {
    st = {
      module,
      last_output_hash: null,
      identical_streak: 0,
      total_cycles: 0,
      blocked_cycles: 0,
      status: "SAFE",
      last_blocked_reason: null,
      last_updated_at: new Date().toISOString(),
      halted: false,
    };
    moduleStates.set(module, st);
  }
  return st;
}

/**
 * Record a single execution cycle for a module.
 * Returns whether the cycle is accepted (SAFE) or rejected (LOOP/STAGNATION/RECURSION).
 */
export function recordCycle(module: string, output: unknown, callerStack: string[] = []): CycleResult {
  const st = getOrCreate(module);
  const output_hash = hashOutput(output);
  const now = new Date().toISOString();

  // L3 — recursion check (direct or indirect via callerStack)
  const indirect = callerStack.includes(module) || callStack.includes(module);
  if (indirect) {
    st.blocked_cycles++;
    st.status = "RECURSION BLOCKED";
    st.last_blocked_reason = `module appeared in active call stack: [${[...callStack, ...callerStack].join(" → ")}]`;
    st.last_updated_at = now;
    const ev: CycleResult = { accepted: false, status: "RECURSION BLOCKED", reason: st.last_blocked_reason, module, output_hash, cycle_index: st.total_cycles };
    pushEvent(ev);
    return ev;
  }

  // Once halted by stagnation, reject everything until reset
  if (st.halted) {
    st.blocked_cycles++;
    const ev: CycleResult = { accepted: false, status: "STAGNATION HALT", reason: "module is halted; call resetModule() to clear", module, output_hash, cycle_index: st.total_cycles };
    pushEvent(ev);
    return ev;
  }

  st.total_cycles++;

  // L1 — identical output detection
  if (st.last_output_hash !== null && st.last_output_hash === output_hash) {
    st.identical_streak++;
    st.blocked_cycles++;

    // L2 — stagnation: 2+ identical streak triggers halt
    if (st.identical_streak >= STAGNATION_THRESHOLD) {
      st.halted = true;
      st.status = "STAGNATION HALT";
      st.last_blocked_reason = `${st.identical_streak} consecutive identical outputs — analysis halted`;
      st.last_updated_at = now;
      const ev: CycleResult = { accepted: false, status: "STAGNATION HALT", reason: st.last_blocked_reason, module, output_hash, cycle_index: st.total_cycles };
      pushEvent(ev);
      return ev;
    }

    st.status = "LOOP DETECTED";
    st.last_blocked_reason = "output hash equals previous cycle";
    st.last_updated_at = now;
    const ev: CycleResult = { accepted: false, status: "LOOP DETECTED", reason: st.last_blocked_reason, module, output_hash, cycle_index: st.total_cycles };
    pushEvent(ev);
    return ev;
  }

  // SAFE — record and reset streak
  st.identical_streak = 0;
  st.last_output_hash = output_hash;
  st.status = "SAFE";
  st.last_blocked_reason = null;
  st.last_updated_at = now;
  const ev: CycleResult = { accepted: true, status: "SAFE", reason: null, module, output_hash, cycle_index: st.total_cycles };
  pushEvent(ev);
  return ev;
}

/** Wrap a synchronous module run with recursion tracking. */
export function withRecursionGuard<T>(module: string, fn: () => T): T | { blocked: true; reason: string } {
  if (callStack.includes(module)) {
    return { blocked: true, reason: `recursion: ${module} already on stack [${callStack.join(" → ")}]` };
  }
  callStack.push(module);
  try {
    return fn();
  } finally {
    callStack.pop();
  }
}

export function resetModule(module: string): void {
  moduleStates.delete(module);
}

export function resetAll(): void {
  moduleStates.clear();
  callStack.length = 0;
  events.length = 0;
}

export function getReport(): LoopReport {
  const modules = Array.from(moduleStates.values()).sort((a, b) => a.module.localeCompare(b.module));
  let loop_status: LoopStatus = "SAFE";
  let blocked_cycles = 0;
  for (const m of modules) {
    blocked_cycles += m.blocked_cycles;
    if (m.status === "STAGNATION HALT") loop_status = "STAGNATION HALT";
    else if (m.status === "RECURSION BLOCKED" && loop_status === "SAFE") loop_status = "RECURSION BLOCKED";
    else if (m.status === "LOOP DETECTED" && loop_status === "SAFE") loop_status = "LOOP DETECTED";
  }
  return {
    generated_at: new Date().toISOString(),
    loop_status,
    blocked_cycles,
    modules,
    recent_events: events.slice(0, 20),
  };
}

export const loopPreventionEngine = {
  recordCycle,
  withRecursionGuard,
  resetModule,
  resetAll,
  getReport,
};
