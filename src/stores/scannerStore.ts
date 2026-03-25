import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
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

const SCAN_STEPS = [
  { type: 'system_scan', label: 'Systemskanning', desc: 'Full skanning av alla datakällor' },
  { type: 'data_integrity', label: 'Dataintegritet', desc: 'Brutna relationer, felaktiga tillstånd' },
  { type: 'content_validation', label: 'Innehåll QA', desc: 'Verifierar UI-påståenden mot data' },
  { type: 'sync_scan', label: 'Sync Scanner', desc: 'Frontend-backend-inkonsekvenser' },
  { type: 'interaction_qa', label: 'Interaction QA', desc: 'Döda element, brutna flöden' },
  { type: 'visual_qa', label: 'Visual QA', desc: 'Layout, responsivitet, overflow' },
  { type: 'nav_scan', label: 'Navigation', desc: 'Navigering, länkar, routing' },
  { type: 'ux_scan', label: 'UX Scanner', desc: 'Användarupplevelse, tillgänglighet' },
  { type: 'action_governor', label: 'Governor', desc: 'Klassificerar åtgärder' },
] as const;

export { SCAN_STEPS };

interface ScannerState {
  scanning: boolean;
  steps: ScanStepResult[];
  selectedSteps: Set<string>;
  toggleStep: (type: string) => void;
  selectAll: () => void;
  selectNone: () => void;
  runAllScans: () => Promise<void>;
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

  runAllScans: async () => {
    const { scanning, selectedSteps } = get();
    if (scanning) return;

    const toRun = SCAN_STEPS.filter(s => selectedSteps.has(s.type));
    if (toRun.length === 0) { toast.error('Välj minst en skanning'); return; }

    set({
      scanning: true,
      steps: toRun.map(s => ({ type: s.type, label: s.label, status: 'pending' as const })),
    });

    for (let i = 0; i < toRun.length; i++) {
      const step = toRun[i];

      // Update current step to running
      set(state => ({
        steps: state.steps.map((s, idx) => idx === i ? { ...s, status: 'running' as const } : s),
      }));

      const start = Date.now();
      try {
        const res = await callAIForScan(
          step.type,
          step.type === 'content_validation' ? { auto_fix: false } : {}
        );
        const duration_ms = Date.now() - start;

        if (res) {
          // Persist to DB
          const { data: { session } } = await supabase.auth.getSession();
          const score = res.system_score || res.score || res.interaction_score || res.overall_score || null;
          const issueCount = res.issues_found || res.issues?.length || res.dead_elements?.length || res.mismatches?.length || 0;
          const tasksCreated = res.tasks_created || 0;
          const summary = res.executive_summary || res.summary || res.overall_summary || `${step.label} slutförd`;

          await supabase.from('ai_scan_results' as any).insert({
            scan_type: step.type,
            results: res,
            overall_score: score,
            overall_status: score !== null ? (score >= 70 ? 'healthy' : score >= 40 ? 'warning' : 'critical') : null,
            executive_summary: typeof summary === 'string' ? summary.substring(0, 500) : null,
            issues_count: issueCount,
            tasks_created: tasksCreated,
            scanned_by: session?.user?.id || null,
          } as any);

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
    }

    toast.success(`Alla skanningar klara (${toRun.length} st)`);
    set({ scanning: false });
  },
}));
