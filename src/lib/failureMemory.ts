import { supabase } from '@/integrations/supabase/client';

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
