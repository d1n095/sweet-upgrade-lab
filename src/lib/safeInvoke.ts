import { supabase } from '@/integrations/supabase/client';
import { logInvokeStart, logInvokeEnd, logInvokeBlocked } from '@/lib/invokeLogger';

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
    const blockedMsg = `safeInvoke: function "${functionName}" is not in the approved list`;
    console.error('[safeInvoke] BLOCKED — unapproved function:', functionName, { request_trace_id });
    logInvokeBlocked(functionName, blockedMsg);
    return {
      data: null,
      error: new Error(blockedMsg),
      request_trace_id,
    };
  }

  if (ADMIN_ONLY_FUNCTIONS.has(functionName) && !options?.isAdmin) {
    const blockedMsg = `safeInvoke: function "${functionName}" requires admin access`;
    console.error('[safeInvoke] BLOCKED — admin access required for:', functionName, { request_trace_id });
    logInvokeBlocked(functionName, blockedMsg);
    return {
      data: null,
      error: new Error(blockedMsg),
      request_trace_id,
    };
  }

  console.log('[safeInvoke]', functionName, { request_trace_id });
  const callId = logInvokeStart(functionName, options?.body);
  const t0 = Date.now();

  const body = {
    ...(options?.body || {}),
    request_trace_id,
  };

  const { data, error } = await supabase.functions.invoke<T>(functionName, {
    headers: options?.headers,
    body,
  });

  logInvokeEnd(callId, error ? 'error' : 'success', Date.now() - t0, error?.message);
  return { data, error, request_trace_id };
}

/**
 * Thin approved wrapper around `fetch` for edge-function calls that require
 * raw Response access (GET requests, AbortSignal, HTTP status inspection, etc.).
 *
 * Validates the URL against the approved allowlist and the admin-only guard,
 * then delegates to the platform `fetch` with all original options intact.
 */
export async function safeFetch(
  url: string,
  options?: RequestInit & { isAdmin?: boolean }
): Promise<Response> {
  const match = url.match(/\/functions\/v1\/([^/?#]+)/);
  const functionName = match?.[1];

  if (!functionName || !APPROVED_FUNCTIONS.has(functionName)) {
    console.error('[safeFetch] BLOCKED — unapproved function:', functionName);
    throw new Error(`safeFetch: function "${functionName ?? url}" is not in the approved list`);
  }

  if (ADMIN_ONLY_FUNCTIONS.has(functionName) && !options?.isAdmin) {
    console.error('[safeFetch] BLOCKED — admin access required for:', functionName);
    throw new Error(`safeFetch: function "${functionName}" requires admin access`);
  }

  const { isAdmin: _isAdmin, ...fetchOptions } = options ?? {};
  console.log('[safeFetch]', functionName);
  return fetch(url, fetchOptions);
}
