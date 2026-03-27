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
  // AI review disabled — system fully isolated, no AI calls allowed
  console.info('[ai-review] skipped (AI disabled)', { workItemId, context: options.context || 'unknown' });
  return { ok: true, status: null };
};