import { supabase } from '@/integrations/supabase/client';

const AI_FUNCTION_BLOCKLIST = [
  'translate-product',
  'generate-product-content',
  'suggest-product-metadata',
  'ai-user-management',
  'ai-review-fix',
];

/**
 * Wraps supabase.functions.invoke with a request_trace_id
 * so clicks can be tracked end-to-end: click → request → backend → DB.
 * Blocks known AI-named function invocations.
 */
export async function tracedInvoke<T = any>(
  functionName: string,
  options?: { body?: Record<string, any>; headers?: Record<string, string> }
): Promise<{ data: T | null; error: any; request_trace_id: string }> {
  const request_trace_id = crypto.randomUUID();

  if (AI_FUNCTION_BLOCKLIST.includes(functionName)) {
    console.warn(`[tracedInvoke] 🚫 BLOCKED AI function: ${functionName}`);
    return { data: null, error: new Error(`AI function disabled: ${functionName}`), request_trace_id };
  }

  const body = {
    ...(options?.body || {}),
    request_trace_id,
  };

  const { data, error } = await supabase.functions.invoke(functionName, {
    ...options,
    body,
  });

  return { data, error, request_trace_id };
}
