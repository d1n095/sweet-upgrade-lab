import { supabase } from '@/integrations/supabase/client';

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
 * Rule-based work item review. Marks items as 'needs_review' for manual
 * verification, or 'verified' when resolution notes or a completed_at date
 * are present.
 */
export const triggerReviewForWorkItem = async (
  workItemId: string,
  options: TriggerReviewOptions = {}
): Promise<TriggerReviewResult> => {
  const context = options.context || 'unknown';
  console.info('[review] trigger (rule-based)', { workItemId, context });

  try {
    const { data: item, error: fetchError } = await supabase
      .from('work_items')
      .select('id, title, resolution_notes, status, completed_at')
      .eq('id', workItemId)
      .maybeSingle();

    if (fetchError || !item) {
      throw new Error(fetchError?.message || 'Work item not found');
    }

    const hasResolution = !!item.resolution_notes && item.resolution_notes.trim().length > 0;
    const isDone = item.status === 'done' && !!item.completed_at;

    const reviewResult = {
      status: (hasResolution || isDone) ? 'verified' : 'needs_review' as ReviewStatus,
      verdict: hasResolution
        ? 'Regelbaserad verifiering: resolution notes finns'
        : isDone
          ? 'Regelbaserad verifiering: uppgift klarmarkerad'
          : 'Kräver manuell granskning',
      confidence: hasResolution ? 70 : isDone ? 60 : 30,
      risks: [] as string[],
      edge_cases: [] as string[],
    };

    await supabase
      .from('work_items')
      .update({
        review_status: reviewResult.status,
        review_result: reviewResult,
        review_at: new Date().toISOString(),
      } as any)
      .eq('id', workItemId);

    console.info('[review] complete (rule-based)', { workItemId, context, status: reviewResult.status });
    return { ok: true, status: reviewResult.status as ReviewStatus, review: reviewResult };
  } catch (err: any) {
    const message = err?.message || 'Unknown review error';

    await supabase
      .from('work_items')
      .update({
        review_status: 'needs_review',
        review_result: {
          status: 'needs_review',
          verdict: `Granskning misslyckades (${context})`,
          confidence: 0,
          error: message,
        },
        review_at: new Date().toISOString(),
      } as any)
      .eq('id', workItemId);

    return { ok: false, status: 'needs_review', error: message };
  }
};
