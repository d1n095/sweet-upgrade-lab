/**
 * PATTERN MEMORY
 *
 * GOAL: Store historical architecture patterns across versions.
 *
 * INPUTS (read-only — taken at observation time):
 *   - ArchitectureVersion (versionedArchitectureStore)
 *   - HeatmapReport (dependencyHeatmap) — for top-connected files & node set
 *   - ArchitectureReport (architectureEnforcementCore) — for violations
 *
 * STORE (per observation = per version):
 *   - top 10 most connected files (id + coupling_score)
 *   - violations seen in this version (rule + file fingerprint)
 *
 * DERIVED ACCUMULATORS (rolling counters — pure counting, NO interpretation):
 *   - repeated_violations    : violation key → seen_in_versions[]
 *   - stable_files           : files present in EVERY observation so far
 *   - frequently_moved_files : files whose `kind` (heatmap classification)
 *                              changed between consecutive observations
 *   - repeated_top_connected : how often each file appeared in top-10
 *
 * RULE: NO interpretation. Engine only counts and records. Anyone reading
 * these accumulators makes their own judgment. The panel renders raw counts
 * and does not score, sort, or rank beyond simple counting.
 *
 * AUTHORITY: read-only reporter. Producers (versionedArchitectureStore,
 * pipeline) may call `observe(version)` to add a new memory entry. The store
 * itself never mutates anything outside its own arrays/maps.
 */
import type { ArchitectureVersion } from "@/core/scanner/versionedArchitectureStore";
import { runDependencyHeatmap, type HeatmapReport, type DepNode } from "@/core/architecture/dependencyHeatmap";
import {
  runArchitectureEnforcement,
  type ArchitectureReport,
  type ArchitectureViolation,
} from "@/core/architecture/architectureEnforcementCore";
import { recordFailure } from "@/lib/failureMemory";

/* ──────────────────────────────────────────────────────────────────────────
 * ENDPOINT/STATUS MISMATCH TRACKER (additive, rule-based, no AI)
 *
 * Records repeated scan failures keyed by `${endpoint}::${expected}->${actual}`.
 * When occurrence_count exceeds threshold, the pattern is flagged as
 * "persistent inconsistency" and persisted to functional_failure_memory via
 * recordFailure(). Pure counting — no inference.
 * ──────────────────────────────────────────────────────────────────────── */

export interface EndpointMismatchStat {
  readonly pattern_key: string;
  readonly endpoint: string;
  readonly expected_status: string;
  readonly actual_status: string;
  readonly occurrence_count: number;
  readonly first_seen_at: string;
  readonly last_seen_at: string;
  readonly persistent: boolean; // true when occurrence_count > PERSISTENT_THRESHOLD
}

const PERSISTENT_THRESHOLD = 3;

export interface PatternTopConnected {
  readonly file: string;
  readonly coupling_score: number;
  readonly kind: string;
}

export interface PatternViolationRecord {
  readonly key: string; // `${rule}::${file}`
  readonly rule: string;
  readonly file: string;
  readonly line_hint: number;
}

export interface PatternMemoryEntry {
  readonly version_id: string;
  readonly version_number: number;
  readonly observed_at: string;
  readonly architecture_score: number;
  readonly top_connected: ReadonlyArray<PatternTopConnected>;
  readonly violations: ReadonlyArray<PatternViolationRecord>;
  readonly file_set_size: number;
  /** Raw file kinds at observation: file → kind (for frequently-moved tracking). */
  readonly file_kinds: Readonly<Record<string, string>>;
}

export interface RepeatedViolationStat {
  readonly key: string;
  readonly rule: string;
  readonly file: string;
  readonly occurrences: number;
  readonly versions: ReadonlyArray<string>; // version_ids it was seen in
}

export interface FrequentlyMovedFileStat {
  readonly file: string;
  readonly moves: number;
  readonly history: ReadonlyArray<{ from: string; to: string; at_version: string }>;
}

export interface RepeatedTopConnectedStat {
  readonly file: string;
  readonly appearances: number;
  readonly avg_coupling: number;
  readonly versions: ReadonlyArray<string>;
}

export interface PatternMemoryState {
  entries: ReadonlyArray<PatternMemoryEntry>; // newest first
  total_observations: number;
  repeated_violations: ReadonlyArray<RepeatedViolationStat>;
  stable_files: ReadonlyArray<string>; // present in EVERY observation
  frequently_moved_files: ReadonlyArray<FrequentlyMovedFileStat>;
  repeated_top_connected: ReadonlyArray<RepeatedTopConnectedStat>;
  duplicate_observations: number;
  endpoint_mismatches: ReadonlyArray<EndpointMismatchStat>;
  persistent_inconsistencies: ReadonlyArray<EndpointMismatchStat>;
}

class PatternMemory {
  private entries: PatternMemoryEntry[] = [];
  private observed_versions = new Set<string>();
  private duplicate_observations = 0;

