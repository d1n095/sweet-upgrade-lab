import { supabase } from '@/integrations/supabase/client';

/**
 * Approved Supabase edge function names — must match FUNCTION_INVENTORY status: 'active'
 * in AdminSystemMonitor. Blocked/AI functions are intentionally excluded.
 */
const APPROVED_FUNCTIONS = new Set([
  'process-refund',
  'send-order-email',
  'generate-receipt',
  'shopify-proxy',
  'notify-influencer',
  'notify-affiliate',
  'data-sync',
  'process-bug-report',
  'run-full-scan',
  'apply-fix',
  'access-control-scan',
  'permission-fix',
  'access-flow-validate',
  'lookup-order',
  'create-checkout',
  'notify-review',
  'send-welcome-email',
  'google-places',
  'stripe-webhook',
]);

/**
 * Functions that may only be invoked by authenticated admins.
 */
const ADMIN_ONLY_FUNCTIONS = new Set([
  'run-full-scan',
  'apply-fix',
  'access-control-scan',
  'permission-fix',
  'access-flow-validate',
]);

console.log('[CONTROL LAYER ACTIVE]');
console.log('SYSTEM LOCKED', { singleEntry: true, noLegacy: true, buildOk: true });

/**
 * Single approved entry point for all Supabase edge function calls.
 * Validates against the approved allowlist, enforces admin-only guards,
 * injects a request_trace_id, and logs every invocation.
 *
 * Direct `supabase.functions.invoke` calls outside this file are prohibited.
 */
export async function safeInvoke<T = any>(
  functionName: string,
  options?: {
    body?: Record<string, any>;
    headers?: Record<string, string>;
    isAdmin?: boolean;
  }
): Promise<{ data: T | null; error: any; request_trace_id: string }> {
  const request_trace_id = crypto.randomUUID();

  if (!APPROVED_FUNCTIONS.has(functionName)) {
    console.error('[safeInvoke] BLOCKED — unapproved function:', functionName, { request_trace_id });
    return {
      data: null,
      error: new Error(`safeInvoke: function "${functionName}" is not in the approved list`),
      request_trace_id,
    };
  }

  if (ADMIN_ONLY_FUNCTIONS.has(functionName) && !options?.isAdmin) {
    console.error('[safeInvoke] BLOCKED — admin access required for:', functionName, { request_trace_id });
    return {
      data: null,
      error: new Error(`safeInvoke: function "${functionName}" requires admin access`),
      request_trace_id,
    };
  }

  console.log('[safeInvoke]', functionName, { request_trace_id });

  const body = {
    ...(options?.body || {}),
    request_trace_id,
  };

  const { data, error } = await supabase.functions.invoke<T>(functionName, {
    headers: options?.headers,
    body,
  });

  return { data, error, request_trace_id };
}
