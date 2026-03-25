import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { recordRootCause } from '@/lib/rootCauseMemory';

/**
 * Critical Auto-Assignment & Escalation Engine
 *
 * 1. Auto-assigns unassigned critical/high work items via DB function
 * 2. Escalates critical items open > 1h
 * 3. Deduplicates near-identical critical items
 * 4. Records patterns to Root Cause Memory
 */

export interface EscalationReport {
  assigned: number;
  escalated: number;
  deduplicated: number;
  timestamp: string;
}

/** Run full critical item triage: dedup → assign → escalate */
export async function runCriticalEscalation(): Promise<EscalationReport> {
  const report: EscalationReport = { assigned: 0, escalated: 0, deduplicated: 0, timestamp: new Date().toISOString() };

  try {
    // ── STEP 1: Deduplicate critical items with near-identical titles ──
    report.deduplicated = await deduplicateCriticalItems();

    // ── STEP 2: Auto-assign unassigned critical/high items ──
    report.assigned = await autoAssignCriticalItems();

    // ── STEP 3: Escalate stale critical items (open > 1h) ──
    report.escalated = await escalateStaleItems();

    const total = report.assigned + report.escalated + report.deduplicated;
    if (total > 0) {
      toast.info(
        `🔧 Kritisk triage: ${report.assigned} tilldelade, ${report.escalated} eskalerade, ${report.deduplicated} dedup`,
        { duration: 5000 }
      );
    }
  } catch (e) {
    console.warn('[CriticalEscalation] Failed:', e);
  }

  return report;
}

/** Auto-assign unassigned critical/high work items using DB function */
async function autoAssignCriticalItems(): Promise<number> {
  let assigned = 0;

  const { data: unassigned } = await supabase
    .from('work_items' as any)
    .select('id, item_type, priority')
    .in('priority', ['critical', 'high'])
    .eq('status', 'open')
    .is('assigned_to', null)
    .is('claimed_by', null)
    .order('created_at', { ascending: true })
    .limit(30);

  for (const item of (unassigned || []) as any[]) {
    try {
      const { data: bestUser } = await supabase.rpc('auto_assign_work_item', {
        p_item_type: item.item_type || 'general',
      });

      if (bestUser) {
        await (supabase.from('work_items' as any) as any)
          .update({ assigned_to: bestUser, status: 'open' })
          .eq('id', item.id);
        assigned++;
      }
    } catch {
      // No available staff — skip
    }
  }

  return assigned;
}

/** Escalate critical items that have been open for > 1 hour */
async function escalateStaleItems(): Promise<number> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { data: stale } = await supabase
    .from('work_items' as any)
    .select('id, title, created_at, source_type, source_id')
    .eq('priority', 'critical')
    .eq('status', 'open')
    .lt('created_at', oneHourAgo)
    .order('created_at', { ascending: true })
    .limit(50);

  if (!stale || stale.length === 0) return 0;

  let escalated = 0;

  for (const item of stale as any[]) {
    const { error } = await (supabase.from('work_items' as any) as any)
      .update({
        status: 'escalated',
        description: (item.description || '') + `\n\n⏰ Auto-eskalerad: öppen > 1h utan åtgärd (${new Date().toISOString()})`,
      })
      .eq('id', item.id);

    if (!error) {
      escalated++;

      // Record to root cause memory
      await recordRootCause({
        work_item_id: item.id,
        root_cause: 'Kritisk uppgift ej åtgärdad inom SLA',
        affected_system: 'work_item_pipeline',
        fix_applied: 'Auto-eskalerad efter 1h',
        severity: 'high',
      });
    }
  }

  // Notify admins about escalations
  if (escalated > 0) {
    try {
      const { data: admins } = await supabase
        .from('user_roles' as any)
        .select('user_id')
        .in('role', ['admin', 'founder'])
        .limit(10);

      for (const admin of (admins || []) as any[]) {
        await supabase.from('notifications').insert({
          user_id: admin.user_id,
          type: 'urgent',
          message: `🚨 ${escalated} kritiska uppgifter eskalerade — kräver omedelbar åtgärd`,
          related_type: 'escalation',
        });
      }
    } catch {
      // Notification failure is non-blocking
    }
  }

  return escalated;
}

/** Deduplicate critical items with near-identical titles */
async function deduplicateCriticalItems(): Promise<number> {
  const { data: criticals } = await supabase
    .from('work_items' as any)
    .select('id, title, created_at')
    .eq('priority', 'critical')
    .in('status', ['open', 'in_progress'])
    .order('created_at', { ascending: true })
    .limit(200);

  if (!criticals || criticals.length < 2) return 0;

  const normalize = (t: string) =>
    t.toLowerCase().replace(/[^a-zåäö0-9 ]/g, '').replace(/\s+/g, ' ').trim();

  const seen = new Map<string, string>(); // normalized → kept id
  const toCancel: string[] = [];

  for (const item of criticals as any[]) {
    const key = normalize(item.title).slice(0, 60);
    if (seen.has(key)) {
      toCancel.push(item.id);
    } else {
      seen.set(key, item.id);
    }
  }

  if (toCancel.length === 0) return 0;

  const { error } = await (supabase.from('work_items' as any) as any)
    .update({ status: 'cancelled', description: 'Auto-deduplicerad — duplicat av befintlig uppgift' })
    .in('id', toCancel);

  return error ? 0 : toCancel.length;
}
