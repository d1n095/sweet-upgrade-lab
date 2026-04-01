import { create } from 'zustand';
import { QueryClient } from '@tanstack/react-query';
import { useFullScanOrchestrator } from './fullScanOrchestrator';

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
  startScan: (queryClient?: QueryClient) => Promise<void>;
  /** @deprecated use startScan */
  runAllScans: (queryClient?: QueryClient) => Promise<void>;
  startScanJob: (scope?: string, queryClient?: QueryClient) => Promise<void>;
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

  startScan: async (queryClient?: QueryClient) => {
    if (get().scanning) return;
    set({ scanning: true });
    try {
      await useFullScanOrchestrator.getState().runOrchestrated(queryClient);
    } finally {
      set({ scanning: false });
    }
  },

  runAllScans: async (queryClient?: QueryClient) => {
    return get().startScan(queryClient);
  },

  startScanJob: async (_scope = 'system', queryClient?: QueryClient) => {
    return get().startScan(queryClient);
  },
}));
