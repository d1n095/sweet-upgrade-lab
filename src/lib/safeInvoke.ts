import { supabase } from '@/integrations/supabase/client';

// ── SYSTEM LOCKED ───────────────────────────────────────────────────────────
// All Supabase Edge Function calls MUST go through safeInvoke or safeFetch.
// Direct supabase.functions.invoke() calls outside this file are prohibited.
// ────────────────────────────────────────────────────────────────────────────

const ALLOWED_FUNCTIONS = new Set([
  'process-refund',
  'notify-review',
  'send-order-email',
  'lookup-order',
  'create-checkout',
  'translate-product',
  'run-full-scan',
  'get-latest-scan-run',
  'get-scan-run-by-id',
  'apply-fix',
  'access-control-scan',
  'permission-fix',
  'access-flow-validate',
  'data-sync',
  'stripe-webhook',
  'process-bug-report',
  'generate-receipt',
  'automation-engine',
  'generate-product-content',
  'suggest-product-metadata',
  'shopify-proxy',
  'send-welcome-email',
  'notify-influencer',
  'notify-affiliate',
  'google-places',
]);

const ADMIN_ONLY_FUNCTIONS = new Set([
  'run-full-scan',
  'get-latest-scan-run',
  'get-scan-run-by-id',
  'apply-fix',
  'access-control-scan',
  'permission-fix',
  'access-flow-validate',
  'data-sync',
  'stripe-webhook',
  'process-bug-report',
  'generate-receipt',
  'automation-engine',
  'generate-product-content',
  'suggest-product-metadata',
  'shopify-proxy',
  'notify-influencer',
  'notify-affiliate',
  'process-refund',
]);

let _traceCounter = 0;
function newTraceId(): string {
  return `t-${Date.now()}-${++_traceCounter}`;
}

interface InvokeOptions {
  body?: Record<string, unknown>;
  isAdmin?: boolean;
}

interface InvokeResult<T = unknown> {
  data: T | null;
  error: Error | null;
  traceId: string;
}

/** Invoke an edge function by name, with whitelist + admin guard. */
export async function safeInvoke<T = unknown>(
  functionName: string,
  options: InvokeOptions = {}
): Promise<InvokeResult<T>> {
  const traceId = newTraceId();

  if (!ALLOWED_FUNCTIONS.has(functionName)) {
    const err = new Error(`BLOCKED: function "${functionName}" is not in ALLOWED_FUNCTIONS`);

    return { data: null, error: err, traceId };
  }

  if (ADMIN_ONLY_FUNCTIONS.has(functionName) && !options.isAdmin) {
    const err = new Error(`BLOCKED: function "${functionName}" requires isAdmin:true`);

    return { data: null, error: err, traceId };
  }

  const { data, error } = await supabase.functions.invoke<T>(functionName, {
    body: options.body,
  });

  if (error) {

  }

  return { data: data ?? null, error: error ?? null, traceId };
}

interface FetchOptions {
  method?: string;
  params?: Record<string, string>;
  body?: unknown;
  signal?: AbortSignal;
  isAdmin?: boolean;
  headers?: Record<string, string>;
}

/**
 * Fetch an edge function URL directly, returning the raw Response.
 * Use this when you need the raw HTTP status, streaming, or AbortSignal.
 */
export async function safeFetch(
  functionName: string,
  options: FetchOptions = {}
): Promise<Response> {
  const traceId = newTraceId();

  if (!ALLOWED_FUNCTIONS.has(functionName)) {
    throw new Error(`[safeFetch][${traceId}] BLOCKED: function "${functionName}" is not in ALLOWED_FUNCTIONS`);
  }

  if (ADMIN_ONLY_FUNCTIONS.has(functionName) && !options.isAdmin) {
    throw new Error(`[safeFetch][${traceId}] BLOCKED: function "${functionName}" requires isAdmin:true`);
  }

  const base = import.meta.env.VITE_SUPABASE_URL as string;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

  let url = `${base}/functions/v1/${functionName}`;
  if (options.params && Object.keys(options.params).length > 0) {
    url += '?' + new URLSearchParams(options.params).toString();
  }

  const { data: { session } } = await supabase.auth.getSession();

  const resp = await fetch(url, {
    method: options.method ?? (options.body !== undefined ? 'POST' : 'GET'),
    headers: {
      'Content-Type': 'application/json',
      apikey: anonKey,
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      ...options.headers,
    },
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
    ...(options.signal ? { signal: options.signal } : {}),
  });

  return resp;
}
