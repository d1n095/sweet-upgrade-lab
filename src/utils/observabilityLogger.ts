import { supabase } from '@/integrations/supabase/client';

type EventType = 'action' | 'error' | 'state_change' | 'api_call' | 'scan_step' | 'fix_attempt';
type Severity = 'debug' | 'info' | 'warning' | 'error' | 'critical';
type Source = 'client' | 'edge_function' | 'trigger' | 'automation' | 'scanner';

interface ObservabilityEvent {
  event_type: EventType;
  severity?: Severity;
  source?: Source;
  message: string;
  details?: Record<string, any>;
  scan_id?: string;
  bug_id?: string;
  work_item_id?: string;
  trace_id?: string;
  component?: string;
  endpoint?: string;
  duration_ms?: number;
  error_code?: string;
  stack_trace?: string;
}

// Buffer for batching writes
let buffer: ObservabilityEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
const FLUSH_INTERVAL = 2000;
const MAX_BUFFER = 20;

/** Generate a trace ID that groups related events */
export const createTraceId = (prefix = 'trace') =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

/** Core log function — buffers and batches writes */
export const observe = (event: ObservabilityEvent) => {
  buffer.push({
    ...event,
    severity: event.severity || 'info',
    source: event.source || 'client',
  });

  if (buffer.length >= MAX_BUFFER) {
    flushObservabilityBuffer();
  } else if (!flushTimer) {
    flushTimer = setTimeout(flushObservabilityBuffer, FLUSH_INTERVAL);
  }
};

/** Flush buffered events to the database */
export const flushObservabilityBuffer = async () => {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (buffer.length === 0) return;

  const batch = [...buffer];
  buffer = [];

  try {
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id || null;

    const rows = batch.map(e => ({
      event_type: e.event_type,
      severity: e.severity || 'info',
      source: e.source || 'client',
      message: (e.message || '').slice(0, 1000),
      details: e.details || {},
      scan_id: e.scan_id || null,
      bug_id: e.bug_id || null,
      work_item_id: e.work_item_id || null,
      trace_id: e.trace_id || null,
      component: e.component || null,
      endpoint: e.endpoint || null,
      duration_ms: e.duration_ms || null,
      error_code: e.error_code || null,
      stack_trace: e.stack_trace?.slice(0, 2000) || null,
      user_id: userId,
    }));

    await supabase.from('system_observability_log' as any).insert(rows);
  } catch (e) {

  }
};

// Flush on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    if (buffer.length > 0) {
      // Use sendBeacon-style sync flush
      flushObservabilityBuffer();
    }
  });
}

// ── Convenience helpers ──

export const observeAction = (message: string, opts?: Partial<ObservabilityEvent>) =>
  observe({ event_type: 'action', message, ...opts });

export const observeError = (message: string, error?: unknown, opts?: Partial<ObservabilityEvent>) =>
  observe({
    event_type: 'error',
    severity: 'error',
    message,
    error_code: error instanceof Error ? error.name : undefined,
    stack_trace: error instanceof Error ? error.stack : undefined,
    ...opts,
  });

export const observeStateChange = (message: string, opts?: Partial<ObservabilityEvent>) =>
  observe({ event_type: 'state_change', message, ...opts });

export const observeApiCall = (endpoint: string, durationMs: number, opts?: Partial<ObservabilityEvent>) =>
  observe({
    event_type: 'api_call',
    message: `API call: ${endpoint}`,
    endpoint,
    duration_ms: durationMs,
    ...opts,
  });

export const observeScanStep = (message: string, opts?: Partial<ObservabilityEvent>) =>
  observe({ event_type: 'scan_step', source: 'scanner', message, ...opts });

export const observeFixAttempt = (message: string, opts?: Partial<ObservabilityEvent>) =>
  observe({ event_type: 'fix_attempt', message, ...opts });
