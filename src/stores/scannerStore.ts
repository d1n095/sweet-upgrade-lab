import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useExecutionLockStore } from './executionLockStore';
import { useFeedbackLoopStore } from './feedbackLoopStore';
import { QueryClient } from '@tanstack/react-query';
import { createTraceId, observeScanStep, observeError, observeAction, flushObservabilityBuffer } from '@/utils/observabilityLogger';
import { trace, newTraceId as newDebugTraceId } from '@/utils/deepDebugTrace';

export type ScanStepStatus = 'pending' | 'running' | 'done' | 'error';

export interface ScanStepResult {
  type: string;
  label: string;
  status: ScanStepStatus;
  result?: any;
  error?: string;
  duration_ms?: number;
}

const SCAN_STEPS = [
  { type: 'system_scan', label: 'Systemskanning', desc: 'Full skanning av alla datakällor' },
  { type: 'data_integrity', label: 'Dataintegritet', desc: 'Brutna relationer, felaktiga tillstånd' },
  { type: 'content_validation', label: 'Innehåll QA', desc: 'Verifierar UI-påståenden mot data' },
  { type: 'sync_scan', label: 'Sync Scanner', desc: 'Frontend-backend-inkonsekvenser' },
  { type: 'interaction_qa', label: 'Interaction QA', desc: 'Döda element, brutna flöden' },
  { type: 'visual_qa', label: 'Visual QA', desc: 'Layout, responsivitet, overflow' },
  { type: 'nav_scan', label: 'Navigation', desc: 'Navigering, länkar, routing' },
  { type: 'ux_scan', label: 'UX Scanner', desc: 'Användarupplevelse, tillgänglighet' },
  { type: 'human_test', label: 'Användartest', desc: 'Simulerar användarbeteende end-to-end' },
  { type: 'action_governor', label: 'Governor', desc: 'Klassificerar åtgärder' },
  { type: 'feature_detection', label: 'Feature Detection', desc: 'Real vs Fake — klassificerar funktioner' },
] as const;

export { SCAN_STEPS };

/** Keys to invalidate after scans complete */
const POST_SCAN_QUERY_KEYS = [
  'admin-scan-results',
  'admin-work-items',
  'admin-bugs',
  'mini-workbench-items',
];

interface ScannerState {
  scanning: boolean;
  steps: ScanStepResult[];
  selectedSteps: Set<string>;
  toggleStep: (type: string) => void;
  selectAll: () => void;
  selectNone: () => void;
  runAllScans: (queryClient?: QueryClient) => Promise<void>;
}

export const useScannerStore = create<ScannerState>((set, get) => ({
  scanning: false,
  steps: [],
  selectedSteps: new Set(SCAN_STEPS.map(s => s.type)),

  toggleStep: (type: string) => {
    set(state => {
      const next = new Set(state.selectedSteps);
      if (next.has(type)) next.delete(type); else next.add(type);
      return { selectedSteps: next };
    });
  },

  selectAll: () => set({ selectedSteps: new Set(SCAN_STEPS.map(s => s.type)) }),
  selectNone: () => set({ selectedSteps: new Set() }),

  runAllScans: async (queryClient?: QueryClient) => {
    const { scanning, selectedSteps } = get();
    if (scanning) return;

    // Acquire scans lock
    const lockStore = useExecutionLockStore.getState();
    const lockId = `scanner-${Date.now()}`;
    const acquired = lockStore.acquire('scans', lockId, 'Full scanner run');
    if (!acquired) {
      const holder = lockStore.getHolder('scans');
      toast.error(`Skanningar blockerade — område låst av ${holder?.description || 'annan uppgift'}`);
      lockStore.logConflict(lockId, 'Scanner run', 'scans', holder?.lockedBy || 'unknown');
      return;
    }

    const toRun = SCAN_STEPS.filter(s => selectedSteps.has(s.type));
    if (toRun.length === 0) { toast.error('Välj minst en skanning'); lockStore.release(lockId); return; }

    // Capture before-snapshot for feedback loop
    await useFeedbackLoopStore.getState().captureBeforeAction();

    set({
      scanning: true,
      steps: toRun.map(s => ({ type: s.type, label: s.label, status: 'pending' as const })),
    });

    // Mark all as running
    set(state => ({
      steps: state.steps.map(s => ({ ...s, status: 'running' as const })),
    }));

    // Run all scans in parallel for speed
    const traceId = createTraceId('quick-scan');
    const debugTraceId = newDebugTraceId('scan');
    trace('issue_detected', 'ScannerStore', `Starting scan (${toRun.length} steps)`, { traceId: debugTraceId, details: { steps: toRun.map(s => s.type) } });
    observeAction(`Startar snabbskanning (${toRun.length} steg)`, { trace_id: traceId, source: 'scanner' });

    const start = Date.now();
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Ej inloggad');

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/run-full-scan`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ action: 'start' }),
        }
      );

      const result = await resp.json();
      const duration_ms = Date.now() - start;

      if (result.success) {
        trace('scan_update', 'ScannerStore', `Scan started (${duration_ms}ms)`, { traceId: debugTraceId, details: { scan_id: result.scan_id } });
        observeScanStep('Skanning startad', { trace_id: traceId, component: 'run-full-scan', duration_ms });
        set(state => ({
          steps: state.steps.map(s => ({ ...s, status: 'done' as const, result, duration_ms })),
        }));
      } else {
        const errMsg = result.error || 'Skanningsfel';
        observeError('Skanningsfel', undefined, { trace_id: traceId, component: 'run-full-scan', duration_ms });
        set(state => ({
          steps: state.steps.map(s => ({ ...s, status: 'error' as const, error: errMsg, duration_ms })),
        }));
      }
    } catch (err: any) {
      const duration_ms = Date.now() - start;
      observeError('Skanningsfel', err, { trace_id: traceId, component: 'run-full-scan', duration_ms });
      set(state => ({
        steps: state.steps.map(s => ({ ...s, status: 'error' as const, error: err?.message || 'Fel', duration_ms })),
      }));
    }

    observeAction(`Snabbskanning klar (${toRun.length} steg)`, { trace_id: traceId, source: 'scanner' });
    flushObservabilityBuffer();

    // Invalidate relevant queries so UI reflects new scan results + work items
    if (queryClient) {
      for (const key of POST_SCAN_QUERY_KEYS) {
        queryClient.invalidateQueries({ queryKey: [key] });
      }
    }

    // Evaluate feedback loop after scans
    const steps = get().steps;
    const errorCount = steps.filter(s => s.status === 'error').length;
    const fbEntry = await useFeedbackLoopStore.getState().evaluateAfterAction(
      'scan', `Skanning (${toRun.length} steg)`, { failed: errorCount, regressed: 0, errors: errorCount }
    );

    const verdictLabel = fbEntry?.verdict === 'improved' ? '📈 Förbättrat' :
      fbEntry?.verdict === 'degraded' ? '📉 Försämrat' : '➡️ Stabilt';
    toast.success(`Skanningar klara (${toRun.length} st) — ${verdictLabel}`);
    if (fbEntry?.suggestion) toast.warning(fbEntry.suggestion, { duration: 8000 });

    lockStore.release(lockId);
    set({ scanning: false });
  },
}));
