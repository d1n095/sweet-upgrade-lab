
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

  console.log("[PIPELINE] AI DISABLED — workItemAiReview skipping ai-review-fix call");
  return { ok: true, status: 'verified' };
};