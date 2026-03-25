import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { QueryClient } from '@tanstack/react-query';

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

const callAIForScan = async (type: string, payload: Record<string, any> = {}) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Ej inloggad');

  const resp = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ type, ...payload }),
    }
  );

  if (!resp.ok) {
    if (resp.status === 429) throw new Error('AI är överbelastad');
    if (resp.status === 402) throw new Error('AI-krediter slut');
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || `AI-fel (${resp.status})`);
  }

  const data = await resp.json();
  return data.result;
};

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

    const toRun = SCAN_STEPS.filter(s => selectedSteps.has(s.type));
    if (toRun.length === 0) { toast.error('Välj minst en skanning'); return; }

    set({
      scanning: true,
      steps: toRun.map(s => ({ type: s.type, label: s.label, status: 'pending' as const })),
    });

    // Mark all as running
    set(state => ({
      steps: state.steps.map(s => ({ ...s, status: 'running' as const })),
    }));

    // Run all scans in parallel for speed
    await Promise.allSettled(
      toRun.map(async (step, i) => {
        const start = Date.now();
        try {
          const res = await callAIForScan(
            step.type,
            step.type === 'content_validation' ? { auto_fix: false } : {}
          );

          if (res) {
            const duration_ms = Date.now() - start;
            set(state => ({
              steps: state.steps.map((s, idx) => idx === i ? { ...s, status: 'done' as const, result: res, duration_ms } : s),
            }));
          } else {
            set(state => ({
              steps: state.steps.map((s, idx) => idx === i ? { ...s, status: 'error' as const, error: 'Inget resultat', duration_ms: Date.now() - start } : s),
            }));
          }
        } catch (err: any) {
          set(state => ({
            steps: state.steps.map((s, idx) => idx === i ? { ...s, status: 'error' as const, error: err?.message || 'Fel', duration_ms: Date.now() - start } : s),
          }));
        }
      })
    );

    // Invalidate relevant queries so UI reflects new scan results + work items
    if (queryClient) {
      for (const key of POST_SCAN_QUERY_KEYS) {
        queryClient.invalidateQueries({ queryKey: [key] });
      }
    }

    toast.success(`Alla skanningar klara (${toRun.length} st)`);
    set({ scanning: false });
  },
}));
