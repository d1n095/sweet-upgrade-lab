import { supabase } from '@/integrations/supabase/client';

/**
 * Single backend entry point.
 * All Supabase Edge Function calls MUST go through safeInvoke or safeFetch.
 * Direct supabase.functions.invoke() calls are prohibited outside this file.
 * Admin privilege checks are enforced exclusively by the edge functions via
 * auth.uid() + role lookup — not by the client.
 *
 * Architecture: UI → safeInvoke → Edge Function (role check) → DB
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

// ── API call log ─────────────────────────────────────────────────────────────

export type ApiLogEntry = {
  traceId: string;
  functionName: string;
  requestedAt: string;
  respondedAt: string | null;
  durationMs: number | null;
  attempt: number;
  status: 'ok' | 'error' | 'blocked';
  error: string | null;
};

const MAX_LOG_ENTRIES = 50;
const _apiLog: ApiLogEntry[] = [];

/** Read-only snapshot of the last 50 API calls. Newest first. */
export function getApiLog(): ReadonlyArray<ApiLogEntry> {
  return _apiLog;
}

function pushLog(entry: ApiLogEntry) {
  _apiLog.unshift(entry);
  if (_apiLog.length > MAX_LOG_ENTRIES) _apiLog.length = MAX_LOG_ENTRIES;
}

// ── Retry helper ─────────────────────────────────────────────────────────────

const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 300;

function isRetryable(error: any): boolean {
  if (!error) return false;
  const msg: string = error?.message ?? String(error);
  // Don't retry auth/blocked errors; do retry network/timeout errors
  if (msg.startsWith('BLOCKED') || msg.includes('Unauthorized') || msg.includes('403')) return false;
  return true;
}

async function delay(ms: number) {
  return new Promise<void>((res) => setTimeout(res, ms));
}

// ── safeInvoke ───────────────────────────────────────────────────────────────

type SafeInvokeOptions = {
  body?: Record<string, any>;
  headers?: Record<string, string>;
};

type SafeInvokeResult<T> = {
  data: T | null;
  error: any;
  traceId: string;
};

/**
 * safeInvoke — call an edge function through the enforced whitelist.
 * Retries up to 3 times on transient failures.
 * Logs every attempt to the in-memory API log (last 50).
 * Returns { data, error, traceId }.
 */
export async function safeInvoke<T = any>(
  functionName: string,
  options?: SafeInvokeOptions
): Promise<SafeInvokeResult<T>> {
  const traceId = crypto.randomUUID();
  const requestedAt = new Date().toISOString();

  if (!ALLOWED_FUNCTIONS.has(functionName)) {
    const err = new Error(`BLOCKED: '${functionName}' is not in the allowed functions list`);
    pushLog({
      traceId, functionName, requestedAt, respondedAt: new Date().toISOString(),
      durationMs: 0, attempt: 1, status: 'blocked', error: err.message,
    });
    return { data: null, error: err, traceId };
  }

  const body = { ...(options?.body ?? {}), request_trace_id: traceId };

  let lastError: any = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const attemptStart = Date.now();
    const { data, error } = await supabase.functions.invoke<T>(functionName, {
      body,
      headers: options?.headers,
    });
    const respondedAt = new Date().toISOString();
    const durationMs = Date.now() - attemptStart;

    if (!error) {
      pushLog({ traceId, functionName, requestedAt, respondedAt, durationMs, attempt, status: 'ok', error: null });
      return { data, error: null, traceId };
    }

    lastError = error;
    pushLog({
      traceId, functionName, requestedAt, respondedAt, durationMs,
      attempt, status: 'error', error: error?.message ?? String(error),
    });

    if (attempt < MAX_ATTEMPTS && isRetryable(error)) {
      await delay(RETRY_DELAY_MS * attempt);
    } else {
      break;
    }
  }

  return { data: null, error: lastError, traceId };
}

// ── safeFetch ────────────────────────────────────────────────────────────────

type SafeFetchOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: Record<string, any>;
  params?: Record<string, string>;
  headers?: Record<string, string>;
  signal?: AbortSignal;
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
