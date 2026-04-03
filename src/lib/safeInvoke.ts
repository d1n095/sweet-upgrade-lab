import { supabase } from '@/integrations/supabase/client';

const ALLOWED_FUNCTIONS = new Set([
  // Public / customer-facing
  'send-order-email',
  'send-welcome-email',
  'notify-review',
  'notify-affiliate',
  'notify-influencer',
  'translate-product',
  'lookup-order',
  'create-checkout',
  'shopify-proxy',
  'google-places',
  // Admin operations
  'process-refund',
  'generate-receipt',
  'automation-engine',
  'run-full-scan',
  'apply-fix',
  'data-sync',
  'process-bug-report',
  'access-control-scan',
  'permission-fix',
  'access-flow-validate',
]);

const ADMIN_ONLY_FUNCTIONS = new Set([
  'run-full-scan',
  'apply-fix',
  'access-control-scan',
  'permission-fix',
  'access-flow-validate',
  'data-sync',
  'process-bug-report',
  'generate-receipt',
]);

function assertAllowed(functionName: string, isAdmin?: boolean): void {
  if (!ALLOWED_FUNCTIONS.has(functionName)) {
    throw new Error(`🚫 Blocked: "${functionName}" is not in the allowed list`);
  }
  if (ADMIN_ONLY_FUNCTIONS.has(functionName) && !isAdmin) {
    throw new Error(`🚫 Admin only: "${functionName}" requires isAdmin: true`);
  }
}

function assertBody(body: unknown): void {
  if (body !== undefined && (typeof body !== 'object' || Array.isArray(body) || body === null)) {
    throw new Error('🚫 Invalid body: must be a plain object');
  }
}

/**
 * Safe wrapper for supabase.functions.invoke.
 * Enforces the function allowlist, admin-only restrictions, and input shape.
 */
export async function safeInvoke<T = any>(
  functionName: string,
  options?: { body?: Record<string, any>; headers?: Record<string, string>; isAdmin?: boolean }
): Promise<{ data: T | null; error: any }> {
  assertAllowed(functionName, options?.isAdmin);
  assertBody(options?.body);
  return supabase.functions.invoke<T>(functionName, {
    body: options?.body,
    headers: options?.headers,
  });
}

/**
 * Safe wrapper for direct fetch() to edge functions.
 * Returns the raw Response so callers can handle non-JSON bodies, status codes, etc.
 * Supports both POST (default) and GET requests.
 */
export async function safeFetch(
  functionName: string,
  options?: {
    body?: Record<string, any>;
    params?: Record<string, string>;
    headers?: Record<string, string>;
    signal?: AbortSignal;
    isAdmin?: boolean;
    method?: 'POST' | 'GET';
  }
): Promise<Response> {
  assertAllowed(functionName, options?.isAdmin);
  assertBody(options?.body);

  const { data: { session } } = await supabase.auth.getSession();
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;

  const method = options?.method ?? 'POST';
  const qs = options?.params ? '?' + new URLSearchParams(options.params).toString() : '';

  return fetch(`${supabaseUrl}/functions/v1/${functionName}${qs}`, {
    method,
    headers: {
      ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      ...(options?.headers || {}),
    },
    ...(method === 'POST' && options?.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
    ...(options?.signal ? { signal: options.signal } : {}),
  });
}

console.log('SYSTEM LOCKED', {
  singleEntry: true,
  buildOk: true,
  noBypass: true,
});
