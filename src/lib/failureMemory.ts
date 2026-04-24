import { supabase } from '@/integrations/supabase/client';

/* ──────────────────────────────────────────────────────────────────────────
 * DATA FLOW BREAKPOINT CLUSTERING (in-memory, deterministic)
 *
 * Groups co-occurring failures by scan_id. A cluster is a "breakpoint" when
 * BOTH conditions hold within a scan:
 *   - ID loss observed on ≥1 entity
 *   - At least one null mismatch observed
 *
 * No new schema. No persistence beyond runtime aggregation. Reuses existing
 * pattern_keys from recordFailure().
 * ──────────────────────────────────────────────────────────────────────── */

export type EntityKind = 'order' | 'user' | 'work_item' | string;

export interface FieldTransition {
  readonly entity: EntityKind;
  readonly field_path: string; // e.g. "order.payment_intent_id"
  readonly before: string;     // last known valid presence indicator
  readonly after: string;      // observed (typically "null")
  readonly at: string;         // ISO
}

export interface BreakpointCluster {
  readonly breakpoint_cluster_id: string; // === scan_id
  readonly scan_id: string;
  readonly affected_entities: ReadonlyArray<EntityKind>;
  readonly missing_fields: ReadonlyArray<string>;
  readonly transitions: ReadonlyArray<FieldTransition>;
  readonly created_at: string;
  readonly occurrence_count: number;
}

interface ScanBucket {
  scan_id: string;
  entities: Set<EntityKind>;
  id_losses: Set<string>;       // `${entity}::${field}`
  null_mismatches: Set<string>; // `${entity}::${field}`
  missing_fields: Set<string>;  // full field paths e.g. "order.order_number"
  transitions: FieldTransition[];
  created_at: string;
}

const scanBuckets = new Map<string, ScanBucket>();
const breakpointClusters = new Map<string, BreakpointCluster>(); // keyed by scan_id (no dup)
const clusterFingerprintCounts = new Map<string, number>(); // sorted entities+fields signature

function bucketFor(scan_id: string): ScanBucket {
  let b = scanBuckets.get(scan_id);
  if (!b) {
    b = {
      scan_id,
      entities: new Set(),
      id_losses: new Set(),
      null_mismatches: new Set(),
      missing_fields: new Set(),
      transitions: [],
      created_at: new Date().toISOString(),
    };
    scanBuckets.set(scan_id, b);
  }
  return b;
}

/**
 * Record an ID-loss observation (e.g. order missing order_number).
 * Adds to the per-scan bucket and tries to materialize a cluster.
 */
export function recordIdLoss(opts: {
  scan_id: string;
  entity: EntityKind;
  field: string; // e.g. "order_number"
  before?: string;
}): void {
  const b = bucketFor(opts.scan_id);
  b.entities.add(opts.entity);
  b.id_losses.add(`${opts.entity}::${opts.field}`);
  b.missing_fields.add(`${opts.entity}.${opts.field}`);
  b.transitions.push({
    entity: opts.entity,
    field_path: `${opts.entity}.${opts.field}`,
    before: opts.before ?? 'present',
    after: 'missing',
    at: new Date().toISOString(),
  });
  maybeMaterializeCluster(opts.scan_id);
}

/**
 * Record a null mismatch (expected value, got null).
 */
export function recordNullMismatch(opts: {
  scan_id: string;
  entity: EntityKind;
  field: string;
  before?: string;
}): void {
  const b = bucketFor(opts.scan_id);
  b.entities.add(opts.entity);
  b.null_mismatches.add(`${opts.entity}::${opts.field}`);
  b.missing_fields.add(`${opts.entity}.${opts.field}`);
  b.transitions.push({
    entity: opts.entity,
    field_path: `${opts.entity}.${opts.field}`,
    before: opts.before ?? 'non-null',
    after: 'null',
    at: new Date().toISOString(),
  });
  maybeMaterializeCluster(opts.scan_id);
}

