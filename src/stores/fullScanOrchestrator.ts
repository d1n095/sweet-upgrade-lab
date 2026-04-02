import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import { safeFetch } from '@/lib/safeInvoke';
import { toast } from 'sonner';
import { QueryClient } from '@tanstack/react-query';

export type OrchestratorStepStatus = 'pending' | 'running' | 'done' | 'error' | 'skipped';

export interface OrchestratorStep {
  id: string;
  label: string;
  scanType: string;
  status: OrchestratorStepStatus;
  progressLabel?: string;
  result?: any;
  error?: string;
  duration_ms?: number;
}

export interface FocusMemoryItem {
  focus_key: string;
  focus_type: string;
  label: string;
  issue_count: number;
  scan_count: number;
  severity: string;
  last_seen_at: string;
}

export interface PredictionItem {
  problem: string;
  area: string;
  confidence: number;
  reason: string;
  preventive_fixes: string[];
  type: "prediction";
}

export interface AdaptiveScanMeta {
  iterations: number;
  new_issues_found: number;
  pattern_discoveries: any[];
  high_risk_areas: any[];
  systemic_issues: any[];
  coverage_score: number;
  iteration_results: any[];
  focus_memory?: FocusMemoryItem[];
  predictions?: PredictionItem[];
}

export interface IntegrityIssue {
  type: "data_loss" | "failed_insert" | "stale_state" | "incorrect_filtering" | "scan_error";
  severity: string;
  entity: string;
  entity_id?: string;
  title: string;
  description?: string;
  step: string;
  root_cause: string;
}

export interface BehaviorFailure {
  chain: string;
  action: string;
  expected: string;
  actual: string;
  failure_type: "action_failed" | "partial_execution" | "silent_failure" | "lost_state" | "stale_state";
  step: string;
  severity: string;
  entity_id?: string;
}

export type SystemStage = 'development' | 'staging' | 'production';

export interface UnifiedScanResult {
  blocker: any | null;
  broken_flows: any[];
  fake_features: any[];
  interaction_failures: any[];
  data_issues: any[];
  integrity_issues?: IntegrityIssue[];
  integrity_summary?: Record<string, number>;
  behavior_failures?: BehaviorFailure[];
  behavior_summary?: Record<string, number>;
  system_health_score: number;
  step_results: Record<string, any>;
  completed_at: string;
  total_duration_ms: number;
  adaptive_scan?: AdaptiveScanMeta;
  system_overview?: any;
  system_stage?: SystemStage;
}

/** Filter out dev-expected issues for count/display purposes */
export function filterRelevantIssues<T extends Record<string, any>>(issues: T[]): T[] {
  return issues.filter(i => !i._dev_expected);
}

/**
 * The 10 scanners in exact execution order.
 */
const ORCHESTRATED_STEPS: { id: string; label: string; scanType: string; progressLabel: string }[] = [
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
];

export { ORCHESTRATED_STEPS };

