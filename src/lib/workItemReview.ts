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
 * AI review is fully isolated — this returns a success result without executing
 * any AI calls, satisfying the pipeline interface that expects ok:true and a status value.
 */
export const triggerReviewForWorkItem = async (
  workItemId: string,
  options: TriggerReviewOptions = {}
): Promise<TriggerReviewResult> => {
  console.info('[review] skipped (AI isolated)', { workItemId, context: options.context || 'unknown' });
  return { ok: true, status: null };
};
