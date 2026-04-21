/**
 * SNAPSHOT RESOLVER — Git-agnostic version lookup with fallback.
 *
 * Wraps the three existing immutable stores:
 *   - finalSnapshotEngine        (v1 summary snapshots,  id: "snap#…")
 *   - snapshotStoreV2            (v2 full-evidence,      id: "snap2-N-hash")
 *   - versionedArchitectureStore (versions,              id: "vN")
 *
 * RULES:
 *   - No git refs anywhere. IDs are purely internal (counter + hash + time).
 *   - "HEAD" / "latest" always resolves to the newest committed entry.
 *   - If a requested id is not found, fall back to the latest valid snapshot
 *     and report the fallback in the result (never throw).
 *   - Pure read API. Nothing here mutates a store.
 */
import { finalSnapshotEngine, type ImmutableSnapshot } from "./finalSnapshotEngine";
import { snapshotStoreV2, type ImmutableSnapshotV2 } from "./immutableSnapshotV2";
import {
  versionedArchitectureStore,
  type ArchitectureVersion,
} from "./versionedArchitectureStore";

export type SnapshotKind = "v1" | "v2" | "version";

export interface ResolvedEntry {
  kind: SnapshotKind;
  id: string;
  created_at: string;
  /** The actual stored object (frozen). Type narrowed by `kind`. */
  entry: ImmutableSnapshot | ImmutableSnapshotV2 | ArchitectureVersion;
}

export interface ResolveResult {
  /** True when the requested id was found exactly. */
  found: boolean;
  /** The resolved entry, or null if no entries exist anywhere. */
  resolved: ResolvedEntry | null;
  /** Why we returned what we returned. */
  reason:
    | "exact_match"
    | "head_alias"
    | "fallback_latest"
    | "registry_empty"
    | "invalid_query";
  /** The query that was asked for (for audit). */
  query: string;
}

export interface RegistryListing {
  v1: ReadonlyArray<{ id: string; created_at: string }>;
  v2: ReadonlyArray<{ id: string; created_at: string; integrity_hash: string }>;
  versions: ReadonlyArray<{ id: string; created_at: string; score: number }>;
  totals: { v1: number; v2: number; versions: number };
  latest: ResolvedEntry | null;
}

const HEAD_ALIASES = new Set(["HEAD", "head", "latest", "current", "@"]);

function pickLatest(): ResolvedEntry | null {
  // Prefer versions (highest authority — only commits after a SUCCESS pipeline),
  // then v2, then v1.
  const v = versionedArchitectureStore.getState().current;
  if (v) return { kind: "version", id: v.version_id, created_at: v.created_at, entry: v };
  const s2 = snapshotStoreV2.getState().current;
  if (s2) return { kind: "v2", id: s2.snapshot_id, created_at: s2.created_at, entry: s2 };
  const s1 = finalSnapshotEngine.getState().current;
  if (s1) return { kind: "v1", id: s1.snapshot_id, created_at: s1.created_at, entry: s1 };
  return null;
}

function findExact(id: string): ResolvedEntry | null {
  // Try each store. IDs are namespaced ("vN" / "snap#…" / "snap2-…") so no
  // ambiguity, but we check all three for safety.
  const versions = versionedArchitectureStore.getState().versions;
  const v = versions.find((x) => x.version_id === id);
  if (v) return { kind: "version", id: v.version_id, created_at: v.created_at, entry: v };

  const s2 = snapshotStoreV2.get(id);
  if (s2) return { kind: "v2", id: s2.snapshot_id, created_at: s2.created_at, entry: s2 };

  const s1History = finalSnapshotEngine.getState().history;
  const s1 = s1History.find((x) => x.snapshot_id === id);
  if (s1) return { kind: "v1", id: s1.snapshot_id, created_at: s1.created_at, entry: s1 };

  return null;
}

/**
 * Resolve a query to a concrete snapshot/version.
 * Accepts a real id, a HEAD alias, or any garbage — never throws.
 */
export function resolveSnapshot(query: string | null | undefined): ResolveResult {
  const q = (query ?? "").trim();
  if (!q) {
    const head = pickLatest();
    return {
      found: false,
      resolved: head,
      reason: head ? "head_alias" : "registry_empty",
      query: "",
    };
  }

  if (HEAD_ALIASES.has(q)) {
    const head = pickLatest();
    return {
      found: head != null,
      resolved: head,
      reason: head ? "head_alias" : "registry_empty",
      query: q,
    };
  }

  const exact = findExact(q);
  if (exact) {
    return { found: true, resolved: exact, reason: "exact_match", query: q };
  }

  // Fallback: the requested id is unknown (e.g. references a previous session,
  // a rebased branch, or a force-pushed history). Surface the latest valid
  // state so callers can recover instead of crashing.
  const head = pickLatest();
  return {
    found: false,
    resolved: head,
    reason: head ? "fallback_latest" : "registry_empty",
    query: q,
  };
}

/** List the contents of every store — useful for admin UIs and debugging. */
export function listRegistry(): RegistryListing {
  const v1 = finalSnapshotEngine.getState().history.map((s) => ({
    id: s.snapshot_id,
    created_at: s.created_at,
  }));
  const v2 = snapshotStoreV2.getState().history.map((s) => ({
    id: s.snapshot_id,
    created_at: s.created_at,
    integrity_hash: s.integrity_hash,
  }));
  const versions = versionedArchitectureStore.getState().versions.map((v) => ({
    id: v.version_id,
    created_at: v.created_at,
    score: v.architecture_score,
  }));
  return {
    v1,
    v2,
    versions,
    totals: { v1: v1.length, v2: v2.length, versions: versions.length },
    latest: pickLatest(),
  };
}

/** Convenience: resolve "HEAD" — guaranteed never to throw. */
export function getHead(): ResolvedEntry | null {
  return pickLatest();
}
