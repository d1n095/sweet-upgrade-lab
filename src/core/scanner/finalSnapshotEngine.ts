/**
 * FINAL SNAPSHOT ENGINE
 *
 * GOAL: Create a stable, verifiable snapshot of the system state AFTER a full
 * ExecutionController run completes successfully. The snapshot is:
 *   - taken ONLY ONCE per controller run_id (idempotent)
 *   - immutable (frozen object, append-only history)
 *   - verifiable via a deterministic verification_hash derived from the file list
 *
 * STORED FIELDS (per spec):
 *   - file_count
 *   - component_count
 *   - route_count
 *   - dependency_graph { edges, cycles, isolated }
 *
 * AUTHORITY: read-only reporter. The ExecutionController calls
 * `commitIfRunComplete(run, output)` from its OUTPUT phase. No other module
 * may mutate snapshots.
 */
import { fileSystemMap } from "@/lib/fileSystemMap";

export interface DependencyGraphSummary {
  edges: number;
  cycles: number;
  isolated: number;
}

export interface ImmutableSnapshot {
  readonly snapshot_id: string;
  readonly run_id: string;
  readonly created_at: string;
  readonly file_count: number;
  readonly component_count: number;
  readonly route_count: number;
  readonly dependency_graph: DependencyGraphSummary;
  /** SHA-256-style hex digest derived from the sorted file list. */
  readonly verification_hash: string;
  /** First & last file path included in the hash — quick visual fingerprint. */
  readonly file_list_fingerprint: { count: number; first: string; last: string };
}

export interface SnapshotState {
  current: ImmutableSnapshot | null;
  history: ImmutableSnapshot[];
  total_committed: number;
  rejected_attempts: { run_id: string; reason: string; at: string }[];
}

/**
 * Deterministic 64-bit FNV-1a hash → hex. Pure JS, no crypto dependency.
 * Stable across runs for identical input. Used as `verification_hash`.
 */
function fnv1aHex(input: string): string {
  // 64-bit FNV-1a using two 32-bit halves.
  let hi = 0xcbf2_9ce4 | 0;
  let lo = 0x8422_3325 | 0;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    lo ^= c;
    // Multiply by FNV prime 0x100000001b3 = (0x01_00 << 32) | 0x000001b3
    // Use 32-bit math with carry.
    const lo_lo = (lo & 0xffff) * 0x01b3;
    const lo_hi = ((lo >>> 16) & 0xffff) * 0x01b3;
    const hi_lo = (hi & 0xffff) * 0x01b3 + (lo & 0xffff) * 0x0100;
    const hi_hi = ((hi >>> 16) & 0xffff) * 0x01b3 + ((lo >>> 16) & 0xffff) * 0x0100 + (hi & 0xffff) * 0x0100;
    const newLoLo = lo_lo;
    const newLoHi = lo_hi + (newLoLo >>> 16);
    const newLo = ((newLoHi & 0xffff) << 16) | (newLoLo & 0xffff);
    const newHi = (hi_lo + (newLoHi >>> 16) + ((hi_hi & 0xffff) << 16)) | 0;
    lo = newLo | 0;
    hi = newHi | 0;
  }
  const toHex = (n: number) => (n >>> 0).toString(16).padStart(8, "0");
  return toHex(hi) + toHex(lo);
}

class FinalSnapshotEngine {
  private current: ImmutableSnapshot | null = null;
  private history: ImmutableSnapshot[] = [];
  private committed_run_ids = new Set<string>();
  private rejected: SnapshotState["rejected_attempts"] = [];
  private listeners = new Set<() => void>();

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private emit() {
    for (const fn of this.listeners) fn();
  }

  getState(): SnapshotState {
    return {
      current: this.current,
      history: [...this.history],
      total_committed: this.history.length,
      rejected_attempts: [...this.rejected],
    };
  }

  /**
   * Commit a snapshot for a completed controller run.
   * Idempotent: a given run_id is accepted at most once.
   * Returns the snapshot, or null if the attempt was rejected.
   */
  commitIfRunComplete(args: {
    run_id: string;
    file_count: number;
    component_count: number;
    route_count: number;
    dependency_graph: DependencyGraphSummary;
  }): ImmutableSnapshot | null {
    const now = new Date().toISOString();

    if (this.committed_run_ids.has(args.run_id)) {
      this.rejected.push({ run_id: args.run_id, reason: "already committed (run-once rule)", at: now });
      this.emit();
      return null;
    }

    if (!Array.isArray(fileSystemMap) || fileSystemMap.length === 0) {
      this.rejected.push({ run_id: args.run_id, reason: "fileSystemMap empty — cannot hash", at: now });
      this.emit();
      return null;
    }

    if (args.file_count !== fileSystemMap.length) {
      this.rejected.push({
        run_id: args.run_id,
        reason: `file_count mismatch (controller=${args.file_count} vs filesystem=${fileSystemMap.length})`,
        at: now,
      });
      this.emit();
      return null;
    }

    // Hash input = sorted, newline-joined file paths. Deterministic.
    const sortedPaths = fileSystemMap.map((f) => f.path).slice().sort();
    const verification_hash = fnv1aHex(sortedPaths.join("\n"));

    const snapshot: ImmutableSnapshot = Object.freeze({
      snapshot_id: `snap#${Date.now()}#${Math.random().toString(36).slice(2, 8)}`,
      run_id: args.run_id,
      created_at: now,
      file_count: args.file_count,
      component_count: args.component_count,
      route_count: args.route_count,
      dependency_graph: Object.freeze({ ...args.dependency_graph }),
      verification_hash,
      file_list_fingerprint: Object.freeze({
        count: sortedPaths.length,
        first: sortedPaths[0],
        last: sortedPaths[sortedPaths.length - 1],
      }),
    });

    this.committed_run_ids.add(args.run_id);
    this.current = snapshot;
    this.history.unshift(snapshot);
    if (this.history.length > 50) this.history.length = 50;
    this.emit();
    return snapshot;
  }

  /**
   * Re-derive the verification hash from the current fileSystemMap and compare
   * it to a snapshot's stored hash. Returns true if the file list is unchanged.
   */
  verify(snapshot: ImmutableSnapshot): { valid: boolean; live_hash: string; reason: string | null } {
    const sortedPaths = fileSystemMap.map((f) => f.path).slice().sort();
    const live_hash = fnv1aHex(sortedPaths.join("\n"));
    if (live_hash === snapshot.verification_hash) {
      return { valid: true, live_hash, reason: null };
    }
    return {
      valid: false,
      live_hash,
      reason: `hash drift: snapshot=${snapshot.verification_hash} live=${live_hash} (file list changed)`,
    };
  }
}

export const finalSnapshotEngine = new FinalSnapshotEngine();
