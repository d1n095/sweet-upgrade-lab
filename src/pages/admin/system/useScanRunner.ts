import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { startScanJob, loadLatestScanRun, onScanComplete } from '@/lib/scanEngine';
import type { ScanStep, ScanResult } from '@/lib/scanEngine';

export type { ScanStep, ScanResult };

export interface ScanRunnerState {
  running: boolean;
  steps: ScanStep[];
  lastResult: ScanResult | null;
  scanRunId: string | null;
}

export function useScanRunner() {
  const queryClient = useQueryClient();
  const [state, setState] = useState<ScanRunnerState>({
    running: false,
    steps: [],
    lastResult: null,
    scanRunId: null,
  });

  useEffect(() => {
    loadLatestScanRun().then(({ running, steps, unifiedResult, scanRunId }) => {
      if (running || steps.length > 0) {
        setState(prev => ({
          ...prev,
          running,
          steps,
          scanRunId,
          lastResult: unifiedResult
            ? { scanRunId: scanRunId!, steps, unifiedResult, workItemsCreated: 0, systemHealthScore: 0 }
            : prev.lastResult,
        }));
      }
    });
  }, []);

  useEffect(() => {
    return onScanComplete((result) => {
      setState({ running: false, steps: result.steps, lastResult: result, scanRunId: result.scanRunId });
      const score = result.systemHealthScore;
      toast.success(`Skanning klar — ${score}/100 — ${result.workItemsCreated} nya uppgifter`, { duration: 6000 });
      for (const key of ['admin-scan-results', 'admin-work-items', 'admin-bugs', 'mini-workbench-items', 'scan-history', 'work-items']) {
        queryClient.invalidateQueries({ queryKey: [key] });
      }
    });
  }, [queryClient]);

  const run = useCallback(async () => {
    if (state.running) {
      toast.info('En skanning körs redan');
      return;
    }
    setState(prev => ({ ...prev, running: true, steps: [] }));
    try {
      const scanRunId = await startScanJob({
        onProgress: (steps) => setState(prev => ({ ...prev, steps })),
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
