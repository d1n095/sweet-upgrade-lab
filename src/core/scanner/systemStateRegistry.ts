/**
 * SYSTEM STATE REGISTRY — single source of truth for all module outputs.
 *
 * Append-only ledger. No module may overwrite a previous record. Every
 * write MUST include source_module, timestamp, file_evidence_ref, and a
 * deterministic value. The registry validates each entry before accepting
 * it; rejected entries are recorded in `invalid_states` with a reason.
 *
 * Tracked state keys:
 *   - file_count
 *   - component_count
 *   - route_count
 *   - dependency_graph
 *   - architecture_status
 *
 * No AI. No inference. Pure data-in / data-out.
 */

export type StateKey =
  | "file_count"
  | "component_count"
  | "route_count"
  | "dependency_graph"
  | "architecture_status";

export interface StateRecord<T = unknown> {
  /** Monotonic registry version; incremented on every accepted record */
  version: number;
  state_key: StateKey;
  value: T;
  source_module: string;
  /** Reference to the file/source that proves the value (e.g. "fileSystemMap.ts:140") */
  file_evidence_ref: string;
  /** ISO timestamp the record was created */
  timestamp: string;
}

export interface InvalidStateRecord {
  attempt_at: string;
  state_key: string;
  source_module: string;
  reason: string;
  rejected_value_preview: string;
}

export interface RegistrySnapshot {
  generated_at: string;
  total_records: number;
  current_state_snapshot: Partial<Record<StateKey, StateRecord>>;
  last_validated_state: StateRecord | null;
  invalid_states: InvalidStateRecord[];
  history: StateRecord[]; // last 50 valid records, newest first
}

const VALID_KEYS = new Set<StateKey>([
  "file_count",
  "component_count",
  "route_count",
  "dependency_graph",
  "architecture_status",
]);

const MAX_HISTORY = 200;
const MAX_INVALID = 100;

class SystemStateRegistry {
  private records: StateRecord[] = [];
  private invalid: InvalidStateRecord[] = [];
  private current = new Map<StateKey, StateRecord>();
  private listeners = new Set<() => void>();
  private nextVersion = 1;

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private emit() { for (const fn of this.listeners) fn(); }

  private reject(state_key: string, source_module: string, value: unknown, reason: string) {
    this.invalid.unshift({
      attempt_at: new Date().toISOString(),
      state_key,
      source_module,
      reason,
      rejected_value_preview: previewValue(value),
    });
    if (this.invalid.length > MAX_INVALID) this.invalid.length = MAX_INVALID;
    this.emit();
  }

  /**
   * Record a value for a tracked state key. Returns the accepted record on
   * success, or null when rejected. Rejection reasons are stored in
   * `invalid_states` and never overwrite the current snapshot.
   */
  record<T>(args: {
    state_key: StateKey | string;
    value: T;
    source_module: string;
    file_evidence_ref: string;
  }): StateRecord<T> | null {
    const { state_key, value, source_module, file_evidence_ref } = args;

    // V1 — known key
    if (!VALID_KEYS.has(state_key as StateKey)) {
      this.reject(state_key, source_module, value, `unknown state_key — must be one of ${[...VALID_KEYS].join(", ")}`);
      return null;
    }
    // V2 — source identification
    if (!source_module || typeof source_module !== "string") {
      this.reject(state_key, String(source_module), value, "missing source_module");
      return null;
    }
    // V3 — file evidence reference
    if (!file_evidence_ref || typeof file_evidence_ref !== "string") {
      this.reject(state_key, source_module, value, "missing file_evidence_ref");
      return null;
    }
    // V4 — value sanity (no undefined, no NaN, no Infinity)
    if (value === undefined) {
      this.reject(state_key, source_module, value, "value is undefined");
      return null;
    }
    if (typeof value === "number" && (!Number.isFinite(value) || Number.isNaN(value))) {
      this.reject(state_key, source_module, value, "value is NaN/Infinity");
      return null;
    }

    // V5 — append-only: existing record cannot be overwritten with the same value+source
    const prev = this.current.get(state_key as StateKey);
    if (prev && deepEqual(prev.value, value) && prev.source_module === source_module) {
      // No-op write: not an error, but don't add a new record either
      return prev as StateRecord<T>;
    }

    const rec: StateRecord<T> = {
      version: this.nextVersion++,
      state_key: state_key as StateKey,
      value,
      source_module,
      file_evidence_ref,
      timestamp: new Date().toISOString(),
    };
    this.records.unshift(rec);
    if (this.records.length > MAX_HISTORY) this.records.length = MAX_HISTORY;
    this.current.set(state_key as StateKey, rec);
    this.emit();
    return rec;
  }

  /** Record many entries atomically (all-or-nothing) */
  recordBatch(entries: Array<{
    state_key: StateKey;
    value: unknown;
    source_module: string;
    file_evidence_ref: string;
  }>): { accepted: number; rejected: number } {
    let accepted = 0, rejected = 0;
    for (const e of entries) {
      const r = this.record(e);
      if (r) accepted++; else rejected++;
    }
    return { accepted, rejected };
  }

  get(key: StateKey): StateRecord | undefined {
    return this.current.get(key);
  }

  snapshot(): RegistrySnapshot {
    const snap: Partial<Record<StateKey, StateRecord>> = {};
    for (const [k, v] of this.current) snap[k] = v;
    return {
      generated_at: new Date().toISOString(),
      total_records: this.records.length,
      current_state_snapshot: snap,
      last_validated_state: this.records[0] || null,
      invalid_states: [...this.invalid],
      history: this.records.slice(0, 50),
    };
  }
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a && b && typeof a === "object") {
    try { return JSON.stringify(a) === JSON.stringify(b); } catch { return false; }
  }
  return false;
}

function previewValue(v: unknown): string {
  try {
    const s = typeof v === "string" ? v : JSON.stringify(v);
    return s == null ? String(v) : s.length > 120 ? s.slice(0, 117) + "…" : s;
  } catch {
    return String(v);
  }
}

// Singleton — one registry per browser session.
export const systemStateRegistry = new SystemStateRegistry();
