import { supabase } from '@/integrations/supabase/client';

/**
 * Strict whitelist of approved Supabase Edge Function names.
 * Any call to a function not listed here will be blocked before
 * a network request is made.
 */
const ALLOWED_FUNCTIONS = new Set([
  // Public / shared
  'process-refund',
  'notify-review',
  'send-order-email',
  'lookup-order',
  'create-checkout',
  'translate-product',
  'process-bug-report',
  'send-welcome-email',
  'notify-influencer',
  'notify-affiliate',
  'generate-receipt',
  'generate-product-content',
  'suggest-product-metadata',
  'google-places',
  'stripe-webhook',
  // Admin-accessible
  'run-full-scan',
  'apply-fix',
  'access-control-scan',
  'access-flow-validate',
  'permission-fix',
  'automation-engine',
  'ai-task-manager',
  'ai-user-management',
  'data-sync',
]);

/**
 * Functions that require the caller to assert admin privileges via
 * `options.isAdmin = true`. Calls without this flag are rejected
 * client-side before any network request is made.
 */
export const ADMIN_ONLY_FUNCTIONS = new Set([
  'run-full-scan',
  'apply-fix',
  'access-control-scan',
  'permission-fix',
  'access-flow-validate',
]);

/** Shape returned when a guard rejects a call (whitelist / role / validation). */
export interface SafeInvokeGuardError {
  success: false;
  error: string;
  traceId: string;
}

/**
 * Controlled wrapper for Supabase Edge Function calls.
 *
 * Features:
 * - Strict function whitelist — unknown function names are blocked
 * - Role enforcement — admin-only functions require `isAdmin: true`
 * - Input validation — body must be a plain object (not an array / primitive)
 * - Structured console logging for every call (start + success/failure)
 * - Normalized error handling (Supabase FunctionsHttpError → plain object)
 * - Optional caller-supplied traceId; otherwise generates a UUID automatically
 * - Injects `_traceId` into the request body so backend logs can correlate
 */
export async function safeInvoke<T = any>(
  functionName: string,
  options?: {
    body?: Record<string, any>;
    headers?: Record<string, string>;
    traceId?: string;
    isAdmin?: boolean;
  }
): Promise<{ data: T | null; error: any; traceId: string }> {
  const traceId = options?.traceId ?? crypto.randomUUID();

  // ── Guard 1: whitelist ────────────────────────────────────────────────────
  if (!ALLOWED_FUNCTIONS.has(functionName)) {
    const msg = `Function '${functionName}' is not in the approved whitelist`;
    console.error(`[safeInvoke] ✗ BLOCKED ${functionName}`, { traceId, error: msg });
    const err: SafeInvokeGuardError = { success: false, error: msg, traceId };
    return { data: null, error: err, traceId };
  }

  // ── Guard 2: role enforcement ─────────────────────────────────────────────
  if (ADMIN_ONLY_FUNCTIONS.has(functionName) && !options?.isAdmin) {
    const msg = `Function '${functionName}' requires admin privileges`;
    console.error(`[safeInvoke] ✗ UNAUTHORIZED ${functionName}`, { traceId, error: msg });
    const err: SafeInvokeGuardError = { success: false, error: msg, traceId };
    return { data: null, error: err, traceId };
  }

  // ── Guard 3: input validation ─────────────────────────────────────────────
  if (
    options?.body !== undefined &&
    (typeof options.body !== 'object' || Array.isArray(options.body) || options.body === null)
  ) {
    const msg = `Invalid body for '${functionName}': must be a plain object`;
    console.error(`[safeInvoke] ✗ INVALID_INPUT ${functionName}`, { traceId, error: msg });
    const err: SafeInvokeGuardError = { success: false, error: msg, traceId };
    return { data: null, error: err, traceId };
  }

  console.log(`[safeInvoke] → ${functionName}`, { traceId, body: options?.body });

  try {
    const body = options?.body ? { ...options.body, _traceId: traceId } : undefined;

    const { data, error } = await supabase.functions.invoke<T>(functionName, {
      body,
      headers: options?.headers,
    });

    if (error) {
      // Normalize: extract a human-readable message from FunctionsHttpError context
      const ctx = (error as any)?.context;
      const serverMessage =
        (typeof ctx === 'object' && (ctx?.error || ctx?.message)) ||
        (error as any)?.message ||
        String(error);

      const normalized = Object.assign(new Error(serverMessage), {
        success: false,
        error: serverMessage,
        traceId,
        status: (error as any)?.status,
        originalError: error,
      });

      console.error(`[safeInvoke] ✗ ${functionName}`, { traceId, error: serverMessage });
      return { data: null, error: normalized, traceId };
    }

    console.log(`[safeInvoke] ✓ ${functionName}`, { traceId });
    return { data, error: null, traceId };
  } catch (caught: any) {
    console.error(`[safeInvoke] ✗ ${functionName} (network error)`, {
      traceId,
      error: caught?.message ?? String(caught),
    });
    return { data: null, error: caught, traceId };
  }
}

/**
 * Controlled wrapper for raw `fetch()` calls to Supabase Edge Functions.
 *
 * Use this instead of `safeInvoke` only when the call requires:
 * - HTTP methods other than POST (e.g. GET)
 * - Query parameters appended to the URL
 * - An AbortController/timeout signal
 * - Reading a non-JSON response body
 *
 * Returns the raw `Response` object so callers can handle it exactly as before.
 */
export async function safeFetch(
  url: string,
  options?: RequestInit & { _traceId?: string }
): Promise<Response> {
  const { _traceId, ...fetchOptions } = options ?? {};
  const traceId = _traceId ?? crypto.randomUUID();

  // ── Guard 1: only Supabase Edge Function URLs are permitted ──────────────
  if (!url.includes('/functions/v1/')) {
    const msg = `safeFetch blocked: URL must target /functions/v1/ (got: ${url})`;
    console.error('[safeFetch] ✗ BLOCKED_URL', { traceId, url, error: msg });
    throw Object.assign(new Error(msg), { success: false, error: msg, traceId });
  }

  // ── Guard 2: function name must be in the approved whitelist ─────────────
  const fnName = url.match(/functions\/v1\/([^?/]+)/)?.[1] ?? '';
  if (!ALLOWED_FUNCTIONS.has(fnName)) {
    const msg = `safeFetch blocked: '${fnName}' is not in the approved whitelist`;
    console.error(`[safeFetch] ✗ BLOCKED_FN ${fnName}`, { traceId, error: msg });
    throw Object.assign(new Error(msg), { success: false, error: msg, traceId });
  }

  console.log(`[safeFetch] → ${fnName}`, {
    traceId,
    method: fetchOptions.method ?? 'GET',
  });

  try {
    const response = await fetch(url, fetchOptions);
    if (response.ok) {
      console.log(`[safeFetch] ✓ ${fnName} HTTP ${response.status}`, { traceId });
    } else {
      console.warn(`[safeFetch] ✗ ${fnName} HTTP ${response.status}`, { traceId });
    }
    return response;
  } catch (err: any) {
    console.error(`[safeFetch] ✗ ${fnName} (network error)`, {
      traceId,
      error: err?.message ?? String(err),
    });
    throw err;
  }
}
