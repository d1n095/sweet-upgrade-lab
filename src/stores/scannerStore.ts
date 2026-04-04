import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useExecutionLockStore } from './executionLockStore';
import { useFeedbackLoopStore } from './feedbackLoopStore';
import { QueryClient } from '@tanstack/react-query';
import { trace, newTraceId as newDebugTraceId } from '@/utils/deepDebugTrace';
import { logData } from '@/utils/actionMonitor';

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
      steps: toRun.map(s => ({ type: s.type, label: s.label, status: 'running' as const })),
    });

    // Global trace log — single source of truth
    console.log('[SCAN TRIGGERED FROM]: AI_CENTER', { steps: toRun.map(s => s.type) });

    const debugTraceId = newDebugTraceId('scan');
    trace('issue_detected', 'ScannerStore', `Starting scan via run-full-scan (${toRun.length} steps)`, { traceId: debugTraceId, details: { steps: toRun.map(s => s.type) } });
    logData({
      type: 'scan',
      source: 'scanner',
      payload: { event: 'start', steps: toRun.map(s => s.type), traceId: debugTraceId },
    });

    try {
      // All scans go through run-full-scan — no ai-assistant calls
      const { data, error } = await supabase.functions.invoke('run-full-scan', {
        body: { action: 'start', scan_mode: 'full', source: 'AI_CENTER' },
      });

      if (error) throw error;

      const scanRunId = data?.scan_id || data?.scan_run_id;
      console.log('[SCAN TRIGGERED FROM]: AI_CENTER — scan_run_id:', scanRunId);

      logData({
        type: 'scan',
        source: 'scanner',
        payload: { source: 'AI_CENTER', scan_run_id: scanRunId, traceId: debugTraceId },
        status: 'success',
      });

      // Invalidate relevant queries so UI reflects new scan results + work items
      if (queryClient) {
        for (const key of POST_SCAN_QUERY_KEYS) {
          queryClient.invalidateQueries({ queryKey: [key] });
        }
      }

      // Evaluate feedback loop after scans
      const fbEntry = await useFeedbackLoopStore.getState().evaluateAfterAction(
        'scan', `Skanning via run-full-scan`, { failed: 0, regressed: 0, errors: 0 }
      );

      const verdictLabel = fbEntry?.verdict === 'improved' ? '📈 Förbättrat' :
        fbEntry?.verdict === 'degraded' ? '📉 Försämrat' : '➡️ Stabilt';
      toast.success(`Skanning startad — ${verdictLabel}`);
      if (fbEntry?.suggestion) toast.warning(fbEntry.suggestion, { duration: 8000 });

      set(state => ({
        steps: state.steps.map(s => ({ ...s, status: 'done' as const })),
      }));
    } catch (err: any) {
      logData({
        type: 'error',
        source: 'scanner',
        payload: { error: err?.message || 'Fel', traceId: debugTraceId, endpoint: 'run-full-scan' },
        status: 'failed',
      });
      set(state => ({
        steps: state.steps.map(s => ({ ...s, status: 'error' as const, error: err?.message || 'Fel' })),
      }));
      toast.error(err?.message || 'Kunde inte starta skanning');
    } finally {
      logData({
        type: 'scan',
        source: 'scanner',
        payload: { event: 'end', traceId: debugTraceId },
        status: 'success',
      });
      lockStore.release(lockId);
      set({ scanning: false });
    }
  },
}));
