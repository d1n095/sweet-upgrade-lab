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
 * Trigger a work-item review.
 * AI review is fully isolated — this is a deterministic no-op that satisfies
 * the pipeline contract without executing any AI calls.
 */
export const triggerReviewForWorkItem = async (
  workItemId: string,
  options: TriggerReviewOptions = {}
): Promise<TriggerReviewResult> => {
  console.info('[review] skipped (AI isolated)', { workItemId, context: options.context || 'unknown' });
  return { ok: true, status: null };
};
