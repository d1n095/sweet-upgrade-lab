import { supabase } from '@/integrations/supabase/client';

// ── SYSTEM LOCKED ─────────────────────────────────────────────────────────────
// All Edge Function invocations MUST go through safeInvoke or safeFetch.
// Direct supabase.functions.invoke() / fetch() calls to /functions/v1/ outside
// this file are prohibited.
// ─────────────────────────────────────────────────────────────────────────────

const ALLOWED_FUNCTIONS = new Set([
  'process-refund',
  'notify-review',
  'send-order-email',
  'send-welcome-email',
  'apply-fix',
  'access-control-scan',
  'permission-fix',
  'access-flow-validate',
  'notify-influencer',
  'notify-affiliate',
  'generate-receipt',
  'generate-product-content',
  'suggest-product-metadata',
  'shopify-proxy',
  'automation-engine',
  'ai-task-manager',
  'data-sync',
  'process-bug-report',
  'google-places',
  'stripe-webhook',
  'ai-user-management',
]);

const ADMIN_ONLY_FUNCTIONS = new Set([
  'run-full-scan',
  'apply-fix',
  'access-control-scan',
  'permission-fix',
  'access-flow-validate',
  'notify-influencer',
  'notify-affiliate',
  'generate-receipt',
  'generate-product-content',
  'suggest-product-metadata',
  'shopify-proxy',
  'automation-engine',
  'ai-task-manager',
  'data-sync',
  'process-bug-report',
  'send-order-email',
  'ai-user-management',
  'stripe-webhook',
]);

function assertAllowed(functionName: string, isAdmin: boolean | undefined): void {
  if (!ALLOWED_FUNCTIONS.has(functionName)) {
    throw new Error(`[safeInvoke] BLOCKED: '${functionName}' is not in ALLOWED_FUNCTIONS`);
  }
  if (ADMIN_ONLY_FUNCTIONS.has(functionName) && !isAdmin) {
    throw new Error(`[safeInvoke] BLOCKED: '${functionName}' requires isAdmin: true`);
  }
}

/**
 * Canonical wrapper for all Supabase Edge Function calls.
 * Enforces that admin-only functions are called with isAdmin: true.
 * Attaches a request_trace_id for end-to-end tracing.
 * Returns { data, error, request_trace_id }.
 */
export async function safeInvoke<T = any>(
  functionName: string,
  options?: {
    body?: Record<string, any>;
    headers?: Record<string, string>;
    isAdmin?: boolean;
  }
): Promise<{ data: T | null; error: any; request_trace_id: string }> {
  try {
    assertAllowed(functionName, options?.isAdmin);
  } catch (err: any) {
    console.error(err.message);
    return { data: null, error: err, request_trace_id: '' };
  }

  const request_trace_id = crypto.randomUUID();

  const body = {
    ...(options?.body ?? {}),
    request_trace_id,
  };

  const { data, error } = await supabase.functions.invoke(functionName, {
    headers: options?.headers,
    body,
  });

  return { data, error, request_trace_id };
}

/**
 * Variant of safeInvoke that returns the raw fetch Response.
 * Use when you need HTTP status codes, HTML bodies, AbortSignal, or GET requests.
 */
export async function safeFetch(
  functionName: string,
  options?: {
    method?: 'GET' | 'POST';
    body?: Record<string, any>;
    params?: Record<string, string>;
    headers?: Record<string, string>;
    isAdmin?: boolean;
    signal?: AbortSignal;
  }
): Promise<Response> {
  assertAllowed(functionName, options?.isAdmin);

  const traceId = crypto.randomUUID();
  const method = options?.method ?? 'POST';
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  let url = `${supabaseUrl}/functions/v1/${functionName}`;
  if (method === 'GET' && options?.params) {
    url += `?${new URLSearchParams(options.params).toString()}`;
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData?.session?.access_token;

  const fetchOptions: RequestInit = {
    method,
    headers: {
      ...(method !== 'GET' && { 'Content-Type': 'application/json' }),
      apikey: anonKey,
      ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
      ...options?.headers,
    },
    signal: options?.signal,
  };

  if (method !== 'GET') {
    fetchOptions.body = JSON.stringify({
      ...(options?.body ?? {}),
      request_trace_id: traceId,
    });
  }

  return fetch(url, fetchOptions);
}
