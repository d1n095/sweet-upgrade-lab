import { supabase } from '@/integrations/supabase/client';

/**
 * Controlled wrapper for Supabase Edge Function calls.
 *
 * Features:
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
  }
): Promise<{ data: T | null; error: any; traceId: string }> {
  const traceId = options?.traceId ?? crypto.randomUUID();

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
  const fnName = url.match(/functions\/v1\/([^?/]+)/)?.[1] ?? url;

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
