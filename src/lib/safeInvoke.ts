import { supabase } from '@/integrations/supabase/client';

/**
 * Single backend entry point.
 * All Supabase Edge Function calls MUST go through safeInvoke or safeFetch.
 * Direct supabase.functions.invoke() calls are prohibited outside this file.
 *
 * Architecture: UI → safeInvoke → Edge Function → DB
 */

const ALLOWED_FUNCTIONS = new Set([
  'process-refund',
  'notify-review',
  'send-order-email',
  'lookup-order',
  'create-checkout',
  'translate-product',
  'run-full-scan',
  'apply-fix',
  'access-control-scan',
  'permission-fix',
  'access-flow-validate',
  'ai-user-management',
  'data-sync',
  'process-bug-report',
  'generate-receipt',
  'notify-affiliate',
  'notify-influencer',
  'create-shipment',
  'google-places',
  'send-welcome-email',
  'send-review-reminder',
  'send-retention-email',
  'process-email-queue',
  'automation-engine',
  'ai-task-manager',
  'generate-product-content',
  'suggest-product-metadata',
  'sitemap',
  'stripe-webhook',
]);

const ADMIN_ONLY_FUNCTIONS = new Set([
  'run-full-scan',
  'apply-fix',
  'access-control-scan',
  'permission-fix',
  'access-flow-validate',
  'ai-user-management',
  'data-sync',
  'process-bug-report',
  'generate-receipt',
  'automation-engine',
  'ai-task-manager',
  'generate-product-content',
  'suggest-product-metadata',
]);

type SafeInvokeOptions = {
  body?: Record<string, any>;
  headers?: Record<string, string>;
  isAdmin?: boolean;
};

type SafeInvokeResult<T> = {
  data: T | null;
  error: any;
  traceId: string;
};

/**
 * safeInvoke — call an edge function through the enforced whitelist.
 * Returns { data, error, traceId }.
 */
export async function safeInvoke<T = any>(
  functionName: string,
  options?: SafeInvokeOptions
): Promise<SafeInvokeResult<T>> {
  const traceId = crypto.randomUUID();

  if (!ALLOWED_FUNCTIONS.has(functionName)) {
    const err = new Error(`BLOCKED: '${functionName}' is not in the allowed functions list`);
    return { data: null, error: err, traceId };
  }

  if (ADMIN_ONLY_FUNCTIONS.has(functionName) && !options?.isAdmin) {
    const err = new Error(`BLOCKED: '${functionName}' requires admin privileges`);
    return { data: null, error: err, traceId };
  }

  const body = {
    ...(options?.body || {}),
    request_trace_id: traceId,
  };

  const { data, error } = await supabase.functions.invoke<T>(functionName, {
    body,
    headers: options?.headers,
  });

  return { data, error, traceId };
}

type SafeFetchOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: Record<string, any>;
  params?: Record<string, string>;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  isAdmin?: boolean;
};

/**
 * safeFetch — call an edge function and return the raw Response.
 * Use when you need HTTP status codes, HTML responses, or GET requests.
 */
export async function safeFetch(
  functionName: string,
  options?: SafeFetchOptions
): Promise<Response> {
  if (!ALLOWED_FUNCTIONS.has(functionName)) {
    const traceId = crypto.randomUUID();
    return new Response(
      JSON.stringify({ success: false, error: `BLOCKED: '${functionName}'`, traceId }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (ADMIN_ONLY_FUNCTIONS.has(functionName) && !options?.isAdmin) {
    const traceId = crypto.randomUUID();
    return new Response(
      JSON.stringify({ success: false, error: `BLOCKED: admin required`, traceId }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const baseUrl = (supabase as any).functionsUrl ?? `${(supabase as any).supabaseUrl}/functions/v1`;
  const traceId = crypto.randomUUID();

  let url = `${baseUrl}/${functionName}`;
  if (options?.params && Object.keys(options.params).length > 0) {
    url += '?' + new URLSearchParams(options.params).toString();
  }

  const method = options?.method ?? (options?.body ? 'POST' : 'GET');
  const body =
    method !== 'GET' && options?.body
      ? JSON.stringify({ ...options.body, request_trace_id: traceId })
      : undefined;

  return fetch(url, {
    method,
    body,
    signal: options?.signal,
    headers: {
      'Content-Type': 'application/json',
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      ...(options?.headers ?? {}),
    },
  });
}
