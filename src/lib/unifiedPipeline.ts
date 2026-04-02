import { supabase } from '@/integrations/supabase/client';
import { logChange } from '@/utils/changeLogger';
import { triggerAiReviewForWorkItem } from '@/lib/workItemReview';
import { useSafeModeStore } from '@/stores/safeModeStore';
import { recordRootCause, checkKnownPatterns } from '@/lib/rootCauseMemory';

export type PipelineStage = 'scan' | 'issues' | 'work_items' | 'change_log' | 'verification';

export interface PipelineEvent {
  stage: PipelineStage;
  action: string;
  entityId: string;
  entityType: string;
  timestamp: string;
  success: boolean;
  detail?: string;
  linkedIds?: Record<string, string>;
}

export interface PipelineRun {
  id: string;
  startedAt: string;
  completedAt?: string;
  events: PipelineEvent[];
  stats: Record<PipelineStage, { processed: number; linked: number; errors: number }>;
}

const makeEvent = (
  stage: PipelineStage, action: string, entityId: string,
  entityType: string, success: boolean, detail?: string,
  linkedIds?: Record<string, string>
): PipelineEvent => ({
  stage, action, entityId, entityType, timestamp: new Date().toISOString(),
  success, detail, linkedIds,
});

const emptyStats = (): PipelineRun['stats'] => ({
  scan: { processed: 0, linked: 0, errors: 0 },
  issues: { processed: 0, linked: 0, errors: 0 },
  work_items: { processed: 0, linked: 0, errors: 0 },
  change_log: { processed: 0, linked: 0, errors: 0 },
  verification: { processed: 0, linked: 0, errors: 0 },
});

/**
 * Run the full pipeline:
 * 1. scan → find unlinked issues from recent scans
 * 2. issues → ensure bugs have work_items
 * 3. work_items → ensure done items have change_log entries
 * 4. change_log → match to bugs for resolution
 * 5. verification → trigger AI review on completed items
 */
