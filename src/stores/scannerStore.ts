import { create } from 'zustand';
import { QueryClient } from '@tanstack/react-query';
import { useFullScanOrchestrator } from './fullScanOrchestrator';
import { toast } from 'sonner';

export type ScanStepStatus = 'pending' | 'running' | 'done' | 'error';

export interface ScanStepResult {
  type: string;
  label: string;
  status: ScanStepStatus;
  result?: any;
  error?: string;
  duration_ms?: number;
}

export const SCAN_STEPS = [
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

interface ScannerState {
  scanning: boolean;
  steps: ScanStepResult[];
  selectedSteps: Set<string>;
  toggleStep: (type: string) => void;
  selectAll: () => void;
  selectNone: () => void;
  runAllScans: (queryClient?: QueryClient) => Promise<void>;
}

/**
 * Scanner store — delegates to fullScanOrchestrator which calls run-full-scan edge function.
 */
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
    if (get().scanning) return;

    const orchestrator = useFullScanOrchestrator.getState();
    if (orchestrator.running) {
      toast.info('En skanning körs redan');
      return;
    }

    set({ scanning: true });

    try {
      await orchestrator.runOrchestrated(queryClient);
      
      // Poll orchestrator state until done
      const checkDone = () => {
        const state = useFullScanOrchestrator.getState();
        if (!state.running) {
          set({ scanning: false });
          return;
        }
        setTimeout(checkDone, 2000);
      };
      setTimeout(checkDone, 3000);
    } catch {
      set({ scanning: false });
    }
  },
}));
