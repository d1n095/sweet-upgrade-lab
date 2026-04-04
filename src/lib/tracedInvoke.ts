import { supabase } from '@/integrations/supabase/client';
import { logData } from '@/utils/actionMonitor';

/**
 * Wraps supabase.functions.invoke with a request_trace_id
 * so clicks can be tracked end-to-end: click → request → backend → DB.
 * All calls are logged to ActionMonitor (type "action", source "system").
 */
export async function tracedInvoke<T = any>(
  functionName: string,
  options?: { body?: Record<string, any>; headers?: Record<string, string> }
): Promise<{ data: T | null; error: any; request_trace_id: string }> {
  const request_trace_id = crypto.randomUUID();
  const start = Date.now();

  const body = {
    ...(options?.body || {}),
    request_trace_id,
  };

  const { data, error } = await supabase.functions.invoke(functionName, {
    ...options,
    body,
  });

  const duration_ms = Date.now() - start;

  logData({
    type: 'action',
    source: 'system',
    payload: { fn: functionName, request_trace_id, duration_ms, error: error?.message || null },
    status: error ? 'failed' : 'success',
  });

  return { data, error, request_trace_id };
}
