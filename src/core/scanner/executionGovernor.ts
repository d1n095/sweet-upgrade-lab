/**
 * EXECUTION GOVERNOR — deterministic, single-flight scheduler.
 *
 * Enforces:
 *  R1. ONLY ONE ACTIVE MODULE AT A TIME (mutex on module execution).
 *  R2. NO RE-ENTRY — a module cannot run again until its previous output is
 *      verified via markVerified(moduleId, runId).
 *  R3. STATE LOCKING — after each phase the state-key it claims is locked
 *      until validation passes (markVerified releases the lock).
 *  R4. CONFLICT DETECTION — if two modules attempt to write the same
 *      state-key while still locked, ALL execution is halted and a manual
 *      resolution flag is raised.
 *
 * Special rule: the "truth_layer" module must complete + be verified before
 * any other module is allowed to run.
 *
 * No AI. No async race tricks. Pure JS state machine.
 */

export type ModuleId = string;
export type RunId = string;

export type GovernorPhase = "idle" | "running" | "awaiting_verification" | "halted";

interface ModuleState {
  id: ModuleId;
  /** verified === true means the previous run is settled and re-entry is allowed */
  verified: boolean;
  lastRunId: RunId | null;
  lastRunAt: number | null;
  lastVerifiedAt: number | null;
  ownedKeys: Set<string>;
  runs: number;
}

interface ConflictEntry {
  at: number;
  module: ModuleId;
  conflictingWith: ModuleId;
  stateKey: string;
}

interface GovernorSnapshot {
  phase: GovernorPhase;
  active_module: ModuleId | null;
  active_run_id: RunId | null;
  locked_modules: ModuleId[];
  locked_keys: { key: string; owner: ModuleId }[];
  conflict_log: ConflictEntry[];
  modules: {
    id: ModuleId;
    verified: boolean;
    runs: number;
    last_run_at: number | null;
    last_verified_at: number | null;
    owned_keys: string[];
  }[];
  truth_layer_verified: boolean;
  halted_reason: string | null;
  generated_at: string;
}

const TRUTH_MODULE: ModuleId = "truth_layer";

class ExecutionGovernor {
  private phase: GovernorPhase = "idle";
  private active: ModuleId | null = null;
  private activeRunId: RunId | null = null;
  private modules = new Map<ModuleId, ModuleState>();
  private keyOwners = new Map<string, ModuleId>(); // state-key → owning module
  private conflicts: ConflictEntry[] = [];
  private haltedReason: string | null = null;
  private listeners = new Set<() => void>();

  private ensure(id: ModuleId): ModuleState {
    let m = this.modules.get(id);
    if (!m) {
      m = {
        id,
        verified: true, // first run is always allowed
        lastRunId: null,
        lastRunAt: null,
        lastVerifiedAt: null,
        ownedKeys: new Set(),
        runs: 0,
      };
      this.modules.set(id, m);
    }
    return m;
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    for (const fn of this.listeners) fn();
  }

  /**
   * Try to acquire the execution mutex for a module.
   * Returns a runId on success, throws otherwise.
   */
  acquire(moduleId: ModuleId, claimedKeys: string[] = []): RunId {
    if (this.haltedReason) {
      throw new Error(`GOVERNOR HALTED: ${this.haltedReason}`);
    }

    // R1 — only one active module at a time
    if (this.active && this.active !== moduleId) {
      throw new Error(
        `GOVERNOR R1 violation: "${moduleId}" cannot start — "${this.active}" is currently active`
      );
    }

    // Truth-layer gate — nothing else may run until truth_layer is verified
    const truth = this.modules.get(TRUTH_MODULE);
    if (
      moduleId !== TRUTH_MODULE &&
      (!truth || !truth.verified || truth.lastVerifiedAt === null)
    ) {
      throw new Error(
        `GOVERNOR truth-gate violation: "${moduleId}" blocked — truth_layer has not completed + been verified yet`
      );
    }

    const state = this.ensure(moduleId);

    // R2 — no re-entry until previous run verified
    if (!state.verified) {
      throw new Error(
        `GOVERNOR R2 violation: "${moduleId}" cannot re-enter — last run ${state.lastRunId} not yet verified`
      );
    }

    // R4 — conflict detection on claimed keys
    for (const key of claimedKeys) {
      const existing = this.keyOwners.get(key);
      if (existing && existing !== moduleId) {
        const owner = this.modules.get(existing);
        // Conflict only if the existing owner is still locked (unverified)
        if (owner && !owner.verified) {
          this.conflicts.push({
            at: Date.now(),
            module: moduleId,
            conflictingWith: existing,
            stateKey: key,
          });
          this.haltedReason = `R4 conflict on state-key "${key}" between "${existing}" and "${moduleId}" — manual resolution required`;
          this.phase = "halted";
          this.emit();
          throw new Error(this.haltedReason);
        }
      }
    }

    // Reserve everything
    const runId = `${moduleId}#${Date.now()}#${Math.random().toString(36).slice(2, 8)}`;
    state.verified = false;
    state.lastRunId = runId;
    state.lastRunAt = Date.now();
    state.runs += 1;
    state.ownedKeys = new Set(claimedKeys);
    for (const key of claimedKeys) this.keyOwners.set(key, moduleId);

    this.active = moduleId;
    this.activeRunId = runId;
    this.phase = "running";
    this.emit();
    return runId;
  }

