import { supabase } from '@/integrations/supabase/client';

/**
 * Wraps supabase.functions.invoke with a request_trace_id
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

  console.log("[INVOKE SENT]", functionName, { request_trace_id, body });

  const { data, error } = await supabase.functions.invoke(functionName, {
    ...options,
    body,
  });

  console.log("[INVOKE RESPONSE]", functionName, { request_trace_id, data, error });

  return { data, error, request_trace_id };
}
