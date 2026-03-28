import { supabase } from '@/integrations/supabase/client';

// ── WORK ITEM REVIEW — Rule-based (zero AI) ──
// AI review is disabled. Reviews are performed with deterministic rules only.

type ReviewStatus = 'verified' | 'needs_review' | 'incomplete' | 'pending' | null;

interface TriggerReviewOptions {
  context?: string;
}

interface TriggerReviewResult {
  ok: boolean;
  status: ReviewStatus;
  review?: any;
  error?: string;
}

/**
 * Rule-based review for a work item.
 * Previously called ai-review-fix; now uses deterministic status checks only.
 */
export const triggerAiReviewForWorkItem = async (
  workItemId: string,
  options: TriggerReviewOptions = {}
): Promise<TriggerReviewResult> => {
  const context = options.context || 'unknown';

  console.info('[review] rule-based trigger', { workItemId, context });

  try {
    // Fetch work item
    const { data: item, error } = await supabase
      .from('work_items')
      .select('id, status, title, description, verification_status, verification_scans_checked')
      .eq('id', workItemId)
      .single();

    if (error || !item) {
      return { ok: false, status: 'needs_review', error: 'Work item not found' };
    }

    // Rule-based status determination
    let status: ReviewStatus = 'needs_review';

    if (item.status === 'done' && (item.verification_scans_checked ?? 0) >= 2) {
      status = 'verified';
    } else if (item.status === 'done') {
      status = 'pending';
    } else if (['open', 'claimed', 'in_progress'].includes(item.status)) {
      status = 'needs_review';
    }

    // Update work item with rule-based review result
    await supabase
      .from('work_items')
      .update({
        ai_review_status: status,
        ai_review_result: {
          status,
          verdict: `Regelbaserad granskning (${context})`,
          confidence: status === 'verified' ? 85 : 40,
          mode: 'rule_based',
          checked_at: new Date().toISOString(),
        },
        ai_review_at: new Date().toISOString(),
      } as any)
      .eq('id', workItemId);

    console.info('[review] rule-based complete', { workItemId, context, status });
    return { ok: true, status };
  } catch (err: any) {
    const message = err?.message || 'Unknown review error';
    console.error('[review] failed', { workItemId, context, message });
    return { ok: false, status: 'needs_review', error: message };
  }
};