  /** Mark the active run as finished (still unverified). Releases the mutex. */
  release(moduleId: ModuleId, runId: RunId) {
    if (this.active !== moduleId || this.activeRunId !== runId) {
      throw new Error(
        `GOVERNOR release mismatch: tried to release ${moduleId}#${runId} but active is ${this.active}#${this.activeRunId}`
      );
    }
    this.active = null;
    this.activeRunId = null;
    this.phase = "awaiting_verification";
    this.emit();
  }

  /** Verify the run — unlocks state-keys and re-enables re-entry. */
  markVerified(moduleId: ModuleId, runId: RunId) {
    const state = this.modules.get(moduleId);
    if (!state || state.lastRunId !== runId) {
      throw new Error(
        `GOVERNOR verify mismatch: run ${runId} is not the latest for "${moduleId}"`
      );
    }
    state.verified = true;
    state.lastVerifiedAt = Date.now();
    // Release locks owned by this module that no other module owns
    for (const key of state.ownedKeys) {
      if (this.keyOwners.get(key) === moduleId) this.keyOwners.delete(key);
    }
    state.ownedKeys = new Set();
    if (this.phase === "awaiting_verification" && !this.active) this.phase = "idle";
    this.emit();
  }

  /** Resolve a halt manually (e.g. operator action). */
  resolveHalt(reason = "manual reset") {
    this.haltedReason = null;
    this.conflicts.push({
      at: Date.now(),
      module: "(operator)",
      conflictingWith: "(operator)",
      stateKey: `RESOLVED: ${reason}`,
    });
    if (!this.active) this.phase = "idle";
    this.emit();
  }

  /**
   * Convenience helper — wraps a function in acquire/release/markVerified.
   * The function MUST throw to indicate failure (which will leave the run
   * unverified, blocking re-entry until manually resolved).
   */
  run<T>(moduleId: ModuleId, claimedKeys: string[], fn: () => T): T {
    const runId = this.acquire(moduleId, claimedKeys);
    try {
      const result = fn();
      this.release(moduleId, runId);
      this.markVerified(moduleId, runId);
      return result;
    } catch (err) {
      // Leave the run unverified intentionally — operator must investigate.
      try {
        if (this.active === moduleId) this.release(moduleId, runId);
      } catch {
        /* already released */
      }
      throw err;
    }
  }

  snapshot(): GovernorSnapshot {
    return {
      phase: this.phase,
      active_module: this.active,
      active_run_id: this.activeRunId,
      locked_modules: [...this.modules.values()]
        .filter((m) => !m.verified)
        .map((m) => m.id),
      locked_keys: [...this.keyOwners.entries()].map(([key, owner]) => ({ key, owner })),
      conflict_log: [...this.conflicts].slice(-50),
      modules: [...this.modules.values()].map((m) => ({
        id: m.id,
        verified: m.verified,
        runs: m.runs,
        last_run_at: m.lastRunAt,
        last_verified_at: m.lastVerifiedAt,
        owned_keys: [...m.ownedKeys],
      })),
      truth_layer_verified: !!this.modules.get(TRUTH_MODULE)?.verified &&
        !!this.modules.get(TRUTH_MODULE)?.lastVerifiedAt,
      halted_reason: this.haltedReason,
      generated_at: new Date().toISOString(),
    };
  }
}

// Singleton — one governor per browser session.
export const executionGovernor = new ExecutionGovernor();

export type { GovernorSnapshot, ConflictEntry };
