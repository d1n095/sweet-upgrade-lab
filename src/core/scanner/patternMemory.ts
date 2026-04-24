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
import {
  recordFailure,
  aggregateEndpointFlag,
  recordIdLoss,
  recordNullMismatch,
  type EntityKind,
} from "@/lib/failureMemory";

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
const SYSTEMIC_DISTINCT_KEYS_THRESHOLD = 2; // >= 2 distinct pattern_keys on same endpoint

/* ──────────────────────────────────────────────────────────────────────────
 * STATIC RULE REGISTRY (manually defined — no runtime / AI generation)
 *
 * Fixed error categories (closed set):
 *   - data_flow      : timeouts, fetch failures, sync drift
 *   - ui_binding     : missing/null props, broken event handlers, render errors
 *   - performance    : slow queries, oversized payloads, render >budget
 *   - state_sync     : stale cache, store/server mismatch, race conditions
 *
 * Adding a new rule = manually appending to STATIC_VALIDATION_RULES below.
 * No code path may push to this array at runtime.
 * ──────────────────────────────────────────────────────────────────────── */

export type ErrorCategory = "data_flow" | "ui_binding" | "performance" | "state_sync";

export interface StaticValidationRule {
  readonly id: string;
  readonly category: ErrorCategory;
  readonly description: string;
  readonly severity: "critical" | "high" | "medium";
}

export const STATIC_VALIDATION_RULES: ReadonlyArray<StaticValidationRule> = Object.freeze([
  // data_flow
  Object.freeze({ id: "DF-001", category: "data_flow", description: "Endpoint response timeout (>5s)", severity: "high" }),
  Object.freeze({ id: "DF-002", category: "data_flow", description: "Endpoint returned non-2xx unexpectedly", severity: "high" }),
  Object.freeze({ id: "DF-003", category: "data_flow", description: "Required field missing in response payload", severity: "medium" }),
  Object.freeze({ id: "DF-004", category: "data_flow", description: "Edge function invocation failed", severity: "high" }),
  // ui_binding
  Object.freeze({ id: "UI-001", category: "ui_binding", description: "Component received null/undefined required prop", severity: "medium" }),
  Object.freeze({ id: "UI-002", category: "ui_binding", description: "Event handler not bound to interactive element", severity: "medium" }),
  Object.freeze({ id: "UI-003", category: "ui_binding", description: "Render error caught by boundary", severity: "high" }),
  // performance
  Object.freeze({ id: "PF-001", category: "performance", description: "Query/scan exceeded latency budget", severity: "medium" }),
  Object.freeze({ id: "PF-002", category: "performance", description: "Payload size exceeded recommended limit", severity: "medium" }),
  // state_sync
  Object.freeze({ id: "SS-001", category: "state_sync", description: "Store value diverged from server source of truth", severity: "high" }),
  Object.freeze({ id: "SS-002", category: "state_sync", description: "Stale cache read after invalidation", severity: "medium" }),
]);

/** Lookup a static rule by id. Returns undefined if not in the registry. */
export function getStaticRule(id: string): StaticValidationRule | undefined {
  return STATIC_VALIDATION_RULES.find((r) => r.id === id);
}

export interface KnownIssueEntry {
  readonly fingerprint: string; // `${rule_id}::${module}`
  readonly rule_id: string;
  readonly category: ErrorCategory;
  readonly module: string;
  readonly occurrence_count: number;
  readonly first_seen_at: string;
  readonly last_seen_at: string;
}

export interface KnownIssuesReport {
  readonly issues: ReadonlyArray<KnownIssueEntry>;
  readonly by_category: Readonly<Record<ErrorCategory, number>>;
  readonly total: number;
}

export interface PersistentInconsistencyFlag {
  readonly type: "persistent_inconsistency";
  readonly severity: "high";
  readonly source: "patternMemory";
  readonly pattern_key: string;
  readonly endpoint: string;
  readonly expected_status: string;
  readonly actual_status: string;
  readonly occurrence_count: number;
  readonly flagged_at: string;
  readonly priority_score: number;
}

export interface SystemicEndpointFailureFlag {
  readonly type: "systemic_endpoint_failure";
  readonly severity: "critical";
  readonly source: "patternMemory";
  readonly endpoint: string;
  readonly distinct_pattern_keys: ReadonlyArray<string>;
  readonly total_occurrences: number;
  readonly flagged_at: string;
  readonly priority_score: number;
}

export interface DataFlowBreakpointFlag {
  readonly type: "data_flow_breakpoint";
  readonly severity: "critical";
  readonly source: "patternMemory";
  readonly scan_id: string;
  readonly affected_entities: ReadonlyArray<EntityKind>;
  readonly missing_fields: ReadonlyArray<string>;
  readonly flagged_at: string;
  readonly priority_score: number;
}

