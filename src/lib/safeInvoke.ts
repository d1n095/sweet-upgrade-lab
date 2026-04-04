/**
 * safeInvoke — single Supabase Edge Function entrypoint.
 *
 * All edge-function calls MUST go through this file.
 * Direct supabase.functions.invoke() is prohibited everywhere else.
 *
 * Features:
 *   - Allowlist enforcement
 *   - 3-attempt retry with 300 ms × attempt backoff
 *   - Every call logged to ActionMonitor (logData)
 *   - getApiLog() returns last 50 entries for admin panels
 */

import { supabase } from '@/integrations/supabase/client';
import { logData } from '@/utils/actionMonitor';

// ── Allowlist ──────────────────────────────────────────────────────────────

export const ALLOWED_FUNCTIONS = new Set([
  'process-refund',
  'notify-review',
  'send-order-email',
  'lookup-order',
  'create-checkout',
  'translate-product',
  'run-full-scan',
  'process-bug-report',
  'generate-receipt',
  'data-sync',
  'notify-affiliate',
  'notify-influencer',
  'create-shipment',
  'google-places',
  'send-welcome-email',
  'send-review-reminder',
  'send-retention-email',
  'process-email-queue',
  'automation-engine',
  'suggest-product-metadata',
  'sitemap',
  'stripe-webhook',
  'apply-fix',
  'access-control-scan',
  'permission-fix',
  'access-flow-validate',
  'shopify-proxy',
]);

// ── API log ────────────────────────────────────────────────────────────────

export interface ApiLogEntry {
  fn: string;
  timestamp: number;
  duration_ms: number;
  status: 'success' | 'blocked' | 'error';
  error?: string;
  request_trace_id?: string;
}

const apiLog: ApiLogEntry[] = [];
const MAX_LOG = 50;

function pushLog(entry: ApiLogEntry) {
  apiLog.push(entry);
  if (apiLog.length > MAX_LOG) apiLog.splice(0, apiLog.length - MAX_LOG);
}

export function getApiLog(): ApiLogEntry[] {
  return [...apiLog];
}

// ── Core ───────────────────────────────────────────────────────────────────

const RETRY_COUNT = 3;
const RETRY_BASE_MS = 300;

function sleep(ms: number) {
  return new Promise<void>(r => setTimeout(r, ms));
}

/**
 * Call a Supabase Edge Function safely.
 * Blocked (non-allowlisted) calls are rejected without hitting the network.
 */
export async function safeInvoke<T = any>(
  functionName: string,
  body?: Record<string, any>,
): Promise<{ data: T | null; error: any }> {
  const start = Date.now();
  const request_trace_id = crypto.randomUUID();

  // ── Allowlist check ──
  if (!ALLOWED_FUNCTIONS.has(functionName)) {
    const entry: ApiLogEntry = {
      fn: functionName,
      timestamp: start,
      duration_ms: 0,
      status: 'blocked',
      error: 'Not in ALLOWED_FUNCTIONS',
    };
    pushLog(entry);
    logData({
      type: 'error',
      source: 'system',
      payload: { fn: functionName, request_trace_id, reason: 'blocked' },
      status: 'failed',
    });
    return { data: null, error: new Error(`safeInvoke: '${functionName}' is not allowed`) };
  }

  // ── Retry loop ──
  let lastError: any = null;

  for (let attempt = 1; attempt <= RETRY_COUNT; attempt++) {
    try {
      const { data, error } = await supabase.functions.invoke<T>(functionName, {
        body: { ...(body ?? {}), request_trace_id },
      });

      const duration_ms = Date.now() - start;

      if (error) {
        lastError = error;
        if (attempt < RETRY_COUNT) {
          await sleep(RETRY_BASE_MS * attempt);
          continue;
        }
        // Final failure
        const entry: ApiLogEntry = {
          fn: functionName,
          timestamp: start,
          duration_ms,
          status: 'error',
          error: error?.message ?? String(error),
          request_trace_id,
        };
        pushLog(entry);
        logData({
          type: 'error',
          source: 'system',
          payload: { fn: functionName, request_trace_id, duration_ms, error: entry.error, attempts: attempt },
          status: 'failed',
        });
        return { data: null, error };
      }

      // Success
      const entry: ApiLogEntry = {
        fn: functionName,
        timestamp: start,
        duration_ms,
        status: 'success',
        request_trace_id,
      };
      pushLog(entry);
      logData({
        type: 'action',
        source: 'system',
        payload: { fn: functionName, request_trace_id, duration_ms, attempts: attempt },
        status: 'success',
      });
      return { data, error: null };

    } catch (err: any) {
      lastError = err;
      if (attempt < RETRY_COUNT) {
        await sleep(RETRY_BASE_MS * attempt);
      }
    }
  }

  // All retries exhausted via thrown exception
  const duration_ms = Date.now() - start;
  const entry: ApiLogEntry = {
    fn: functionName,
    timestamp: start,
    duration_ms,
    status: 'error',
    error: lastError?.message ?? String(lastError),
    request_trace_id,
  };
  pushLog(entry);
  logData({
    type: 'error',
    source: 'system',
    payload: { fn: functionName, request_trace_id, duration_ms, error: entry.error, attempts: RETRY_COUNT },
    status: 'failed',
  });
  return { data: null, error: lastError };
}
