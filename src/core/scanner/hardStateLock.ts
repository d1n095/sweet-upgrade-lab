/**
 * HARD STATE LOCK
 *
 * GOAL: Prevent conflicting writes to the system state registry.
 *
 * RULES (deterministic):
 *   L1. ONLY the module marked AUTHORITY in `SYSTEM_ROLE_REGISTRY`
 *       (= `executionController`) may write to `systemStateRegistry`.
 *   L2. All other modules → READ-ONLY. Any write attempt is BLOCKED and logged.
 *   L3. If an unauthorized attempt occurs, the lock raises a "blocked" status
 *       which surfaces via `getLockStatus()`. The lock does NOT itself stop
 *       other systems; it returns control to the AUTHORITY (ExecutionController)
 *       which decides STOP/CONTINUE per the Absolute Control Layer.
 *
 * USAGE:
 *   Replace direct `systemStateRegistry.record({...})` calls with
 *   `hardStateLock.record({ ..., writer_module })`. The writer_module
 *   is matched against the AUTHORITY entry; non-matching writers are denied.
 */
import {
  systemStateRegistry,
  type StateKey,
  type StateRecord,
} from "@/core/scanner/systemStateRegistry";
import { SYSTEM_ROLE_REGISTRY } from "@/core/scanner/absoluteControlLayer";

export interface UnauthorizedAttempt {
  attempted_at: string;
  writer_module: string;
  state_key: string;
  rejected_value_preview: string;
  reason: string;
}

export type LockStatus = "OPEN" | "BLOCKED";

export interface LockSnapshot {
  generated_at: string;
  status: LockStatus;
  authority_module: string;
  /** Last accepted write timestamp. */
  last_authorized_write_at: string | null;
  total_authorized_writes: number;
  total_unauthorized_attempts: number;
  unauthorized_attempts: UnauthorizedAttempt[];
  /** Snapshot of the registry's current locked state. */
  locked_state: Partial<Record<StateKey, StateRecord>>;
}

const MAX_ATTEMPTS_LOG = 100;

/** Resolved AUTHORITY module name from the role registry. */
const AUTHORITY_MODULE: string =
  SYSTEM_ROLE_REGISTRY.find((e) => e.role === "AUTHORITY")?.module ??
  "executionController";

class HardStateLock {
  private status: LockStatus = "OPEN";
  private attempts: UnauthorizedAttempt[] = [];
  private authorizedWrites = 0;
  private lastAuthorizedAt: string | null = null;
  private listeners = new Set<() => void>();

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private emit() {
    for (const fn of this.listeners) fn();
  }

  /**
   * Authorized write — proxied to the registry.
   * Rejected if `writer_module` is not the AUTHORITY.
   */
  record<T>(args: {
    state_key: StateKey;
    value: T;
    source_module: string;
    file_evidence_ref: string;
    /** Caller identity — must equal AUTHORITY_MODULE. */
    writer_module: string;
  }): StateRecord<T> | null {
    if (args.writer_module !== AUTHORITY_MODULE) {
      this.deny(args.writer_module, args.state_key, args.value, "writer is not AUTHORITY");
      return null;
    }
    const rec = systemStateRegistry.record({
      state_key: args.state_key,
      value: args.value,
      source_module: args.source_module,
      file_evidence_ref: args.file_evidence_ref,
    });
    if (rec) {
      this.authorizedWrites++;
      this.lastAuthorizedAt = new Date().toISOString();
      // Authorized write — clears any prior block.
      if (this.status === "BLOCKED") this.status = "OPEN";
      this.emit();
    }
    return rec;
  }

  /**
   * Authorized batch write — proxied to the registry.
   */
  recordBatch(args: {
    entries: Array<{
      state_key: StateKey;
      value: unknown;
      source_module: string;
      file_evidence_ref: string;
    }>;
    writer_module: string;
  }): { accepted: number; rejected: number; denied: boolean } {
    if (args.writer_module !== AUTHORITY_MODULE) {
      for (const e of args.entries) {
        this.deny(args.writer_module, e.state_key, e.value, "writer is not AUTHORITY");
      }
      return { accepted: 0, rejected: 0, denied: true };
    }
    const result = systemStateRegistry.recordBatch(args.entries);
    if (result.accepted > 0) {
      this.authorizedWrites += result.accepted;
      this.lastAuthorizedAt = new Date().toISOString();
      if (this.status === "BLOCKED") this.status = "OPEN";
      this.emit();
    }
    return { ...result, denied: false };
  }

  private deny(writer: string, state_key: string, value: unknown, reason: string) {
    this.status = "BLOCKED";
    this.attempts.unshift({
      attempted_at: new Date().toISOString(),
      writer_module: writer || "<unknown>",
      state_key,
      rejected_value_preview: previewValue(value),
      reason,
    });
    if (this.attempts.length > MAX_ATTEMPTS_LOG) this.attempts.length = MAX_ATTEMPTS_LOG;
    this.emit();
  }

  /** Operator override — clears the BLOCKED status. Does not delete the log. */
  reset(): void {
    this.status = "OPEN";
    this.emit();
  }

  /** Clear unauthorized attempts log. */
  clearAttempts(): void {
    this.attempts = [];
    this.emit();
  }

  getAuthority(): string {
    return AUTHORITY_MODULE;
  }

  getLockStatus(): LockStatus {
    return this.status;
  }

  snapshot(): LockSnapshot {
    const reg = systemStateRegistry.snapshot();
    return {
      generated_at: new Date().toISOString(),
      status: this.status,
      authority_module: AUTHORITY_MODULE,
      last_authorized_write_at: this.lastAuthorizedAt,
      total_authorized_writes: this.authorizedWrites,
      total_unauthorized_attempts: this.attempts.length,
      unauthorized_attempts: [...this.attempts],
      locked_state: reg.current_state_snapshot,
    };
  }
}

function previewValue(v: unknown): string {
  try {
    const s = typeof v === "string" ? v : JSON.stringify(v);
    return s == null ? String(v) : s.length > 120 ? s.slice(0, 117) + "…" : s;
  } catch {
    return String(v);
  }
}

export const hardStateLock = new HardStateLock();
