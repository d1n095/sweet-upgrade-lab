import { supabase } from '@/integrations/supabase/client';

const ALLOWED_FUNCTIONS = [
  'send-order-email',
  'process-refund',
  'shopify-proxy',
  'automation-engine',
  'notify-affiliate',
  'notify-review',
  'send-welcome-email',
  'run-full-scan',
  'translate-product',
];

/**
 * Safe wrapper for supabase.functions.invoke.
 * Blocks any function not in the ALLOWED_FUNCTIONS list at runtime.
 */
export async function safeInvoke<T = any>(
  functionName: string,
  options?: { body?: Record<string, any>; headers?: Record<string, string> }
): Promise<{ data: T | null; error: any }> {
  if (!ALLOWED_FUNCTIONS.includes(functionName)) {
    throw new Error(`🚫 Blocked invoke: "${functionName}" is not in the allowed list`);
  }
  return supabase.functions.invoke<T>(functionName, options);
}
