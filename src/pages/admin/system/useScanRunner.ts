import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { startScanJob, loadLatestScanRun, onScanComplete, type ScanStep, type ScanResult, type ScanProgressUpdate } from '@/lib/scanEngine';

export type { ScanStep, ScanResult, ScanProgressUpdate };

export interface ScanRunnerState {
  running: boolean;
  steps: ScanStep[];
  lastResult: ScanResult | null;
  scanRunId: string | null;
  startedAt: string | null;
  completedAt: string | null;
  /** 0-100 progress value from scan_runs.progress (backend-written) */
  dbProgress: number;
  /** Human-readable label for the current step */
  currentStepLabel: string;
}

export function useScanRunner() {
  const queryClient = useQueryClient();
  const [state, setState] = useState<ScanRunnerState>({
    running: false,
    steps: [],
    lastResult: null,
    scanRunId: null,
    startedAt: null,
    completedAt: null,
    dbProgress: 0,
    currentStepLabel: '',
  });

  useEffect(() => {
    loadLatestScanRun().then(({ running, steps, unifiedResult, scanRunId, startedAt, completedAt }) => {
      if (running || steps.length > 0) {
        setState(prev => ({
          ...prev,
          running,
          steps,
          scanRunId,
          startedAt,
          completedAt,
          lastResult: unifiedResult
            ? { scanRunId: scanRunId!, steps, unifiedResult, workItemsCreated: 0, systemHealthScore: 0, startedAt: startedAt ?? undefined, completedAt: completedAt ?? undefined }
            : prev.lastResult,
        }));
      }
    });
  }, []);

  useEffect(() => {
    return onScanComplete((result) => {
      setState({ running: false, steps: result.steps, lastResult: result, scanRunId: result.scanRunId, startedAt: result.startedAt ?? null, completedAt: result.completedAt ?? null, dbProgress: 100, currentStepLabel: '' });
      const score = result.systemHealthScore;
      toast.success(`Skanning klar — ${score}/100 — ${result.workItemsCreated} nya uppgifter`, { duration: 6000 });
      for (const key of ['admin-scan-results', 'admin-work-items', 'admin-bugs', 'mini-workbench-items', 'scan-history', 'work-items', 'system-explorer-latest-run', 'system-explorer-latest-scan', 'backend-scan-latest']) {
        queryClient.invalidateQueries({ queryKey: [key] });
      }
    });
  }, [queryClient]);

  const run = useCallback(async () => {
    if (state.running) {
      toast.info('En skanning körs redan');
      return;
    }
    console.log('[SCAN] Trigger — no active lock, starting fresh scan');
    setState(prev => ({ ...prev, running: true, steps: [], dbProgress: 0, currentStepLabel: '' }));
    try {
      const scanRunId = await startScanJob({
        onProgress: ({ steps, progress, currentStepLabel }) =>
          setState(prev => ({ ...prev, steps, dbProgress: progress, currentStepLabel })),
      });
      setState(prev => ({ ...prev, scanRunId }));
      toast.info('Skanning startad i bakgrunden — du kan navigera bort', { duration: 5000 });
    } catch (err: any) {
      toast.error(err.message || 'Kunde inte starta skanning');
      setState(prev => ({ ...prev, running: false }));
    }
  }, [state.running]);

  return { ...state, run };
}
