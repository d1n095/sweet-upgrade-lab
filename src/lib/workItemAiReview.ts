import { supabase } from '@/integrations/supabase/client';

type AiReviewStatus = 'verified' | 'needs_review' | 'incomplete' | 'pending' | null;

interface TriggerAiReviewOptions {
  context?: string;
}

interface TriggerAiReviewResult {
  ok: boolean;
  status: AiReviewStatus;
  review?: any;
  error?: string;
}

/**
 * AI-FREE review: Uses rule-based verification instead of AI gateway.
 * Simply marks items as 'needs_review' for manual verification.
 */
export const triggerAiReviewForWorkItem = async (
  workItemId: string,
  options: TriggerAiReviewOptions = {}
): Promise<TriggerAiReviewResult> => {
  const context = options.context || 'unknown';
  console.info('[review] trigger (rule-based)', { workItemId, context });

  try {
    // Fetch work item to check if it has resolution notes
    const { data: item, error: fetchError } = await supabase
      .from('work_items')
      .select('id, title, resolution_notes, status, completed_at')
      .eq('id', workItemId)
      .maybeSingle();

    if (fetchError || !item) {
      throw new Error(fetchError?.message || 'Work item not found');
    }

    // Rule-based verification:
    // - Has resolution notes → verified
    // - Status is done and has completed_at → verified
    // - Otherwise → needs_review
    const hasResolution = !!item.resolution_notes && item.resolution_notes.trim().length > 0;
    const isDone = item.status === 'done' && !!item.completed_at;

    const reviewResult = {
      status: (hasResolution || isDone) ? 'verified' : 'needs_review' as AiReviewStatus,
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
        ai_review_status: reviewResult.status,
        ai_review_result: reviewResult,
        ai_review_at: new Date().toISOString(),
      } as any)
      .eq('id', workItemId);

    console.info('[review] complete (rule-based)', { workItemId, context, status: reviewResult.status });
    return { ok: true, status: reviewResult.status as AiReviewStatus, review: reviewResult };
  } catch (err: any) {
    const message = err?.message || 'Unknown review error';
    console.error('[review] failed', { workItemId, context, message });

    await supabase
      .from('work_items')
      .update({
        ai_review_status: 'needs_review',
        ai_review_result: {
          status: 'needs_review',
          verdict: `Granskning misslyckades (${context})`,
          confidence: 0,
          error: message,
        },
        ai_review_at: new Date().toISOString(),
      } as any)
      .eq('id', workItemId);

    return { ok: false, status: 'needs_review', error: message };
  }
};
