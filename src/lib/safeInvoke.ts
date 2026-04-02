import { supabase } from '@/integrations/supabase/client';

const ADMIN_ONLY_FUNCTIONS = new Set([
  'run-full-scan',
  'apply-fix',
  'access-control-scan',
  'permission-fix',
  'access-flow-validate',
]);

/**
 * Canonical wrapper for all Supabase Edge Function calls.
 * Enforces that admin-only functions are called with isAdmin: true.
 * Attaches a request_trace_id for end-to-end tracing.
 */
export async function safeInvoke<T = any>(
  functionName: string,
  options?: {
    body?: Record<string, any>;
    headers?: Record<string, string>;
    isAdmin?: boolean;
  }
): Promise<{ data: T | null; error: any; request_trace_id: string }> {
  if (ADMIN_ONLY_FUNCTIONS.has(functionName) && !options?.isAdmin) {
    const msg = `[safeInvoke] BLOCKED: '${functionName}' requires isAdmin: true`;
    console.error(msg);
    return { data: null, error: new Error(msg), request_trace_id: '' };
  }

  const request_trace_id = crypto.randomUUID();

  const body = {
    ...(options?.body || {}),
    request_trace_id,
  };

  const { data, error } = await supabase.functions.invoke(functionName, {
    headers: options?.headers,
    body,
  });

  return { data, error, request_trace_id };
}
