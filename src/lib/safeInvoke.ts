import { supabase } from '@/integrations/supabase/client';
import { useApiLogStore } from '@/stores/useApiLogStore';

/** Maximum number of attempts (1 initial + 2 retries). */
const MAX_ATTEMPTS = 3;
/** Base delay in ms for exponential backoff. */
const BASE_DELAY_MS = 300;

/** Delay with jitter: BASE * 2^attempt + random up to 100 ms. */
function backoffMs(attempt: number): number {
  return BASE_DELAY_MS * Math.pow(2, attempt) + Math.random() * 100;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

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
    useApiLogStore.getState().push({ traceId, functionName, method: options?.method ?? 'POST', timestamp: Date.now(), attempt: 0, status: 'blocked', errorMessage: msg });
    return { data: null, error: err, traceId };
  }

  // ── Guard 2: role enforcement ─────────────────────────────────────────────
  if (ADMIN_ONLY_FUNCTIONS.has(functionName) && !options?.isAdmin) {
    const msg = `Function '${functionName}' requires admin privileges`;
    console.error(`[safeInvoke] ✗ UNAUTHORIZED ${functionName}`, { traceId, error: msg });
    const err: SafeInvokeGuardError = { success: false, error: msg, traceId };
    useApiLogStore.getState().push({ traceId, functionName, method: options?.method ?? 'POST', timestamp: Date.now(), attempt: 0, status: 'blocked', errorMessage: msg });
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
    useApiLogStore.getState().push({ traceId, functionName, method: options?.method ?? 'POST', timestamp: Date.now(), attempt: 0, status: 'blocked', errorMessage: msg });
    return { data: null, error: err, traceId };
  }

  const method = options?.method ?? 'POST';
  console.log(`[safeInvoke] → ${functionName}`, { traceId, method, body: options?.body });

  const logStore = useApiLogStore.getState();

  // ── GET path: native fetch with URL query parameters + retry ─────────────
  if (method === 'GET') {
    let lastError: any;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const t0 = Date.now();
      logStore.push({ traceId, functionName, method: 'GET', timestamp: Date.now(), attempt, status: 'pending' });

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

        const durationMs = Date.now() - t0;

        if (!response.ok) {
          const msg = `HTTP ${response.status}`;
          console.warn(`[safeInvoke] ✗ ${functionName} GET ${msg} (attempt ${attempt + 1})`, { traceId });
          logStore.update(traceId, attempt, { status: 'error', durationMs, errorMessage: msg });
          lastError = Object.assign(new Error(msg), { success: false, error: msg, traceId, status: response.status });
          if (attempt < MAX_ATTEMPTS - 1) { await sleep(backoffMs(attempt)); continue; }
          return { data: null, error: lastError, traceId };
        }

        const data: T = await response.json();
        logStore.update(traceId, attempt, { status: 'success', durationMs });
        console.log(`[safeInvoke] ✓ ${functionName} GET`, { traceId, attempt: attempt + 1, durationMs });
        return { data, error: null, traceId };
      } catch (caught: any) {
        const durationMs = Date.now() - t0;
        const msg = caught?.message ?? String(caught);
        console.error(`[safeInvoke] ✗ ${functionName} GET (attempt ${attempt + 1})`, { traceId, error: msg });
        logStore.update(traceId, attempt, { status: 'error', durationMs, errorMessage: msg });
        lastError = caught;
        if (attempt < MAX_ATTEMPTS - 1) { await sleep(backoffMs(attempt)); continue; }
      }
    }
    return { data: null, error: lastError, traceId };
  }

  // ── POST path: supabase.functions.invoke + retry ─────────────────────────
  let lastError: any;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const t0 = Date.now();
    logStore.push({ traceId, functionName, method: 'POST', timestamp: Date.now(), attempt, status: 'pending' });

    try {
      const body = options?.body ? { ...options.body, _traceId: traceId } : undefined;

      const { data, error } = await supabase.functions.invoke<T>(functionName, {
        body,
        headers: options?.headers,
        signal: options?.signal,
      } as any);

      const durationMs = Date.now() - t0;

      if (error) {
        const ctx = (error as any)?.context;
        const serverMessage =
          (typeof ctx === 'object' && (ctx?.error || ctx?.message)) ||
          (error as any)?.message ||
          String(error);

        console.error(`[safeInvoke] ✗ ${functionName} (attempt ${attempt + 1})`, { traceId, error: serverMessage });
        logStore.update(traceId, attempt, { status: 'error', durationMs, errorMessage: serverMessage });

        lastError = Object.assign(new Error(serverMessage), {
          success: false,
          error: serverMessage,
          traceId,
          status: (error as any)?.status,
          originalError: error,
        });
        if (attempt < MAX_ATTEMPTS - 1) { await sleep(backoffMs(attempt)); continue; }
        return { data: null, error: lastError, traceId };
      }

      logStore.update(traceId, attempt, { status: 'success', durationMs });
      console.log(`[safeInvoke] ✓ ${functionName}`, { traceId, attempt: attempt + 1, durationMs });
      return { data, error: null, traceId };
    } catch (caught: any) {
      const durationMs = Date.now() - t0;
      const msg = caught?.message ?? String(caught);
      console.error(`[safeInvoke] ✗ ${functionName} (attempt ${attempt + 1}, network error)`, { traceId, error: msg });
      logStore.update(traceId, attempt, { status: 'error', durationMs, errorMessage: msg });
      lastError = caught;
      if (attempt < MAX_ATTEMPTS - 1) { await sleep(backoffMs(attempt)); continue; }
    }
  }
  return { data: null, error: lastError, traceId };
}
