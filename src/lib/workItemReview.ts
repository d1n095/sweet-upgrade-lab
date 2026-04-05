import { supabase } from '@/integrations/supabase/client';

export interface ReviewResult {
  ok: boolean;
  status: 'manual_review_required' | null;
  error?: string;
}

/**
 * Triggers a review for a work item.
 * AI review has been removed – this marks the item as requiring manual review.
 */
export const triggerReviewForWorkItem = async (
  workItemId: string,
  options: { context?: string } = {}
): Promise<ReviewResult> => {
  const context = options.context || 'unknown';
  console.info('[review] trigger manual review', { workItemId, context });

  try {
    const { error } = await supabase
      .from('work_items')
      .update({ status: 'manual_review_required' } as any)
      .eq('id', workItemId);

    if (error) throw error;

    return { ok: true, status: 'manual_review_required' };
  } catch (err: any) {
    console.error('[review] failed', { workItemId, context, message: err?.message });
    return { ok: false, status: null, error: err?.message || 'Unknown error' };
  }
};