  // Rolling accumulators
  private violationCounts = new Map<
    string,
    { rule: string; file: string; versions: string[] }
  >();
  private topConnectedCounts = new Map<
    string,
    { coupling_total: number; appearances: number; versions: string[] }
  >();
  private fileLastKind = new Map<string, string>(); // file → last seen kind
  private movedHistory = new Map<
    string,
    { from: string; to: string; at_version: string }[]
  >();
  private stableCandidates: Set<string> | null = null; // intersection across all observations

  // Endpoint+status mismatch tracker (additive, rule-based)
  private endpointMismatches = new Map<
    string,
    {
      endpoint: string;
      expected_status: string;
      actual_status: string;
      occurrence_count: number;
      first_seen_at: string;
      last_seen_at: string;
    }
  >();

  private listeners = new Set<() => void>();

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private emit() {
    for (const fn of this.listeners) fn();
  }

  getState(): PatternMemoryState {
    const repeated_violations: RepeatedViolationStat[] = [];
    for (const [key, v] of this.violationCounts) {
      const [rule, file] = splitKey(key);
      repeated_violations.push({
        key,
        rule: v.rule || rule,
        file: v.file || file,
        occurrences: v.versions.length,
        versions: [...v.versions],
      });
    }
    repeated_violations.sort(
      (a, b) => b.occurrences - a.occurrences || a.key.localeCompare(b.key)
    );

    const repeated_top_connected: RepeatedTopConnectedStat[] = [];
    for (const [file, v] of this.topConnectedCounts) {
      repeated_top_connected.push({
        file,
        appearances: v.appearances,
        avg_coupling:
          v.appearances === 0 ? 0 : Math.round((v.coupling_total / v.appearances) * 10) / 10,
        versions: [...v.versions],
      });
    }
    repeated_top_connected.sort(
      (a, b) => b.appearances - a.appearances || a.file.localeCompare(b.file)
    );

    const frequently_moved_files: FrequentlyMovedFileStat[] = [];
    for (const [file, history] of this.movedHistory) {
      frequently_moved_files.push({
        file,
        moves: history.length,
        history: [...history],
      });
    }
    frequently_moved_files.sort(
      (a, b) => b.moves - a.moves || a.file.localeCompare(b.file)
    );

    const stable_files = this.stableCandidates
      ? [...this.stableCandidates].sort()
      : [];

    const endpoint_mismatches: EndpointMismatchStat[] = [];
    for (const [pattern_key, m] of this.endpointMismatches) {
      endpoint_mismatches.push({
        pattern_key,
        endpoint: m.endpoint,
        expected_status: m.expected_status,
        actual_status: m.actual_status,
        occurrence_count: m.occurrence_count,
        first_seen_at: m.first_seen_at,
        last_seen_at: m.last_seen_at,
        persistent: m.occurrence_count > PERSISTENT_THRESHOLD,
      });
    }
    endpoint_mismatches.sort(
      (a, b) =>
        b.occurrence_count - a.occurrence_count ||
        a.pattern_key.localeCompare(b.pattern_key)
    );
    const persistent_inconsistencies = endpoint_mismatches.filter((e) => e.persistent);

    return {
      entries: [...this.entries],
      total_observations: this.entries.length,
      repeated_violations,
      stable_files,
      frequently_moved_files,
      repeated_top_connected,
      duplicate_observations: this.duplicate_observations,
      endpoint_mismatches,
      persistent_inconsistencies,
    };
  }

  /**
   * Record a scan failure where an endpoint returned an unexpected status.
   * Pure counting + threshold flag — calls failureMemory.recordFailure() to
   * persist the pattern_key and increment occurrence_count in the DB.
   *
   * RULE: occurrence_count > PERSISTENT_THRESHOLD → flagged as
   * "persistent inconsistency". No interpretation beyond the threshold.
   */
  recordEndpointMismatch(opts: {
    endpoint: string;
    expected_status: number | string;
    actual_status: number | string;
    component?: string;
    fail_reason?: string;
  }): EndpointMismatchStat {
    const expected = String(opts.expected_status);
    const actual = String(opts.actual_status);
    const pattern_key = `${opts.endpoint}::${expected}->${actual}`;
    const now = new Date().toISOString();

    let bucket = this.endpointMismatches.get(pattern_key);
    if (!bucket) {
      bucket = {
        endpoint: opts.endpoint,
        expected_status: expected,
        actual_status: actual,
        occurrence_count: 0,
        first_seen_at: now,
        last_seen_at: now,
      };
      this.endpointMismatches.set(pattern_key, bucket);
    }
    bucket.occurrence_count += 1;
    bucket.last_seen_at = now;

    const persistent = bucket.occurrence_count > PERSISTENT_THRESHOLD;

    // Persist to functional_failure_memory (fire-and-forget; pure side-effect, no AI).
    void recordFailure({
      action: "scan_endpoint_check",
      component: opts.component || opts.endpoint,
      entityType: "endpoint",
      failedStep: `status_mismatch:${expected}->${actual}`,
      failReason:
        opts.fail_reason ||
        `Endpoint ${opts.endpoint} expected ${expected}, got ${actual}`,
      severity: persistent ? "high" : "medium",
    });

    this.emit();
    return Object.freeze({
      pattern_key,
      endpoint: bucket.endpoint,
      expected_status: bucket.expected_status,
      actual_status: bucket.actual_status,
      occurrence_count: bucket.occurrence_count,
      first_seen_at: bucket.first_seen_at,
      last_seen_at: bucket.last_seen_at,
      persistent,
    });
  }

