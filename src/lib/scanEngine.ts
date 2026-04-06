import { supabase } from '@/integrations/supabase/client';
import { safeInvoke } from '@/lib/safeInvoke';

export type ScanStatus = 'idle' | 'running' | 'done' | 'error';

export interface ScanJob {
  id: string;
  type: string;
  status: 'running' | 'done' | 'error' | 'idle';
}

let _currentJob: ScanJob | null = null;

/** Returns the currently active scan job, or null if no scan is running. */
export function getCurrentJob(): ScanJob | null {
  return _currentJob;
}

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
  startedAt?: string;
  completedAt?: string;
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
  _currentJob = null;
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
        startedAt: run.started_at ?? undefined,
        completedAt: run.completed_at ?? undefined,
      });
    } else if (run.status === 'error' || run.status === 'failed') {
      stopPolling();
    }
  } catch (_) {
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
    isAdmin: true,
  });

  if (error) {
    throw new Error(error?.message || (error as any)?.error || 'Kunde inte starta skanning');
  }

  const scanRunId = data?.scan_run_id;
  if (!scanRunId) {
    throw new Error(data?.error ?? 'Inget scan_run_id returnerades');
  }

  _currentJob = { id: scanRunId, type: 'full', status: 'running' };
  _pollInterval = setInterval(() => pollScanRun(scanRunId, options?.onProgress), 2000);
  return scanRunId;
}

/**
 * On page load, check if there was an interrupted (running) scan job and
 * resume polling for it so the UI stays in sync.
 */
export async function resumeInterruptedJob(): Promise<void> {
  try {
    const { data } = await supabase
      .from('scan_runs' as any)
      .select('id')
      .eq('status', 'running')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data) return;
    const scanRunId = (data as any).id as string;
    stopPolling();
    _currentJob = { id: scanRunId, type: 'full', status: 'running' };
    _pollInterval = setInterval(() => pollScanRun(scanRunId), 2000);
  } catch {
    // noop — non-critical on startup
  }
}

/** Load the latest scan run from the DB (e.g. on page load to restore state).
 * Returns the running scan if one exists, otherwise the latest completed scan. */
export async function loadLatestScanRun(): Promise<{
  running: boolean;
  steps: ScanStep[];
  unifiedResult: any | null;
  scanRunId: string | null;
  startedAt: string | null;
  completedAt: string | null;
}> {
  const empty = { running: false, steps: [], unifiedResult: null, scanRunId: null, startedAt: null, completedAt: null };
  try {
    // 1. Check for an in-progress scan first
    const { data: runningRow } = await supabase
      .from('scan_runs' as any)
      .select('id, status, started_at, completed_at, steps_results, unified_result, work_items_created, system_health_score, current_step')
      .eq('status', 'running')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (runningRow) {
      const run = runningRow as any;
      return {
        running: true,
        steps: buildStepsFromRun(run),
        unifiedResult: null,
        scanRunId: run.id,
        startedAt: run.started_at ?? null,
        completedAt: null,
      };
    }

    // 2. Fetch the latest completed scan
    const { data: completedRow } = await supabase
      .from('scan_runs' as any)
      .select('id, status, started_at, completed_at, steps_results, unified_result, work_items_created, system_health_score, current_step')
      .in('status', ['done', 'completed'])
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!completedRow) return empty;

    const run = completedRow as any;
    const issueCount = run.work_items_created ?? 0;
    return {
      running: false,
      steps: buildStepsFromRun(run),
      unifiedResult: run.unified_result ?? null,
      scanRunId: run.id,
      startedAt: run.started_at ?? null,
      completedAt: run.completed_at ?? null,
    };
  } catch (_) {
    return empty;
  }
}