/** Idempotent: only one cluster per scan_id. */
function maybeMaterializeCluster(scan_id: string): void {
  const b = scanBuckets.get(scan_id);
  if (!b) return;
  if (breakpointClusters.has(scan_id)) {
    // Update existing snapshot in place (counts stable; no duplicate cluster).
    const prev = breakpointClusters.get(scan_id)!;
    breakpointClusters.set(scan_id, Object.freeze({
      ...prev,
      affected_entities: Object.freeze([...b.entities].sort()),
      missing_fields: Object.freeze([...b.missing_fields].sort()),
      transitions: Object.freeze([...b.transitions]),
      occurrence_count: prev.occurrence_count,
    }));
    return;
  }
  if (b.id_losses.size === 0 || b.null_mismatches.size === 0) return;

  const entities = [...b.entities].sort();
  const fields = [...b.missing_fields].sort();
  const fingerprint = `${entities.join(',')}|${fields.join(',')}`;
  clusterFingerprintCounts.set(
    fingerprint,
    (clusterFingerprintCounts.get(fingerprint) || 0) + 1,
  );

  const cluster: BreakpointCluster = Object.freeze({
    breakpoint_cluster_id: scan_id,
    scan_id,
    affected_entities: Object.freeze(entities),
    missing_fields: Object.freeze(fields),
    transitions: Object.freeze([...b.transitions]),
    created_at: b.created_at,
    occurrence_count: clusterFingerprintCounts.get(fingerprint)!,
  });
  breakpointClusters.set(scan_id, cluster);

  // Persist a single failure record per cluster (reuses existing log).
  void recordFailure({
    action: 'data_flow_breakpoint',
    component: entities.join('+'),
    entityType: 'multi_entity',
    failedStep: `breakpoint_cluster:${entities.length}_entities`,
    failReason: `Co-occurring ID loss + null mismatch on: ${fields.join(', ')}`,
    severity: 'critical',
  });
}

export function getBreakpointClusters(): ReadonlyArray<BreakpointCluster> {
  return [...breakpointClusters.values()].sort(
    (a, b) => b.created_at.localeCompare(a.created_at),
  );
}

export interface LikelyRootCause {
  readonly fingerprint: string;
  readonly affected_entities: ReadonlyArray<EntityKind>;
  readonly most_common_missing_fields: ReadonlyArray<string>;
  readonly cluster_occurrences: number;
  readonly representative_cluster_id: string | null;
}

/**
 * Aggregates breakpoint clusters by fingerprint and returns the most
 * frequent one — the most likely upstream data-mapping failure.
 */
export function getLikelyRootCause(): LikelyRootCause | null {
  if (breakpointClusters.size === 0) return null;

  // Re-tally from current cluster snapshots (deterministic).
  const tallies = new Map<string, { entities: string[]; fields: Map<string, number>; count: number; rep: string }>();
  for (const c of breakpointClusters.values()) {
    const entities = [...c.affected_entities];
    const fp = `${entities.join(',')}|${[...c.missing_fields].join(',')}`;
    let t = tallies.get(fp);
    if (!t) {
      t = { entities, fields: new Map(), count: 0, rep: c.scan_id };
      tallies.set(fp, t);
    }
    t.count += 1;
    for (const f of c.missing_fields) {
      t.fields.set(f, (t.fields.get(f) || 0) + 1);
    }
  }

  let best: { fp: string; t: { entities: string[]; fields: Map<string, number>; count: number; rep: string } } | null = null;
  for (const [fp, t] of tallies) {
    if (!best || t.count > best.t.count || (t.count === best.t.count && fp < best.fp)) {
      best = { fp, t };
    }
  }
  if (!best) return null;

  const sortedFields = [...best.t.fields.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([f]) => f);

  return Object.freeze({
    fingerprint: best.fp,
    affected_entities: Object.freeze([...best.t.entities]),
    most_common_missing_fields: Object.freeze(sortedFields),
    cluster_occurrences: best.t.count,
    representative_cluster_id: best.t.rep,
  });
}

/** Diagnostic reset (test only). */
export function resetBreakpointClusters(): void {
  scanBuckets.clear();
  breakpointClusters.clear();
  clusterFingerprintCounts.clear();
}

/**
 * Functional Failure Memory — records WHERE and HOW actions fail,
 * tracks frequency, and provides data for scan prioritization.
 */

export interface FailurePattern {
  id: string;
  action_type: string;
  component: string;
  entity_type: string;
  failed_step: string;
  fail_reason: string | null;
  pattern_key: string;
  occurrence_count: number;
  last_seen_at: string;
  first_seen_at: string;
  last_scan_retest_at: string | null;
  last_retest_passed: boolean | null;
  severity: string;
  is_resolved: boolean;
}

/** Generate a stable key for dedup/grouping */
function buildPatternKey(action: string, component: string, step: string): string {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-zåäö0-9]/g, '_').slice(0, 60);
  return `${normalize(action)}::${normalize(component)}::${normalize(step)}`;
}

