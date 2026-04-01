import { safeInvoke } from '@/lib/safeInvoke';

/**
 * Wraps safeInvoke with a request_trace_id
 * so clicks can be tracked end-to-end: click → request → backend → DB
 */
export async function tracedInvoke<T = any>(
  functionName: string,
  options?: { body?: Record<string, any>; headers?: Record<string, string> }
): Promise<{ data: T | null; error: any; request_trace_id: string }> {
  const request_trace_id = crypto.randomUUID();

  const body = {
    ...(options?.body || {}),
    request_trace_id,
  };

  const { data, error } = await safeInvoke<T>(functionName, {
    ...options,
    body,
  });

  return { data, error, request_trace_id };
}
