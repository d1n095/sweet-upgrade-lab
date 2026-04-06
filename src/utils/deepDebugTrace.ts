/**
 * Deep Debug Mode — Full lifecycle tracing for work items and issues.
 * 
 * Traces: issue detected → work item created → saved in DB → shown in UI → updated by scan
 * 
 * Each trace entry records step, timestamp, entity ID, and optional details.
 */
import { create } from 'zustand';

export type TraceStep =
  | 'issue_detected'
  | 'work_item_creating'
  | 'db_insert_sent'
  | 'db_insert_confirmed'
  | 'db_insert_failed'
  | 'db_verify_sent'
  | 'db_verify_confirmed'
  | 'db_verify_failed'
  | 'cache_invalidated'
  | 'ui_fetch_started'
  | 'ui_fetch_complete'
  | 'ui_item_rendered'
  | 'ui_item_missing'
  | 'scan_update'
  | 'dedup_check'
  | 'dedup_merged'
  | 'dedup_kept'
  | 'filter_applied'
  | 'filter_removed'
  | 'status_changed'
  | 'item_disappeared'
  | 'data_loss';

export interface TraceEntry {
  id: string;
  traceId: string;
  step: TraceStep;
  timestamp: number;
  entityId?: string;
  entityType?: string;
  component: string;
  message: string;
  details?: Record<string, any>;
  severity: 'debug' | 'info' | 'warning' | 'error' | 'critical';
}

interface DeepDebugState {
  enabled: boolean;
  traces: TraceEntry[];
  maxTraces: number;
  toggle: () => void;
  clear: () => void;
}

let traceCounter = 0;

export const useDeepDebugStore = create<DeepDebugState>((set, get) => ({
  enabled: false,
  traces: [],
  maxTraces: 500,

  toggle: () => set(s => ({ enabled: !s.enabled })),
  clear: () => set({ traces: [] }),
}));

/** Generate a unique trace ID for grouping related steps */
export const newTraceId = (prefix = 'dt') =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

/** Core trace function — only records when debug mode is enabled */
export function trace(
  step: TraceStep,
  component: string,
  message: string,
  opts: {
    traceId?: string;
    entityId?: string;
    entityType?: string;
    details?: Record<string, any>;
    severity?: TraceEntry['severity'];
  } = {}
) {
  const store = useDeepDebugStore.getState();
  if (!store.enabled) return;

  const entry: TraceEntry = {
    id: `te-${++traceCounter}`,
    traceId: opts.traceId || 'untraced',
    step,
    timestamp: Date.now(),
    entityId: opts.entityId,
    entityType: opts.entityType || 'work_item',
    component,
    message,
    details: opts.details,
    severity: opts.severity || inferSeverity(step),
  };

  // Also log to console for devtools visibility
  const prefix = `[DeepDebug][${step}][${component}]`;
  if (entry.severity === 'error' || entry.severity === 'critical') {
  } else if (entry.severity === 'warning') {
  } else {
  }

  set(s => ({
    traces: [...s.traces.slice(-(s.maxTraces - 1)), entry],
  }));

  function set(fn: (s: DeepDebugState) => Partial<DeepDebugState>) {
    useDeepDebugStore.setState(fn);
  }
}

function inferSeverity(step: TraceStep): TraceEntry['severity'] {
  switch (step) {
    case 'db_insert_failed':
    case 'db_verify_failed':
    case 'item_disappeared':
    case 'data_loss':
      return 'error';
    case 'ui_item_missing':
    case 'filter_removed':
    case 'dedup_merged':
      return 'warning';
    case 'db_insert_confirmed':
    case 'db_verify_confirmed':
    case 'ui_item_rendered':
      return 'info';
    default:
      return 'debug';
  }
}

/** Convenience: trace a full create-verify cycle */
export function traceCreateVerify(
  component: string,
  traceId: string,
  phase: 'start' | 'inserted' | 'verified' | 'failed',
  entityId?: string,
  details?: Record<string, any>
) {
  const stepMap: Record<string, TraceStep> = {
    start: 'work_item_creating',
    inserted: 'db_insert_confirmed',
    verified: 'db_verify_confirmed',
    failed: 'db_insert_failed',
  };
  trace(stepMap[phase], component, `Create-verify ${phase}${entityId ? ` (${entityId})` : ''}`, {
    traceId,
    entityId,
    details,
  });
}

/** Convenience: trace a UI fetch cycle */
export function traceUIFetch(
  component: string,
  traceId: string,
  phase: 'start' | 'complete',
  itemCount?: number,
  details?: Record<string, any>
) {
  const step: TraceStep = phase === 'start' ? 'ui_fetch_started' : 'ui_fetch_complete';
  trace(step, component, `UI fetch ${phase}${itemCount != null ? ` (${itemCount} items)` : ''}`, {
    traceId,
    details: { ...details, itemCount },
  });
}