/** Record a failure from the Action Verification Engine. Upserts by pattern_key. */
export async function recordFailure(opts: {
  action: string;
  component: string;
  entityType: string;
  failedStep: string;
  failReason?: string;
  severity?: string;
}): Promise<{ ok: boolean; isRecurrence: boolean; count: number }> {
  try {
    const patternKey = buildPatternKey(opts.action, opts.component, opts.failedStep);

    const { data: existing } = await supabase
      .from('functional_failure_memory' as any)
      .select('id, occurrence_count')
      .eq('pattern_key', patternKey)
      .limit(1);

    if (existing && existing.length > 0) {
      const record = existing[0] as any;
      const newCount = (record.occurrence_count || 1) + 1;
      await (supabase.from('functional_failure_memory' as any) as any).update({
        occurrence_count: newCount,
        last_seen_at: new Date().toISOString(),
        fail_reason: opts.failReason || undefined,
        severity: opts.severity || undefined,
        is_resolved: false,
        resolved_at: null,
      }).eq('id', record.id);
      return { ok: true, isRecurrence: true, count: newCount };
    }

    await (supabase.from('functional_failure_memory' as any) as any).insert({
      action_type: opts.action,
      component: opts.component,
      entity_type: opts.entityType,
      failed_step: opts.failedStep,
      fail_reason: opts.failReason || null,
      pattern_key: patternKey,
      severity: opts.severity || 'medium',
      occurrence_count: 1,
    });
    return { ok: true, isRecurrence: false, count: 1 };
  } catch (e) {

    return { ok: false, isRecurrence: false, count: 0 };
  }
}

/** Get top failure hotspots for dashboard display */
export async function getFailureHotspots(limit = 20): Promise<FailurePattern[]> {
  try {
    const { data } = await supabase
      .from('functional_failure_memory' as any)
      .select('*')
      .eq('is_resolved', false)
      .order('occurrence_count', { ascending: false })
      .limit(limit);
    return (data as any[]) || [];
  } catch {
    return [];
  }
}

/** Mark a failure pattern as resolved */
export async function resolveFailure(patternId: string): Promise<boolean> {
  try {
    await (supabase.from('functional_failure_memory' as any) as any).update({
      is_resolved: true,
      resolved_at: new Date().toISOString(),
    }).eq('id', patternId);
    return true;
  } catch {
    return false;
  }
}

/* ──────────────────────────────────────────────────────────────────────────
 * IN-MEMORY ENDPOINT PRIORITY AGGREGATION
 * Pure deterministic accumulation. No new schema. Reuses existing identifiers
 * (endpoint + pattern_key). Dedup is enforced via a per-endpoint Set so the
 * same pattern_key is counted only once.
 * ──────────────────────────────────────────────────────────────────────── */

interface EndpointAggregate {
  endpoint: string;
  total_priority_score: number;
  number_of_flags: number;
  pattern_keys: Set<string>;
}

const endpointAggregates = new Map<string, EndpointAggregate>();

export interface TopCriticalEndpoint {
  endpoint: string;
  total_priority_score: number;
  number_of_flags: number;
  pattern_keys: string[];
}

/**
 * Aggregate a flag's priority score for an endpoint. Idempotent per
 * (endpoint, pattern_key) — duplicate calls with the same key are ignored.
 */
export function aggregateEndpointFlag(
  endpoint: string,
  pattern_key: string,
  priority_score: number,
): void {
  let agg = endpointAggregates.get(endpoint);
  if (!agg) {
    agg = { endpoint, total_priority_score: 0, number_of_flags: 0, pattern_keys: new Set() };
    endpointAggregates.set(endpoint, agg);
  }
  if (agg.pattern_keys.has(pattern_key)) return; // no duplicate counting
  agg.pattern_keys.add(pattern_key);
  agg.total_priority_score += priority_score;
  agg.number_of_flags += 1;
}

/**
 * Return endpoints sorted by total_priority_score DESC with their contributing
 * pattern_keys. Deterministic ordering via stable secondary sort by endpoint.
 */
export function getTopCriticalEndpoints(limit = 5): TopCriticalEndpoint[] {
  const out: TopCriticalEndpoint[] = [];
  for (const agg of endpointAggregates.values()) {
    out.push({
      endpoint: agg.endpoint,
      total_priority_score: agg.total_priority_score,
      number_of_flags: agg.number_of_flags,
      pattern_keys: [...agg.pattern_keys].sort(),
    });
  }
  out.sort(
    (a, b) =>
      b.total_priority_score - a.total_priority_score ||
      a.endpoint.localeCompare(b.endpoint),
  );
  return out.slice(0, limit);
}

/** Reset aggregation (test/diagnostic use). */
export function resetEndpointAggregates(): void {
  endpointAggregates.clear();
}
