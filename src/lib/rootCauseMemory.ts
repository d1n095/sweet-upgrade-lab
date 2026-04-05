import { supabase } from '@/integrations/supabase/client';

/**
 * Root Cause Memory — the system learns from every resolved bug.
 * Stores WHY issues happen, what system was affected, and what fixed it.
 * Detects recurring patterns to prevent repeat failures.
 */

export interface RootCauseEntry {
  bug_report_id?: string;
  work_item_id?: string;
  change_log_id?: string;
  root_cause: string;
  affected_system: string;
  fix_applied: string;
  severity?: string;
}

/** Generate a stable pattern key from root cause + system for dedup/grouping */
function generatePatternKey(rootCause: string, affectedSystem: string): string {
  const normalize = (s: string) =>
    s.toLowerCase().replace(/[^a-zåäö0-9 ]/g, '').trim().split(/\s+/).sort().join('_');
  return `${normalize(affectedSystem)}::${normalize(rootCause).slice(0, 80)}`;
}

/** Record a root cause. If the same pattern exists, increment recurrence. */
export async function recordRootCause(entry: RootCauseEntry): Promise<{ ok: boolean; isRecurrence: boolean; recurrenceCount: number }> {
  try {
    const patternKey = generatePatternKey(entry.root_cause, entry.affected_system);
    const { data: { session } } = await supabase.auth.getSession();

    // Check for existing pattern
    const { data: existing } = await supabase
      .from('root_cause_memory' as any)
      .select('id, recurrence_count')
      .eq('pattern_key', patternKey)
      .limit(1);

    if (existing && existing.length > 0) {
      const record = existing[0] as any;
      const newCount = (record.recurrence_count || 1) + 1;

      await (supabase.from('root_cause_memory' as any) as any).update({
        recurrence_count: newCount,
        last_seen_at: new Date().toISOString(),
        bug_report_id: entry.bug_report_id || undefined,
        work_item_id: entry.work_item_id || undefined,
        change_log_id: entry.change_log_id || undefined,
      }).eq('id', record.id);

      return { ok: true, isRecurrence: true, recurrenceCount: newCount };
    }

    // New root cause entry
    await (supabase.from('root_cause_memory' as any) as any).insert({
      bug_report_id: entry.bug_report_id || null,
      work_item_id: entry.work_item_id || null,
      change_log_id: entry.change_log_id || null,
      root_cause: entry.root_cause,
      affected_system: entry.affected_system,
      fix_applied: entry.fix_applied,
      pattern_key: patternKey,
      severity: entry.severity || 'medium',
      recurrence_count: 1,
      created_by: session?.user?.id || null,
    });

    return { ok: true, isRecurrence: false, recurrenceCount: 1 };
  } catch (e) {
    return { ok: false, isRecurrence: false, recurrenceCount: 0 };
  }
}

/** Check if a new issue matches a known root cause pattern */
export async function checkKnownPatterns(description: string, system?: string): Promise<{
  matches: Array<{ root_cause: string; fix_applied: string; affected_system: string; recurrence_count: number; severity: string }>;
}> {
  try {
    let query = supabase
      .from('root_cause_memory' as any)
      .select('root_cause, fix_applied, affected_system, recurrence_count, severity')
      .order('recurrence_count', { ascending: false })
      .limit(20);

    if (system) {
      query = query.eq('affected_system', system);
    }

    const { data } = await query;
    if (!data || data.length === 0) return { matches: [] };

    // Simple keyword matching against description
    const keywords = description.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const scored = (data as any[]).map(entry => {
      const causeWords = entry.root_cause.toLowerCase();
      const matchCount = keywords.filter(k => causeWords.includes(k)).length;
      return { ...entry, matchScore: matchCount };
    }).filter(e => e.matchScore > 0)
      .sort((a, b) => b.matchScore - a.matchScore || b.recurrence_count - a.recurrence_count)
      .slice(0, 5);

    return { matches: scored };
  } catch (e) {
    return { matches: [] };
  }
}

/** Get top recurring patterns for dashboard display */
export async function getTopPatterns(limit = 10): Promise<any[]> {
  try {
    const { data } = await supabase
      .from('root_cause_memory' as any)
      .select('*')
      .order('recurrence_count', { ascending: false })
      .limit(limit);
    return (data as any[]) || [];
  } catch {
    return [];
  }
}
