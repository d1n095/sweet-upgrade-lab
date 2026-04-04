import { supabase } from '@/integrations/supabase/client';
import { safeInvoke } from '@/lib/safeInvoke';

export type ScanStatus = 'idle' | 'running' | 'done' | 'error';

export interface ScanStep {
  id: string;
  label: string;
  scanType: string;
  status: 'pending' | 'running' | 'done' | 'error' | 'skipped';
  progressLabel?: string;
  result?: any;
  error?: string;
  duration_ms?: number;
}

export interface ScanResult {
  scanRunId: string;
  steps: ScanStep[];
  unifiedResult: any | null;
  workItemsCreated: number;
  systemHealthScore: number;
}

type ScanCompleteCallback = (result: ScanResult) => void;

const _listeners: ScanCompleteCallback[] = [];

/** Register a callback to be called when a scan completes. */
export function onScanComplete(cb: ScanCompleteCallback): () => void {
  _listeners.push(cb);
  return () => {
    const idx = _listeners.indexOf(cb);
    if (idx >= 0) _listeners.splice(idx, 1);
  };
}

function notifyListeners(result: ScanResult) {
  for (const cb of _listeners) {
    try { cb(result); } catch { /* noop */ }
  }
}

let _pollInterval: ReturnType<typeof setInterval> | null = null;

function stopPolling() {
  if (_pollInterval) {
    clearInterval(_pollInterval);
    _pollInterval = null;
  }
}

async function pollScanRun(scanRunId: string, onProgress?: (steps: ScanStep[]) => void) {
  try {
    const { data } = await supabase
      .from('scan_runs' as any)
      .select('*')
      .eq('id', scanRunId)
      .single();

    if (!data) return;
    const run = data as any;

    const steps = buildStepsFromRun(run);
    onProgress?.(steps);

    if (run.status === 'done' || run.status === 'completed') {
      stopPolling();
      notifyListeners({
        scanRunId,
        steps,
        unifiedResult: run.unified_result ?? null,
        workItemsCreated: run.work_items_created ?? 0,
        systemHealthScore: run.system_health_score ?? 0,
      });
    } else if (run.status === 'error' || run.status === 'failed') {
      stopPolling();
    }
  } catch (e) {
    console.warn('[scanEngine] poll error', e);
  }
}

const STEP_DEFS = [
  { id: 'data_flow_validation', label: 'Data Flow Validation', scanType: 'data_integrity', progressLabel: 'Validerar dataflöden...' },
  { id: 'component_map', label: 'Component Map', scanType: 'component_map', progressLabel: 'Kartlägger komponenter...' },
  { id: 'ui_data_binding', label: 'UI/Data Binding', scanType: 'sync_scan', progressLabel: 'Validerar UI-databindning...' },
  { id: 'interaction_qa', label: 'Interaction QA', scanType: 'interaction_qa', progressLabel: 'Testar interaktioner...' },
  { id: 'human_test', label: 'Human Test', scanType: 'human_test', progressLabel: 'Simulerar användarbeteende...' },
  { id: 'navigation_verification', label: 'Navigation Verification', scanType: 'nav_scan', progressLabel: 'Verifierar navigering...' },
  { id: 'feature_detection', label: 'Feature Detection', scanType: 'feature_detection', progressLabel: 'Klassificerar funktioner...' },
  { id: 'regression_detection', label: 'Regression Detection', scanType: 'system_scan', progressLabel: 'Detekterar regressioner...' },
  { id: 'decision_engine', label: 'Decision Engine', scanType: 'decision_engine', progressLabel: 'Kör beslutsmotor...' },
  { id: 'blocker_detection', label: 'Blocker Detection', scanType: 'blocker_detection', progressLabel: 'Söker blockerare...' },
  { id: 'ui_flow_integrity', label: 'UI Flow Integrity', scanType: 'ui_flow_integrity', progressLabel: 'Verifierar UI-flödesintegritet...' },
];

function buildStepsFromRun(run: any): ScanStep[] {
  const stepsResults = run.steps_results || {};
  const currentStep = run.current_step || 0;
  const isDone = run.status === 'done' || run.status === 'completed';
  const isError = run.status === 'error' || run.status === 'failed';

  return STEP_DEFS.map((def, i) => {
    const result = stepsResults[def.id];
    let status: ScanStep['status'] = 'pending';

    if (result && !result.failed) {
      status = 'done';
    } else if (result?.failed) {
      status = 'error';
    } else if (i === currentStep && !isDone && !isError) {
      status = 'running';
    } else if (i < currentStep) {
      status = result ? 'error' : 'done';
    }

    return {
      id: def.id,
      label: def.label,
      scanType: def.scanType,
      status,
      progressLabel: def.progressLabel,
      result: result?.failed ? undefined : result,
      error: result?.error,
      duration_ms: result?._duration_ms,
    };
  });
}

export interface StartScanOptions {
  /** Optional callback for live step progress updates */
  onProgress?: (steps: ScanStep[]) => void;
}

/**
 * Start a server-side scan job via the run-full-scan edge function.
 * Polls for progress and calls registered onScanComplete listeners when done.
 * Returns the scan_run_id on success, or throws on error.
 */
export async function startScanJob(options?: StartScanOptions): Promise<string> {
  stopPolling();

  const { data, error } = await safeInvoke<{ scan_run_id?: string; error?: string }>('run-full-scan', {
    body: { action: 'start' },
  });

  if (error) {
    throw new Error(error?.message ?? 'Kunde inte starta skanning');
  }

  const scanRunId = data?.scan_run_id;
  if (!scanRunId) {
    throw new Error(data?.error ?? 'Inget scan_run_id returnerades');
  }

  _pollInterval = setInterval(() => pollScanRun(scanRunId, options?.onProgress), 2000);
  return scanRunId;
}

/** Load the latest scan run from the DB (e.g. on page load to restore state). */
export async function loadLatestScanRun(): Promise<{ running: boolean; steps: ScanStep[]; unifiedResult: any | null; scanRunId: string | null }> {
  try {
    const { data } = await supabase
      .from('scan_runs' as any)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data) return { running: false, steps: [], unifiedResult: null, scanRunId: null };

    const run = data as any;
    const steps = buildStepsFromRun(run);
    const isRunning = run.status === 'running';
    const isDone = run.status === 'done' || run.status === 'completed';

    return {
      running: isRunning,
      steps,
      unifiedResult: isDone ? (run.unified_result ?? null) : null,
      scanRunId: run.id,
    };
  } catch (e) {
    console.warn('[scanEngine] loadLatestScanRun error', e);
    return { running: false, steps: [], unifiedResult: null, scanRunId: null };
  }
}
