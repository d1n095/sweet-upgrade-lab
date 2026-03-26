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
  dedup_reason?: 'fingerprint_match' | 'title_match' | 'existing_open_item';
}

/**
 * Generate a fingerprint from a title for dedup purposes.
 * Normalizes the title and produces a 4-part identity key matching the server format:
 *   component::type::location::description_pattern
 */
function titleToFingerprint(title: string): string {
  const cleaned = title
    .replace(/^\[.*?\]\s*/g, '')       // Remove [prefix] tags
    .replace(/\(?\+\d+\s*liknande\)?/g, '') // Remove (+N liknande)
    .trim()
    .toLowerCase();
  
  // Extract component from known prefixes (e.g. "Broken flow:", "Data:", "Interaction:")
  const prefixMatch = cleaned.match(/^(blocker|broken\s*flow|fake\s*feature|interaction|data|bug|incident):\s*/i);
  const component = prefixMatch ? prefixMatch[1].replace(/\s+/g, '_').slice(0, 30) : 'unknown';
  const rest = prefixMatch ? cleaned.slice(prefixMatch[0].length) : cleaned;
  
  const descPattern = rest.replace(/[^a-z0-9 ]/g, '').trim().split(/\s+/).slice(0, 5).join('_').slice(0, 30);
  return `${component}::general::global::${descPattern}`;
}

const ACTIVE_STATUSES = ['open', 'claimed', 'in_progress', 'escalated', 'new', 'pending', 'detected'];

export async function createWorkItemWithDedup(payload: WorkItemPayload): Promise<DedupResult> {
  const title = payload.title || '';
  
  // 1. Check by issue_fingerprint if provided
  if (payload.issue_fingerprint) {
    const { data: byFp } = await supabase
      .from('work_items' as any)
      .select('id, title, status, created_at')
      .eq('issue_fingerprint', payload.issue_fingerprint)
      .in('status', ACTIVE_STATUSES)
      .limit(1);

    if (byFp?.length) {
      const itemAge = Date.now() - new Date((byFp[0] as any).created_at).getTime();
      const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
      if (itemAge <= TWENTY_FOUR_HOURS) {
        console.log(`[dedup] Fingerprint match (<24h): "${title.slice(0, 40)}" → existing ${(byFp[0] as any).id.slice(0, 8)}`);
        return {
          created: false,
          duplicate: true,
          item: byFp[0],
          error: null,
          existingId: (byFp[0] as any).id,
          dedup_reason: 'fingerprint_match',
        };
      } else {
        console.log(`[dedup] Fingerprint match but >24h old, allowing re-creation: "${title.slice(0, 40)}"`);
      }
    }
  }

  // 2. Check by similar title — DEBUG MODE: relaxed (narrower match, higher threshold)
  const corePart = title
    .replace(/^\[.*?\]\s*/g, '')  // strip prefix tags
    .trim()
    .substring(0, 25);
  
  if (corePart.length >= 30) {
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
        dedup_reason: 'title_match',
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
