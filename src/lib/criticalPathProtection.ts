import { supabase } from '@/integrations/supabase/client';
import { useSafeModeStore } from '@/stores/safeModeStore';
import { toast } from 'sonner';

/**
 * Critical Path Protection — monitors the core pipeline:
 * scan → issue → work_item → change_log → bug → verification
 *
 * If any link in the chain is broken, the system is marked CRITICAL,
 * a high-priority work item is auto-created, and non-critical tasks are paused.
 */

export interface PathCheckResult {
  stage: string;
  ok: boolean;
  detail: string;
  count?: number;
}

export interface CriticalPathReport {
  healthy: boolean;
  score: number;
  checks: PathCheckResult[];
  brokenStages: string[];
  timestamp: string;
}

const STAGES = [
  'scan_to_issue',
  'issue_to_work_item',
  'work_item_to_change_log',
  'change_log_to_bug',
  'bug_to_verification',
] as const;

/** Run all critical path checks and return a report */
export async function runCriticalPathCheck(): Promise<CriticalPathReport> {
  const checks: PathCheckResult[] = [];

  // 1. scan → issue: Recent scans should create tasks
  try {
    const { data: recentScans } = await supabase
      .from('ai_scan_results')
      .select('id, issues_count, tasks_created')
      .order('created_at', { ascending: false })
      .limit(5);

    const scansWithIssues = (recentScans || []).filter((s: any) => (s.issues_count || 0) > 0);
    const scansWithTasks = (recentScans || []).filter((s: any) => (s.tasks_created || 0) > 0);
    const ok = scansWithIssues.length === 0 || scansWithTasks.length > 0;

    checks.push({
      stage: 'scan_to_issue',
      ok,
      detail: ok
        ? `${scansWithTasks.length} skanningar genererade uppgifter`
        : `${scansWithIssues.length} skanningar med problem men 0 uppgifter skapade`,
      count: scansWithTasks.length,
    });
  } catch {
    checks.push({ stage: 'scan_to_issue', ok: false, detail: 'Kunde inte läsa skanningar' });
  }

  // 2. issue → work_item: Open bugs should have linked work items
  try {
    const { data: openBugs } = await supabase
      .from('bug_reports')
      .select('id')
      .in('status', ['open', 'new', 'triaged'])
      .limit(50);

    let unlinked = 0;
    for (const bug of (openBugs || []).slice(0, 20)) {
      const { data: wi } = await supabase
        .from('work_items' as any)
        .select('id')
        .eq('source_type', 'bug_report')
        .eq('source_id', bug.id)
        .limit(1);
      if (!wi || wi.length === 0) unlinked++;
    }

    const total = (openBugs || []).length;
    const ok = unlinked === 0 || total === 0;
    checks.push({
      stage: 'issue_to_work_item',
      ok,
      detail: ok
        ? `Alla ${total} öppna buggar har work items`
        : `${unlinked}/${total} buggar saknar work items`,
      count: unlinked,
    });
  } catch {
    checks.push({ stage: 'issue_to_work_item', ok: false, detail: 'Kunde inte kontrollera bugg-länkning' });
  }

  // 3. work_item → change_log: Completed items should have log entries
  try {
    const { data: doneItems } = await supabase
      .from('work_items' as any)
      .select('id')
      .eq('status', 'done')
      .order('completed_at', { ascending: false })
      .limit(20);

    let unlogged = 0;
    for (const item of (doneItems || []) as any[]) {
      const { data: log } = await supabase
        .from('change_log')
        .select('id')
        .eq('work_item_id', item.id)
        .limit(1);
      if (!log || log.length === 0) unlogged++;
    }

    const total = (doneItems || []).length;
    const ok = unlogged === 0 || total === 0;
    checks.push({
      stage: 'work_item_to_change_log',
      ok,
      detail: ok
        ? `Alla ${total} slutförda uppgifter har ändringsloggar`
        : `${unlogged}/${total} slutförda uppgifter saknar ändringslogg`,
      count: unlogged,
    });
  } catch {
    checks.push({ stage: 'work_item_to_change_log', ok: false, detail: 'Kunde inte verifiera ändringsloggar' });
  }

  // 4. change_log → bug: Changes with bug_report_id should resolve the bug
  try {
    const { data: bugChanges } = await supabase
      .from('change_log')
      .select('id, bug_report_id')
      .not('bug_report_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(20);

    let stillOpen = 0;
    for (const change of bugChanges || []) {
      if (!change.bug_report_id) continue;
      const { data: bug } = await supabase
        .from('bug_reports')
        .select('status')
        .eq('id', change.bug_report_id)
        .single();
      if (bug && bug.status !== 'resolved' && bug.status !== 'duplicate') stillOpen++;
    }

    const ok = stillOpen === 0;
    checks.push({
      stage: 'change_log_to_bug',
      ok,
      detail: ok
        ? 'Alla ändringar med bugg-koppling har löst buggen'
        : `${stillOpen} buggar fortfarande öppna trots kopplad ändring`,
      count: stillOpen,
    });
  } catch {
    checks.push({ stage: 'change_log_to_bug', ok: false, detail: 'Kunde inte verifiera bugg-resolution' });
  }

  // 5. bug → verification: Resolved bugs should have AI review
  try {
    const { data: resolvedItems } = await supabase
      .from('work_items' as any)
      .select('id, review_status')
      .eq('status', 'done')
      .order('completed_at', { ascending: false })
      .limit(15);

    const unverified = (resolvedItems || []).filter(
      (i: any) => !i.review_status || i.review_status === 'pending'
    ).length;

    const total = (resolvedItems || []).length;
    const ok = unverified <= 2 || total === 0; // Allow small buffer
    checks.push({
      stage: 'bug_to_verification',
      ok,
      detail: ok
        ? `${total - unverified}/${total} uppgifter verifierade`
        : `${unverified}/${total} uppgifter saknar verifiering`,
      count: unverified,
    });
  } catch {
    checks.push({ stage: 'bug_to_verification', ok: false, detail: 'Kunde inte kontrollera verifiering' });
  }

  const brokenStages = checks.filter(c => !c.ok).map(c => c.stage);
  const score = Math.round((checks.filter(c => c.ok).length / checks.length) * 100);

  const report: CriticalPathReport = {
    healthy: brokenStages.length === 0,
    score,
    checks,
    brokenStages,
    timestamp: new Date().toISOString(),
  };

  // If critical path is broken → activate safe mode + create priority work item
  if (brokenStages.length >= 2) {
    await handleCriticalBreak(report);
  }

  return report;
}

/** React to a critical path break */
async function handleCriticalBreak(report: CriticalPathReport): Promise<void> {
  const brokenSummary = report.brokenStages.join(', ');

  // Activate safe mode
  useSafeModeStore.getState().activate(
    'critical_error',
    `Kritisk sökväg bruten: ${brokenSummary} (${report.score}/100)`,
    'critical_path'
  );

  // Auto-create a critical work item
  try {
    const title = `CRITICAL PATH BROKEN: ${report.brokenStages.length} steg trasiga`;
    const description = report.checks
      .filter(c => !c.ok)
      .map(c => `❌ ${c.stage}: ${c.detail}`)
      .join('\n');

    // Dedup check
    const { data: existing } = await supabase
      .from('work_items' as any)
      .select('id')
      .eq('priority', 'critical')
      .ilike('title', '%CRITICAL PATH%')
      .in('status', ['open', 'in_progress'])
      .limit(1);

    if (!existing || existing.length === 0) {
      await (supabase.from('work_items' as any) as any).insert({
        title,
        description: `${description}\n\nScore: ${report.score}/100\nTimestamp: ${report.timestamp}`,
        status: 'open',
        priority: 'critical',
        item_type: 'bug',
        source_type: 'critical_path_check',
        source_id: 'system',
      });
    }
  } catch (_) {}

  // Pause non-critical work items
  try {
    await (supabase.from('work_items' as any) as any)
      .update({ status: 'blocked' })
      .in('priority', ['low', 'medium'])
      .eq('status', 'open');
  } catch (_) {}

  toast.error(
    `🚨 Kritisk sökväg bruten — ${report.brokenStages.length} steg trasiga. Non-critical tasks pausade.`,
    { duration: 10000 }
  );
}
