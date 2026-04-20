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

    return {
      entries: [...this.entries],
      total_observations: this.entries.length,
      repeated_violations,
      stable_files,
      frequently_moved_files,
      repeated_top_connected,
      duplicate_observations: this.duplicate_observations,
    };
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
