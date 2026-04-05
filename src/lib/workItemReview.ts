import { safeInvoke } from './safeInvoke';

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

export const triggerReviewForWorkItem = async (
  workItemId: string,
  options: TriggerReviewOptions = {}
): Promise<TriggerReviewResult> => {
  const context = options.context || 'unknown';

  const { error } = await safeInvoke('notify-review', {
    body: { work_item_id: workItemId, context },
  });

  if (error) {
    return { ok: false, status: 'needs_review', error: error.message };
  }

  return { ok: true, status: 'verified' };
};