  /**
   * Observe a version. Pure recording — no scoring, no interpretation.
   * Called by the deterministic pipeline (or manually from the panel).
   */
  observe(version: ArchitectureVersion): PatternMemoryEntry | null {
    if (this.observed_versions.has(version.version_id)) {
      this.duplicate_observations++;
      this.emit();
      return null;
    }

    let heatmap: HeatmapReport | null = null;
    let arch: ArchitectureReport | null = null;
    try {
      heatmap = runDependencyHeatmap();
    } catch {
      /* tolerate */
    }
    try {
      arch = runArchitectureEnforcement();
    } catch {
      /* tolerate */
    }

    // Top connected (heatmap already exposes top-10 in `high_coupling`).
    const topNodes: DepNode[] = heatmap?.high_coupling ?? [];
    const top_connected: PatternTopConnected[] = topNodes.slice(0, 10).map((n) =>
      Object.freeze({
        file: n.id,
        coupling_score: n.coupling_score,
        kind: n.kind,
      })
    );

    // Violations
    const violations: PatternViolationRecord[] = (arch?.violations ?? []).map(
      (v: ArchitectureViolation) =>
        Object.freeze({
          key: `${v.rule}::${v.file}`,
          rule: v.rule,
          file: v.file,
          line_hint: v.line_hint,
        })
    );

    // File kinds for move tracking — taken from heatmap nodes.
    const file_kinds: Record<string, string> = {};
    for (const n of heatmap?.nodes ?? []) file_kinds[n.id] = n.kind;

    const entry: PatternMemoryEntry = Object.freeze({
      version_id: version.version_id,
      version_number: version.version_number,
      observed_at: new Date().toISOString(),
      architecture_score: version.architecture_score,
      top_connected: Object.freeze(top_connected),
      violations: Object.freeze(violations),
      file_set_size: Object.keys(file_kinds).length,
      file_kinds: Object.freeze(file_kinds),
    });

    // ── Update accumulators (pure counting) ──

    // Repeated violations
    for (const v of violations) {
      let bucket = this.violationCounts.get(v.key);
      if (!bucket) {
        bucket = { rule: v.rule, file: v.file, versions: [] };
        this.violationCounts.set(v.key, bucket);
      }
      bucket.versions.push(version.version_id);
    }

    // Repeated top-connected
    for (const t of top_connected) {
      let bucket = this.topConnectedCounts.get(t.file);
      if (!bucket) {
        bucket = { coupling_total: 0, appearances: 0, versions: [] };
        this.topConnectedCounts.set(t.file, bucket);
      }
      bucket.coupling_total += t.coupling_score;
      bucket.appearances += 1;
      bucket.versions.push(version.version_id);
    }

    // Frequently moved (kind changes between observations)
    for (const [file, kind] of Object.entries(file_kinds)) {
      const prev = this.fileLastKind.get(file);
      if (prev && prev !== kind) {
        const hist = this.movedHistory.get(file) ?? [];
        hist.push({ from: prev, to: kind, at_version: version.version_id });
        this.movedHistory.set(file, hist);
      }
      this.fileLastKind.set(file, kind);
    }

    // Stable files — running intersection of file sets across observations.
    const fileSet = new Set(Object.keys(file_kinds));
    if (this.stableCandidates === null) {
      this.stableCandidates = fileSet;
    } else {
      const next = new Set<string>();
      for (const f of this.stableCandidates) if (fileSet.has(f)) next.add(f);
      this.stableCandidates = next;
    }

    this.observed_versions.add(version.version_id);
    this.entries.unshift(entry);
    if (this.entries.length > 100) this.entries.length = 100;
    this.emit();
    return entry;
  }

  reset(): void {
    this.entries = [];
    this.observed_versions.clear();
    this.duplicate_observations = 0;
    this.violationCounts.clear();
    this.topConnectedCounts.clear();
    this.fileLastKind.clear();
    this.movedHistory.clear();
    this.stableCandidates = null;
    this.emit();
  }
}

function splitKey(key: string): [string, string] {
  const i = key.indexOf("::");
  if (i === -1) return [key, ""];
  return [key.slice(0, i), key.slice(i + 2)];
}

export const patternMemory = new PatternMemory();
