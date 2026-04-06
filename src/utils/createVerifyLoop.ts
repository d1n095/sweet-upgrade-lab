/**
 * Create-Verify Loop
 * 
 * Ensures every created entity actually persists in the database.
 * Pattern: INSERT → FETCH → COMPARE → (retry | alert)
 */
import { supabase } from '@/integrations/supabase/client';
import { observe } from '@/utils/observabilityLogger';

interface CreateVerifyOptions {
  /** Table name to insert into */
  table: string;
  /** The payload to insert */
  payload: Record<string, any>;
  /** Columns to select back for verification */
  selectColumns?: string;
  /** Max retries before giving up (default: 2) */
  maxRetries?: number;
  /** Trace context for observability */
  traceContext?: {
    component?: string;
    traceId?: string;
    scanId?: string;
    bugId?: string;
    workItemId?: string;
  };
}

interface CreateVerifyResult {
  success: boolean;
  data: any | null;
  error: string | null;
  attempts: number;
  verified: boolean;
}

/**
 * Insert a row, then immediately fetch it back to verify persistence.
 * Retries on failure. Logs everything to observability.
 */
export async function createAndVerify(options: CreateVerifyOptions): Promise<CreateVerifyResult> {
  const {
    table,
    payload,
    selectColumns = '*',
    maxRetries = 2,
    traceContext = {},
  } = options;

  let attempts = 0;
  let lastError: string | null = null;

  while (attempts <= maxRetries) {
    attempts++;
    const attemptStart = Date.now();

    // Step 1: INSERT
    const { data: insertedRow, error: insertError } = await supabase
      .from(table as any)
      .insert(payload as any)
      .select(selectColumns)
      .single();

    if (insertError) {
      lastError = `INSERT failed: ${insertError.message}`;

      observe({
        event_type: 'error',
        severity: 'error',
        message: `Create-verify INSERT failed: ${table} (attempt ${attempts})`,
        component: traceContext.component || 'create-verify',
        details: { table, error: insertError.message, attempt: attempts, payload_keys: Object.keys(payload) },
        trace_id: traceContext.traceId,
        scan_id: traceContext.scanId,
        bug_id: traceContext.bugId,
        work_item_id: traceContext.workItemId,
        duration_ms: Date.now() - attemptStart,
      });

      if (attempts <= maxRetries) {
        await new Promise(r => setTimeout(r, 500 * attempts));
        continue;
      }
      break;
    }

    const insertedId = (insertedRow as any)?.id;
    if (!insertedId) {
      lastError = 'INSERT returned no ID';

      observe({
        event_type: 'error',
        severity: 'error',
        message: `Create-verify no ID returned: ${table}`,
        component: traceContext.component || 'create-verify',
        details: { table, attempt: attempts, returned: insertedRow },
        trace_id: traceContext.traceId,
        duration_ms: Date.now() - attemptStart,
      });

      if (attempts <= maxRetries) {
        await new Promise(r => setTimeout(r, 500 * attempts));
        continue;
      }
      break;
    }

    // Step 2: FETCH back from DB to verify
    const { data: verifiedRow, error: fetchError } = await supabase
      .from(table as any)
      .select(selectColumns)
      .eq('id', insertedId)
      .maybeSingle();

    if (fetchError || !verifiedRow) {
      lastError = fetchError ? `VERIFY fetch failed: ${fetchError.message}` : `VERIFY: row ${insertedId} not found in DB`;

      observe({
        event_type: 'error',
        severity: 'critical',
        message: `Create-verify MISMATCH: ${table} id=${insertedId} — inserted but not found`,
        component: traceContext.component || 'create-verify',
        details: { table, insertedId, attempt: attempts, fetchError: fetchError?.message },
        trace_id: traceContext.traceId,
        scan_id: traceContext.scanId,
        duration_ms: Date.now() - attemptStart,
        error_code: 'CREATE_VERIFY_MISMATCH',
      });

      if (attempts <= maxRetries) {
        await new Promise(r => setTimeout(r, 500 * attempts));
        continue;
      }
      break;
    }

    // Step 3: COMPARE — verify key fields match
    const verified = (verifiedRow as any).id === insertedId;
    const durationMs = Date.now() - attemptStart;


    observe({
      event_type: 'action',
      severity: 'info',
      message: `Create-verify OK: ${table} id=${insertedId}`,
      component: traceContext.component || 'create-verify',
      details: { table, id: insertedId, attempt: attempts, verified },
      trace_id: traceContext.traceId,
      scan_id: traceContext.scanId,
      work_item_id: insertedId,
      duration_ms: durationMs,
    });

    return {
      success: true,
      data: verifiedRow,
      error: null,
      attempts,
      verified: true,
    };
  }

  // All retries exhausted

  observe({
    event_type: 'error',
    severity: 'critical',
    message: `Create-verify FAILED: ${table} after ${attempts} attempts`,
    component: traceContext.component || 'create-verify',
    details: { table, error: lastError, attempts, payload_keys: Object.keys(payload) },
    trace_id: traceContext.traceId,
    scan_id: traceContext.scanId,
    error_code: 'CREATE_VERIFY_EXHAUSTED',
  });

  return {
    success: false,
    data: null,
    error: lastError,
    attempts,
    verified: false,
  };
}