export const runUnifiedPipeline = async (
  onEvent?: (event: PipelineEvent) => void
): Promise<PipelineRun> => {
  const runId = `pipe-${Date.now()}`;
  const run: PipelineRun = {
    id: runId,
    startedAt: new Date().toISOString(),
    events: [],
    stats: emptyStats(),
  };

  const emit = (e: PipelineEvent) => {
    run.events.push(e);
    const stage = run.stats[e.stage];
    stage.processed++;
    if (e.success) stage.linked++;
    else stage.errors++;
    onEvent?.(e);
  };

  // Check safe mode
  if (useSafeModeStore.getState().active) {
    emit(makeEvent('scan', 'blocked', runId, 'pipeline', false, 'Safe Mode aktiv — pipeline pausad'));
    run.completedAt = new Date().toISOString();
    return run;
  }

  try {
    // ─── STAGE 1: SCAN → ISSUES ───
    // Find recent scan results that created tasks but haven't been linked
    const { data: recentScans } = await supabase
      .from('ai_scan_results')
      .select('id, scan_type, issues_count, tasks_created, created_at')
      .order('created_at', { ascending: false })
      .limit(10);

    for (const scan of recentScans || []) {
      emit(makeEvent('scan', 'check', scan.id, 'ai_scan_results', true,
        `Scan ${scan.scan_type}: ${scan.issues_count || 0} issues, ${scan.tasks_created || 0} tasks`));

      // Check if scan has linked work items
      const { data: linkedItems } = await supabase
        .from('work_items' as any)
        .select('id')
        .in('source_type', ['ai_scan', 'ai_detection'])
        .eq('source_id', scan.id)
        .limit(5);

      if ((scan.tasks_created || 0) > 0 && (!linkedItems || linkedItems.length === 0)) {
        emit(makeEvent('scan', 'gap_detected', scan.id, 'ai_scan_results', false,
          `Scan skapade ${scan.tasks_created} uppgifter men inga work_items finns länkade`,
          { scan_id: scan.id }));
      }
    }

    // ─── STAGE 2: ISSUES → WORK ITEMS ───
    // Find bugs without work items
    const { data: unlinkedBugs } = await supabase
      .from('bug_reports')
      .select('id, description, ai_severity, status')
      .in('status', ['open', 'new', 'triaged'])
      .limit(50);

    for (const bug of unlinkedBugs || []) {
      const { data: existingWI } = await supabase
        .from('work_items' as any)
        .select('id')
        .eq('source_type', 'bug_report')
        .eq('source_id', bug.id)
        .limit(1);

      if (!existingWI || existingWI.length === 0) {
        // Check known patterns for smarter priority/context
        const patterns = await checkKnownPatterns(bug.description || '');
        const knownFix = patterns.matches.length > 0 ? patterns.matches[0] : null;

        const priority = bug.ai_severity === 'critical' ? 'critical' :
          bug.ai_severity === 'high' ? 'high' : 'medium';

        const description = knownFix
          ? `${bug.description}\n\n🧠 Känt mönster (sett ${knownFix.recurrence_count}x): ${knownFix.root_cause}\n💡 Tidigare fix: ${knownFix.fix_applied}`
          : bug.description;

        // Try match runtime_trace within 60s
        let traceId: string | undefined;
        try {
          const cutoff = new Date(Date.now() - 60_000).toISOString();
          const { data: traces } = await supabase
            .from('runtime_traces')
            .select('id')
            .gte('created_at', cutoff)
            .order('created_at', { ascending: false })
            .limit(1);
          if (traces?.length) traceId = traces[0].id;
        } catch (_) {}

        const { data: newWI, error } = await (supabase.from('work_items' as any) as any)
          .insert({
            title: `Bug: ${(bug.description || '').slice(0, 80)}`,
            description,
            status: 'open',
            priority,
            item_type: 'bug',
            source_type: 'bug_report',
            source_id: bug.id,
            ...(traceId ? { runtime_trace_id: traceId } : {}),
          })
          .select('id')
          .single();

        if (newWI && !error) {
          emit(makeEvent('issues', 'auto_linked', bug.id, 'bug_report', true,
            `Skapade work item${knownFix ? ` (känt mönster: ${knownFix.recurrence_count}x)` : ''}`,
            { bug_id: bug.id, work_item_id: (newWI as any).id }));
        } else {
          emit(makeEvent('issues', 'link_failed', bug.id, 'bug_report', false,
            `Kunde inte skapa work item: ${error?.message || 'okänt fel'}`));
        }
      } else {
        emit(makeEvent('issues', 'already_linked', bug.id, 'bug_report', true,
          'Bugg redan länkad till work item', { work_item_id: (existingWI[0] as any).id }));
      }
    }

    // ─── STAGE 3: WORK ITEMS → CHANGE LOG ───
    // Find completed work items without change_log entries
    const { data: doneItems } = await supabase
      .from('work_items' as any)
      .select('id, title, source_type, source_id, completed_at')
      .eq('status', 'done')
      .order('completed_at', { ascending: false })
      .limit(30);

    for (const item of (doneItems || []) as any[]) {
      const { data: existingLog } = await supabase
        .from('change_log')
        .select('id')
        .eq('work_item_id', item.id)
        .limit(1);

      if (!existingLog || existingLog.length === 0) {
        // Auto-create change_log entry
        await logChange({
          change_type: 'fix',
          description: `Slutförd: ${item.title}`,
          source: 'system',
          work_item_id: item.id,
          bug_report_id: item.source_type === 'bug_report' ? item.source_id : undefined,
          affected_components: ['auto_pipeline'],
        });

        emit(makeEvent('work_items', 'log_created', item.id, 'work_item', true,
          `Ändringslogg skapad för slutförd uppgift`, { work_item_id: item.id }));
      } else {
        emit(makeEvent('work_items', 'log_exists', item.id, 'work_item', true,
          'Ändringslogg finns redan'));
      }
    }

    // ─── STAGE 4: CHANGE LOG → BUG MATCHING ───
    // Find change_log entries with bug_report_id and ensure bug is marked resolved
    const { data: bugChanges } = await supabase
      .from('change_log')
      .select('id, bug_report_id, work_item_id, description')
      .not('bug_report_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(30);

    for (const change of bugChanges || []) {
      if (!change.bug_report_id) continue;

      const { data: bug } = await supabase
        .from('bug_reports')
        .select('id, status')
        .eq('id', change.bug_report_id)
        .single();

      if (bug && bug.status !== 'resolved' && bug.status !== 'duplicate') {
        // Auto-resolve bug that has a linked change
        await supabase.from('bug_reports').update({
          status: 'resolved',
          resolved_at: new Date().toISOString(),
          resolved_by_change_id: change.id,
          resolution_notes: `Auto-löst via pipeline: ${change.description?.slice(0, 100)}`,
        }).eq('id', bug.id);

        // Record root cause memory
        await recordRootCause({
          bug_report_id: bug.id,
          work_item_id: change.work_item_id || undefined,
          change_log_id: change.id,
          root_cause: change.description || 'Unknown root cause',
          affected_system: 'pipeline',
          fix_applied: change.description || 'Auto-resolved via change log',
          severity: 'medium',
        });

        emit(makeEvent('change_log', 'bug_resolved', change.id, 'change_log', true,
          `Bugg auto-löst + root cause registrerad`, { bug_id: bug.id, change_id: change.id }));
      } else if (bug) {
        emit(makeEvent('change_log', 'bug_already_resolved', change.id, 'change_log', true,
          'Bugg redan löst'));
      }
    }

    // ─── STAGE 5: VERIFICATION ───
    // Trigger AI review on recently completed work items that lack verification
    const { data: unverified } = await supabase
      .from('work_items' as any)
      .select('id, title, ai_review_status')
      .eq('status', 'done')
      .in('ai_review_status', ['pending', null as any])
      .order('completed_at', { ascending: false })
      .limit(5);

    for (const item of (unverified || []) as any[]) {
      try {
        const result = await triggerAiReviewForWorkItem(item.id, { context: 'unified_pipeline' });
        emit(makeEvent('verification', 'ai_review', item.id, 'work_item', result.ok,
          result.ok ? `Verifierat: ${result.status}` : `Granskning misslyckades: ${result.error}`,
          { work_item_id: item.id }));
      } catch (err: any) {
        emit(makeEvent('verification', 'review_error', item.id, 'work_item', false,
          err?.message || 'AI review kraschade'));
      }
    }
  } catch (err: any) {
    emit(makeEvent('scan', 'pipeline_error', runId, 'pipeline', false, err?.message || 'Pipeline kraschade'));
    useSafeModeStore.getState().activate('critical_error', `Pipeline kraschade: ${err?.message}`, 'pipeline');
  }

  run.completedAt = new Date().toISOString();
  return run;
};