export interface MultiLayerInconsistencyFlag {
  readonly type: "multi_layer_inconsistency";
  readonly severity: "critical";
  readonly source: "patternMemory";
  readonly endpoint: string;
  readonly contributing_sources: ReadonlyArray<string>;
  readonly signal_count: number;
  readonly flagged_at: string;
  readonly priority_score: number;
}

/**
 * Deterministic priority scoring for emitted flags.
 * Base severity: critical=3, high=2, medium=1.
 * Modifiers: +2 multi_layer_inconsistency, +2 systemic_endpoint_failure,
 * +1 occurrence_count > 5, +1 triggered by ruleEvolution.
 */
export function computePriorityScore(input: {
  severity: "critical" | "high" | "medium";
  type?: string;
  occurrence_count?: number;
  contributing_sources?: ReadonlyArray<string>;
}): number {
  const base = input.severity === "critical" ? 3 : input.severity === "high" ? 2 : 1;
  let score = base;
  if (input.type === "multi_layer_inconsistency") score += 2;
  if (input.type === "systemic_endpoint_failure") score += 2;
  if ((input.occurrence_count ?? 0) > 5) score += 1;
  if (input.contributing_sources?.includes("ruleEvolution")) score += 1;
  return score;
}

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
  private persistentFlags: PersistentInconsistencyFlag[] = [];
  private systemicFlags: SystemicEndpointFailureFlag[] = [];
  private systemicEscalatedEndpoints = new Set<string>();
  // Cross-module endpoint signals: endpoint → set of source identifiers.
  private endpointSignalSources = new Map<string, Set<string>>();
  private multiLayerFlags: MultiLayerInconsistencyFlag[] = [];
  private multiLayerEscalatedEndpoints = new Set<string>();
  // Data-flow breakpoint detection (per-scan co-occurrence of ID loss + null mismatch).
  private breakpointFlags: DataFlowBreakpointFlag[] = [];
  private breakpointEscalatedScans = new Set<string>();
  private breakpointScanState = new Map<string, {
    entities: Set<EntityKind>;
    id_losses: Set<string>;
    null_mismatches: Set<string>;
    missing_fields: Set<string>;
  }>();
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

  // Static known-issues list (deterministic; entries appended only via recordKnownIssue).
  private knownIssues = new Map<
    string,
    { rule_id: string; category: ErrorCategory; module: string; occurrence_count: number; first_seen_at: string; last_seen_at: string }
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
    const justBreached = bucket.occurrence_count === PERSISTENT_THRESHOLD + 1;

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

    // Emit structured flag once per threshold breach (no duplicate logging).
    if (justBreached) {
      const priority_score = computePriorityScore({
        severity: "high",
        type: "persistent_inconsistency",
        occurrence_count: bucket.occurrence_count,
      });
      this.persistentFlags.push(
        Object.freeze({
          type: "persistent_inconsistency" as const,
          severity: "high" as const,
          source: "patternMemory" as const,
          pattern_key,
          endpoint: bucket.endpoint,
          expected_status: bucket.expected_status,
          actual_status: bucket.actual_status,
          occurrence_count: bucket.occurrence_count,
          flagged_at: now,
          priority_score,
        })
      );
      aggregateEndpointFlag(bucket.endpoint, pattern_key, priority_score);
    }

    // Secondary rule: multiple distinct pattern_keys on same endpoint → systemic.
    const distinctKeys: string[] = [];
    let totalOccurrences = 0;
    for (const [k, b] of this.endpointMismatches) {
      if (b.endpoint === opts.endpoint) {
        distinctKeys.push(k);
        totalOccurrences += b.occurrence_count;
      }
    }
    if (
      distinctKeys.length >= SYSTEMIC_DISTINCT_KEYS_THRESHOLD &&
      !this.systemicEscalatedEndpoints.has(opts.endpoint)
    ) {
      this.systemicEscalatedEndpoints.add(opts.endpoint);
      const priority_score = computePriorityScore({
        severity: "critical",
        type: "systemic_endpoint_failure",
        occurrence_count: totalOccurrences,
      });
      this.systemicFlags.push(
        Object.freeze({
          type: "systemic_endpoint_failure" as const,
          severity: "critical" as const,
          source: "patternMemory" as const,
          endpoint: opts.endpoint,
          distinct_pattern_keys: Object.freeze([...distinctKeys]),
          total_occurrences: totalOccurrences,
          flagged_at: now,
          priority_score,
        })
      );
      void recordFailure({
        action: "scan_endpoint_check",
        component: opts.component || opts.endpoint,
        entityType: "endpoint",
        failedStep: `systemic_endpoint_failure:${distinctKeys.length}_keys`,
        failReason: `Endpoint ${opts.endpoint} has ${distinctKeys.length} distinct mismatch patterns`,
        severity: "critical",
      });
      aggregateEndpointFlag(opts.endpoint, `systemic::${opts.endpoint}`, priority_score);
    }

    // Self-register patternMemory as a signal source for this endpoint.
    this.registerEndpointSignal(opts.endpoint, "patternMemory");

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
   * Register that an external engine has flagged an endpoint. When ≥2 distinct
   * sources flag the same endpoint → emit "multi_layer_inconsistency".
   * Pure counting; deterministic; idempotent per (endpoint, source).
   */
  registerEndpointSignal(endpoint: string, source: string): void {
    let sources = this.endpointSignalSources.get(endpoint);
    if (!sources) {
      sources = new Set<string>();
      this.endpointSignalSources.set(endpoint, sources);
    }
    const before = sources.size;
    sources.add(source);
    const after = sources.size;

    if (
      after >= 2 &&
      after > before &&
      !this.multiLayerEscalatedEndpoints.has(endpoint)
    ) {
      this.multiLayerEscalatedEndpoints.add(endpoint);
      const now = new Date().toISOString();
      const sourcesArr = [...sources].sort();
      const priority_score = computePriorityScore({
        severity: "critical",
        type: "multi_layer_inconsistency",
        contributing_sources: sourcesArr,
      });
      this.multiLayerFlags.push(
        Object.freeze({
          type: "multi_layer_inconsistency" as const,
          severity: "critical" as const,
          source: "patternMemory" as const,
          endpoint,
          contributing_sources: Object.freeze(sourcesArr),
          signal_count: after,
          flagged_at: now,
          priority_score,
        })
      );
      void recordFailure({
        action: "cross_module_collision",
        component: endpoint,
        entityType: "endpoint",
        failedStep: `multi_layer_inconsistency:${after}_sources`,
        failReason: `Endpoint ${endpoint} flagged by ${after} engines: ${sourcesArr.join(", ")}`,
        severity: "critical",
      });
      aggregateEndpointFlag(endpoint, `multilayer::${endpoint}`, priority_score);
      this.emit();
    }
  }

  /** Read structured flags emitted on threshold breach. */
  getPersistentFlags(): ReadonlyArray<PersistentInconsistencyFlag> {
    return [...this.persistentFlags];
  }

  /** Read systemic endpoint failure escalations. */
  getSystemicFlags(): ReadonlyArray<SystemicEndpointFailureFlag> {
    return [...this.systemicFlags];
  }

  /** Read cross-module multi-layer inconsistencies. */
  getMultiLayerFlags(): ReadonlyArray<MultiLayerInconsistencyFlag> {
    return [...this.multiLayerFlags];
  }

  /** Read data-flow breakpoint flags emitted by `data_flow_breakpoint_detection`. */
  getDataFlowBreakpointFlags(): ReadonlyArray<DataFlowBreakpointFlag> {
    return [...this.breakpointFlags];
  }

  /**
   * RULE: data_flow_breakpoint_detection
   *
   * Trigger: within a single scan_id, ≥2 distinct entities lose identifiers
   * AND ≥1 null mismatch is observed → emit "data_flow_breakpoint" (critical).
   *
   * Pure deterministic counting; idempotent per scan_id (no duplicate flags).
   * Also forwards observations to failureMemory for cluster aggregation +
   * tracing hint (last known field presence before null).
   */
  recordDataFlowObservation(opts: {
    scan_id: string;
    entity: EntityKind;
    field: string;
    kind: "id_loss" | "null_mismatch";
    before?: string;
  }): DataFlowBreakpointFlag | null {
    let s = this.breakpointScanState.get(opts.scan_id);
    if (!s) {
      s = {
        entities: new Set(),
        id_losses: new Set(),
        null_mismatches: new Set(),
        missing_fields: new Set(),
      };
      this.breakpointScanState.set(opts.scan_id, s);
    }
    s.entities.add(opts.entity);
    s.missing_fields.add(`${opts.entity}.${opts.field}`);
    if (opts.kind === "id_loss") {
      s.id_losses.add(`${opts.entity}::${opts.field}`);
      recordIdLoss({
        scan_id: opts.scan_id,
        entity: opts.entity,
        field: opts.field,
        before: opts.before,
      });
    } else {
      s.null_mismatches.add(`${opts.entity}::${opts.field}`);
      recordNullMismatch({
        scan_id: opts.scan_id,
        entity: opts.entity,
        field: opts.field,
        before: opts.before,
      });
    }

    const distinctEntitiesWithIdLoss = new Set<EntityKind>();
    for (const k of s.id_losses) distinctEntitiesWithIdLoss.add(k.split("::")[0]);
    const triggered =
      distinctEntitiesWithIdLoss.size >= 2 &&
      s.null_mismatches.size >= 1;

    if (!triggered || this.breakpointEscalatedScans.has(opts.scan_id)) {
      this.emit();
      return null;
    }
    this.breakpointEscalatedScans.add(opts.scan_id);

    const now = new Date().toISOString();
    const entities = [...s.entities].sort();
    const fields = [...s.missing_fields].sort();
    const priority_score = computePriorityScore({
      severity: "critical",
      type: "data_flow_breakpoint" as unknown as string,
    });
    const flag: DataFlowBreakpointFlag = Object.freeze({
      type: "data_flow_breakpoint" as const,
      severity: "critical" as const,
      source: "patternMemory" as const,
      scan_id: opts.scan_id,
      affected_entities: Object.freeze(entities),
      missing_fields: Object.freeze(fields),
      flagged_at: now,
      priority_score,
    });
    this.breakpointFlags.push(flag);
    void recordFailure({
      action: "data_flow_breakpoint_detection",
      component: entities.join("+"),
      entityType: "multi_entity",
      failedStep: `breakpoint:${entities.length}_entities_${s.null_mismatches.size}_nulls`,
      failReason: `Co-occurring ID loss + null mismatch in scan ${opts.scan_id} on ${fields.join(", ")}`,
      severity: "critical",
    });
    this.emit();
    return flag;
  }

  /**
   * Record a detected issue against the static rule registry.
   * - Rejects unknown rule_ids (no auto-generation of rules).
   * - Idempotent counter per (rule_id, module) fingerprint.
   * - Pure logging; does NOT trigger further scans.
   */
  recordKnownIssue(opts: { rule_id: string; module: string }): KnownIssueEntry | null {
    const rule = getStaticRule(opts.rule_id);
    if (!rule) return null; // unknown rule_id — silently rejected (no dynamic rule creation)
    const fingerprint = `${opts.rule_id}::${opts.module}`;
    const now = new Date().toISOString();
    let bucket = this.knownIssues.get(fingerprint);
    if (!bucket) {
      bucket = {
        rule_id: opts.rule_id,
        category: rule.category,
        module: opts.module,
        occurrence_count: 0,
        first_seen_at: now,
        last_seen_at: now,
      };
      this.knownIssues.set(fingerprint, bucket);
    }
    bucket.occurrence_count += 1;
    bucket.last_seen_at = now;

    void recordFailure({
      action: "static_rule_violation",
      component: opts.module,
      entityType: rule.category,
      failedStep: opts.rule_id,
      failReason: rule.description,
      severity: rule.severity,
    });

    this.emit();
    return Object.freeze({
      fingerprint,
      rule_id: bucket.rule_id,
      category: bucket.category,
      module: bucket.module,
      occurrence_count: bucket.occurrence_count,
      first_seen_at: bucket.first_seen_at,
      last_seen_at: bucket.last_seen_at,
    });
  }

  /**
   * Report-only view of currently tracked known issues. No mutation, no scan.
   * Output: detected issues, affected modules, frequency.
   */
  getKnownIssuesReport(): KnownIssuesReport {
    const issues: KnownIssueEntry[] = [];
    const by_category: Record<ErrorCategory, number> = {
      data_flow: 0,
      ui_binding: 0,
      performance: 0,
      state_sync: 0,
    };
    for (const [fingerprint, b] of this.knownIssues) {
      issues.push(
        Object.freeze({
          fingerprint,
          rule_id: b.rule_id,
          category: b.category,
          module: b.module,
          occurrence_count: b.occurrence_count,
          first_seen_at: b.first_seen_at,
          last_seen_at: b.last_seen_at,
        })
      );
      by_category[b.category] += 1;
    }
    issues.sort(
      (a, b) =>
        b.occurrence_count - a.occurrence_count || a.fingerprint.localeCompare(b.fingerprint)
    );
    return Object.freeze({
      issues: Object.freeze(issues),
      by_category: Object.freeze(by_category),
      total: issues.length,
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
    this.endpointMismatches.clear();
    this.persistentFlags = [];
    this.systemicFlags = [];
    this.systemicEscalatedEndpoints.clear();
    this.endpointSignalSources.clear();
    this.multiLayerFlags = [];
    this.multiLayerEscalatedEndpoints.clear();
    this.knownIssues.clear();
    this.emit();
  }
}

function splitKey(key: string): [string, string] {
  const i = key.indexOf("::");
  if (i === -1) return [key, ""];
  return [key.slice(0, i), key.slice(i + 2)];
}

export const patternMemory = new PatternMemory();
