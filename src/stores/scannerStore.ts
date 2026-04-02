import { create } from 'zustand';
import { safeInvoke } from '@/lib/safeInvoke';
import { toast } from 'sonner';
import { QueryClient } from '@tanstack/react-query';

interface ScanState {
  running: boolean;
  jobId: string | null;
  scanRunId: string | null;

  /** Start a full scan via the single approved entry point. */
  startScan: (queryClient?: QueryClient) => Promise<void>;

  /** Called by ScanProgress when the job reaches a terminal state. */
  onScanComplete: (queryClient?: QueryClient) => void;
}

export const useScannerStore = create<ScanState>((set, get) => ({
  running: false,
  jobId: null,
  scanRunId: null,

  startScan: async (queryClient?: QueryClient) => {
    if (get().running) return;

    set({ running: true, jobId: null, scanRunId: null });

    const { data, error } = await safeInvoke('run-full-scan', {
      body: { action: 'start' },
      isAdmin: true,
    });

    if (error) {
      toast.error(error.message || 'Kunde inte starta skanning');
      set({ running: false });
      return;
    }

    if (data?.success === false) {
      toast.error(data.error || 'Skanning avvisad');
      set({ running: false });
      return;
    }

    const jobId: string | null = data?.job_id ?? data?.scan_id ?? null;
    const scanRunId: string | null = data?.scan_id ?? null;
    set({ jobId, scanRunId });
    toast.info('Skanning startad', { duration: 3000 });
  },

  onScanComplete: (queryClient?: QueryClient) => {
    set({ running: false });
    if (queryClient) {
      for (const key of [
        'admin-scan-results',
        'admin-work-items',
        'admin-bugs',
        'mini-workbench-items',
        'autopilot-scan-runs',
        'last-scan-result',
        'scan-history',
        'work-items',
      ]) {
        queryClient.invalidateQueries({ queryKey: [key] });
      }
    }
  },
}));
