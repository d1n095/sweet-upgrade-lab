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
 * - GET support: pass `method: 'GET'` and `params` for URL query parameters
 * - Timeout/abort: pass `signal` to cancel the request
 */
export async function safeInvoke<T = any>(
  functionName: string,
  options?: {
    body?: Record<string, any>;
    headers?: Record<string, string>;
    traceId?: string;
    isAdmin?: boolean;
    /** Use 'GET' for health-check or query-parameter-based edge functions. */
    method?: 'GET' | 'POST';
    /** Query parameters appended to the URL when method is 'GET'. */
    params?: Record<string, string>;
    /** AbortSignal for timeout / cancellation. */
    signal?: AbortSignal;
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

  console.log(`[safeInvoke] → ${functionName}`, { traceId, method: options?.method ?? 'POST', body: options?.body });

  // ── GET path: native fetch with URL query parameters ─────────────────────
  if (options?.method === 'GET') {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const baseUrl = (supabase as any).supabaseUrl as string;
      const qs = options.params ? '?' + new URLSearchParams(options.params).toString() : '';
      const url = `${baseUrl}/functions/v1/${functionName}${qs}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          apikey: (supabase as any).supabaseKey as string,
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
          ...options.headers,
        },
        signal: options.signal,
      });

      if (!response.ok) {
        const msg = `HTTP ${response.status}`;
        console.warn(`[safeInvoke] ✗ ${functionName} GET ${msg}`, { traceId });
        const err = Object.assign(new Error(msg), { success: false, error: msg, traceId, status: response.status });
        return { data: null, error: err, traceId };
      }

      const data: T = await response.json();
      console.log(`[safeInvoke] ✓ ${functionName} GET`, { traceId });
      return { data, error: null, traceId };
    } catch (caught: any) {
      console.error(`[safeInvoke] ✗ ${functionName} GET (network error)`, { traceId, error: caught?.message ?? String(caught) });
      return { data: null, error: caught, traceId };
    }
  }

  // ── POST path (default): supabase.functions.invoke ────────────────────────
  try {
    const body = options?.body ? { ...options.body, _traceId: traceId } : undefined;

    const { data, error } = await supabase.functions.invoke<T>(functionName, {
      body,
      headers: options?.headers,
      signal: options?.signal,
    } as any);

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


