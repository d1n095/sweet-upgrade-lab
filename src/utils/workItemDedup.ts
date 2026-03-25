/**
 * Create a work item with duplicate detection.
 * 
 * Before inserting, checks for existing open/active items with:
 *  1. Same issue_fingerprint (exact match)
 *  2. Similar title (fuzzy ILIKE match on first 50 chars)
 * 
 * If a duplicate is found, returns the existing item instead of creating a new one.
 */
import { supabase } from '@/integrations/supabase/client';
import { createAndVerify } from '@/utils/createVerifyLoop';

interface WorkItemPayload {
  title: string;
  description?: string;
  item_type?: string;
  priority?: string;
  status?: string;
  source_type?: string;
  source_id?: string | null;
  ai_detected?: boolean;
  ai_confidence?: string;
  ai_category?: string;
  ai_type_classification?: string;
  issue_fingerprint?: string;
  created_by?: string;
  assigned_to?: string;
  claimed_by?: string;
  claimed_at?: string;
  related_order_id?: string;
  [key: string]: any;
}

interface DedupResult {
  created: boolean;
  duplicate: boolean;
  item: any | null;
  error: string | null;
  existingId?: string;
}

/**
 * Generate a fingerprint from a title for dedup purposes.
 * Normalizes the title by removing prefixes like [Auto-fix], [Visual QA], etc.
 */
function titleToFingerprint(title: string): string {
  return title
    .replace(/^\[.*?\]\s*/g, '')       // Remove [prefix] tags
    .replace(/\(?\+\d+\s*liknande\)?/g, '') // Remove (+N liknande)
    .trim()
    .toLowerCase()
    .replace(/[^a-zåäö0-9\s]/g, '')     // Keep letters, digits, spaces
    .replace(/\s+/g, '_')
    .slice(0, 80);
}

const ACTIVE_STATUSES = ['open', 'claimed', 'in_progress', 'escalated'];

export async function createWorkItemWithDedup(payload: WorkItemPayload): Promise<DedupResult> {
  const title = payload.title || '';
  
  // 1. Check by issue_fingerprint if provided
  if (payload.issue_fingerprint) {
    const { data: byFp } = await supabase
      .from('work_items' as any)
      .select('id, title, status')
      .eq('issue_fingerprint', payload.issue_fingerprint)
      .in('status', ACTIVE_STATUSES)
      .limit(1);

    if (byFp?.length) {
      console.log(`[dedup] Fingerprint match: "${title.slice(0, 40)}" → existing ${(byFp[0] as any).id.slice(0, 8)}`);
      return {
        created: false,
        duplicate: true,
        item: byFp[0],
        error: null,
        existingId: (byFp[0] as any).id,
      };
    }
  }

  // 2. Check by similar title (fuzzy match on core part)
  const corePart = title
    .replace(/^\[.*?\]\s*/g, '')  // strip prefix tags
    .trim()
    .substring(0, 50);
  
  if (corePart.length >= 10) {
    const { data: byTitle } = await supabase
      .from('work_items' as any)
      .select('id, title, status')
      .ilike('title', `%${corePart}%`)
      .in('status', ACTIVE_STATUSES)
      .limit(1);

    if (byTitle?.length) {
      console.log(`[dedup] Title match: "${title.slice(0, 40)}" ≈ "${(byTitle[0] as any).title.slice(0, 40)}"`);
      return {
        created: false,
        duplicate: true,
        item: byTitle[0],
        error: null,
        existingId: (byTitle[0] as any).id,
      };
    }
  }

  // 3. Auto-generate fingerprint if not provided
  if (!payload.issue_fingerprint) {
    payload.issue_fingerprint = titleToFingerprint(title);
  }

  // 4. Create with verify
  const result = await createAndVerify({
    table: 'work_items',
    payload: {
      status: 'open',
      priority: 'medium',
      item_type: 'general',
      ...payload,
    },
    selectColumns: 'id, title, status',
    maxRetries: 2,
    traceContext: { component: 'createWorkItemWithDedup' },
  });

  if (!result.success) {
    return {
      created: false,
      duplicate: false,
      item: null,
      error: result.error || 'Insert failed',
    };
  }

  return {
    created: true,
    duplicate: false,
    item: result.data,
    error: null,
  };
}
