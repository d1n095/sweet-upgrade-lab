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

export const triggerAiReviewForWorkItem = async (
  workItemId: string,
  options: TriggerAiReviewOptions = {}
): Promise<TriggerAiReviewResult> => {
  const context = options.context || 'unknown';
  console.info('[ai-review] trigger', { workItemId, context });

  try {
    const { data, error } = await safeInvoke('ai-review-fix', { work_item_id: workItemId });

    if (error) throw error;

    const review = (data as any)?.review;
    const status = (review?.status as AiReviewStatus) ?? null;

    console.info('[ai-review] complete', { workItemId, context, status });
    return { ok: true, status, review };
  } catch (err: any) {
    const message = err?.message || 'Unknown AI review error';
    console.error('[ai-review] failed', { workItemId, context, message });

    await supabase
      .from('work_items')
      .update({
        ai_review_status: 'needs_review',
        ai_review_result: {
          status: 'needs_review',
          verdict: `AI-granskning misslyckades (${context})`,
          confidence: 0,
          error: message,
        },
        ai_review_at: new Date().toISOString(),
      } as any)
      .eq('id', workItemId);

    return { ok: false, status: 'needs_review', error: message };
  }
};);

    if (error) throw error;

    const review = (data as any)?.review;
    const status = (review?.status as AiReviewStatus) ?? null;

    console.info('[ai-review] complete', { workItemId, context, status });
    return { ok: true, status, review };
  } catch (err: any) {
    const message = err?.message || 'Unknown AI review error';
    console.error('[ai-review] failed', { workItemId, context, message });

    await supabase
      .from('work_items')
      .update({
        ai_review_status: 'needs_review',
        ai_review_result: {
          status: 'needs_review',
          verdict: `AI-granskning misslyckades (${context})`,
          confidence: 0,
          error: message,
        },
        ai_review_at: new Date().toISOString(),
      } as any)
      .eq('id', workItemId);

    return { ok: false, status: 'needs_review', error: message };
  }
};