/** Build OrchestratorStep[] from a scan_runs row */
function buildStepsFromScanRun(scanRun: any): OrchestratorStep[] {
  const stepsResults = scanRun.steps_results || {};
  const currentStep = scanRun.current_step || 0;
  const isDone = scanRun.status === 'done';
  const isError = scanRun.status === 'error';

  return ORCHESTRATED_STEPS.map((def, i) => {
    const result = stepsResults[def.id];
    let status: OrchestratorStepStatus = 'pending';

    if (result && !result.failed) {
      status = 'done';
    } else if (result?.failed) {
      status = 'error';
    } else if (i === currentStep && !isDone && !isError) {
      status = 'running';
    } else if (i < currentStep) {
      // Step was processed but no result — might have been skipped
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

interface FullScanOrchestratorState {
  running: boolean;
  steps: OrchestratorStep[];
  currentStepIndex: number;
  unifiedResult: UnifiedScanResult | null;
  postScanStatus: 'idle' | 'generating_items' | 'running_pipeline' | 'done';
  workItemsCreated: number;
  scanRunId: string | null;
  pollInterval: ReturnType<typeof setInterval> | null;
  lockedBy: string | null;
  currentIteration: number;
  currentStepLabel: string;

  /** Start a server-side scan */
  runOrchestrated: (queryClient?: QueryClient) => Promise<void>;

  /** Load the latest scan run from the DB (e.g. on page load) */
  loadLatestScanRun: () => Promise<void>;

  /** Stop polling */
  stopPolling: () => void;
}

export const useFullScanOrchestrator = create<FullScanOrchestratorState>((set, get) => ({
  running: false,
  steps: [],
  currentStepIndex: -1,
  unifiedResult: null,
  postScanStatus: 'idle' as const,
  workItemsCreated: 0,
  scanRunId: null,
  pollInterval: null,
  lockedBy: null,
  currentIteration: 1,
  currentStepLabel: '',

  stopPolling: () => {
    const interval = get().pollInterval;
    if (interval) {
      clearInterval(interval);
      set({ pollInterval: null });
    }
  },

  loadLatestScanRun: async () => {
    try {
      const { data } = await supabase
        .from('scan_runs' as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (!data) return;

      const scanRun = data as any;

      if (scanRun.status === 'running') {
        // A scan is in progress — start polling
        const steps = buildStepsFromScanRun(scanRun);
        set({
          running: true,
          scanRunId: scanRun.id,
          steps,
          currentStepIndex: scanRun.current_step || 0,
          unifiedResult: null,
        });
        get().stopPolling();
        const interval = setInterval(() => pollScanRun(scanRun.id, set, get), 10000);
        set({ pollInterval: interval });
      } else if (scanRun.status === 'done' && scanRun.unified_result) {
        // Show the completed result
        const steps = buildStepsFromScanRun(scanRun);
        set({
          running: false,
          scanRunId: scanRun.id,
          steps,
          currentStepIndex: ORCHESTRATED_STEPS.length,
          unifiedResult: scanRun.unified_result as UnifiedScanResult,
          postScanStatus: 'done',
          workItemsCreated: scanRun.work_items_created || 0,
        });
      }
    } catch (e) {
      console.warn('Failed to load latest scan run:', e);
    }
  },

  runOrchestrated: async (queryClient?: QueryClient) => {
    if (get().running) return;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error('Du måste vara inloggad');
      return;
    }

    // Initialize steps as pending
    const initialSteps: OrchestratorStep[] = ORCHESTRATED_STEPS.map(s => ({
      id: s.id,
      label: s.label,
      scanType: s.scanType,
      status: 'pending' as const,
      progressLabel: s.progressLabel,
    }));

    set({ running: true, steps: initialSteps, currentStepIndex: 0, unifiedResult: null, postScanStatus: 'idle', workItemsCreated: 0 });

    try {
      // Call the server-side edge function to start the scan
      const resp = await safeFetch('run-full-scan', {
        body: { action: 'start' },
        isAdmin: true,
      });

      if (resp.status === 409) {
        const err = await resp.json();
        toast.error(err.error || 'En skanning körs redan');
        set({ running: false, steps: [] });
        return;
      }

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || `Fel ${resp.status}`);
      }

      const result = await resp.json();
      const scanRunId = result.scan_run_id;

      set({ scanRunId });

      // Start polling for progress
      get().stopPolling();
      const interval = setInterval(() => pollScanRun(scanRunId, set, get, queryClient), 10000);
      set({ pollInterval: interval });

      toast.info('Skanning startad i bakgrunden — du kan navigera bort', { duration: 5000 });
    } catch (err: any) {
      toast.error(err.message || 'Kunde inte starta skanning');
      set({ running: false, steps: [] });
    }
  },
}));

/** Poll a scan run for progress */
async function pollScanRun(
  scanRunId: string,
  set: any,
  get: any,
  queryClient?: QueryClient
) {
  try {
    const { data } = await supabase
      .from('scan_runs' as any)
      .select('*')
      .eq('id', scanRunId)
      .single();

    if (!data) return;
    const scanRun = data as any;

    const steps = buildStepsFromScanRun(scanRun);

    if (scanRun.status === 'done') {
      // Scan completed!
      get().stopPolling();

      set({
        running: false,
        steps,
        currentStepIndex: ORCHESTRATED_STEPS.length,
        unifiedResult: scanRun.unified_result as UnifiedScanResult,
        postScanStatus: 'done',
        workItemsCreated: scanRun.work_items_created || 0,
      });

      const score = scanRun.system_health_score || 0;
      toast.success(`Skanning klar — ${score}/100 — ${scanRun.work_items_created || 0} nya uppgifter`, { duration: 6000 });

      if (queryClient) {
        for (const key of ['admin-scan-results', 'admin-work-items', 'admin-bugs', 'mini-workbench-items', 'autopilot-scan-runs', 'last-scan-result', 'scan-history', 'work-items']) {
          queryClient.invalidateQueries({ queryKey: [key] });
        }
      }
    } else if (scanRun.status === 'error') {
      get().stopPolling();
      set({
        running: false,
        steps,
        postScanStatus: 'idle',
      });
      toast.error(`Skanning avbröts: ${scanRun.error_message || 'Okänt fel'}`);
    } else {
      // Still running — update progress
      set({
        steps,
        currentStepIndex: scanRun.current_step || 0,
        currentIteration: scanRun.iteration || 1,
        currentStepLabel: scanRun.current_step_label || '',
      });
    }
  } catch (e) {
    console.warn('Poll error:', e);
  }
}
