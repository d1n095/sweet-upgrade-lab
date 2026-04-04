import { supabase } from "@/integrations/supabase/client";
import { logEvent } from "@/lib/actionMonitor";

const ALLOWED_FUNCTIONS = new Set([
  "process-refund",
  "notify-review",
  "send-order-email",
  "lookup-order",
  "create-checkout",
  "translate-product",
  "run-full-scan",
  "process-bug-report",
  "generate-receipt",
  "data-sync",
]);

export async function safeInvoke<T = any>(
  functionName: string,
  options?: { body?: Record<string, any>; headers?: Record<string, string> }
): Promise<{ data: T | null; error: any; traceId: string }> {
  const traceId = crypto.randomUUID();

  if (!ALLOWED_FUNCTIONS.has(functionName)) {
    const err = new Error(`safeInvoke: BLOCKED unknown function "${functionName}"`);
    logEvent({ type: "error", source: "safeInvoke", label: `BLOCKED: ${functionName}`, status: "error", payload: { traceId } });
    return { data: null, error: err, traceId };
  }

  logEvent({ type: "api", source: "safeInvoke", label: `→ ${functionName}`, status: "pending", payload: { traceId } });

  const body = { ...(options?.body || {}), request_trace_id: traceId };

  let attempt = 0;
  let lastError: any = null;

  while (attempt < 3) {
    attempt++;
    const { data, error } = await supabase.functions.invoke<T>(functionName, { ...options, body });
    if (!error) {
      logEvent({ type: "api", source: "safeInvoke", label: `✓ ${functionName}`, status: "ok", payload: { traceId, data } });
      return { data, error: null, traceId };
    }
    lastError = error;
    if (attempt < 3) await new Promise((r) => setTimeout(r, 300 * attempt));
  }

  logEvent({ type: "error", source: "safeInvoke", label: `✗ ${functionName}`, status: "error", payload: { traceId, error: lastError } });
  return { data: null, error: lastError, traceId };
}

// Backward-compat alias (deprecated)
export const tracedInvoke = safeInvoke;
