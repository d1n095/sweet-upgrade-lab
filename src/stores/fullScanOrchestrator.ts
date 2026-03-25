import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import { useExecutionLockStore } from './executionLockStore';
import { useFeedbackLoopStore } from './feedbackLoopStore';
import { toast } from 'sonner';
import { QueryClient } from '@tanstack/react-query';
import { runUnifiedPipeline } from '@/lib/unifiedPipeline';
import { runCriticalPathCheck } from '@/lib/criticalPathProtection';
import { runCriticalEscalation } from '@/lib/criticalEscalation';

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

export interface UnifiedScanResult {
  blocker: any | null;
  broken_flows: any[];
  fake_features: any[];
  interaction_failures: any[];
  data_issues: any[];
  system_health_score: number;
  step_results: Record<string, any>;
  completed_at: string;
  total_duration_ms: number;
}

/**
 * The 10 scanners in exact execution order.
 * Each maps to an existing edge function scan type.
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

const callScan = async (scanType: string, extraPayload: Record<string, any> = {}): Promise<any> => {
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
      body: JSON.stringify({ type: scanType, ...extraPayload }),
    }
  );

  if (!resp.ok) {
    if (resp.status === 429) throw new Error('AI är överbelastad — vänta och försök igen');
    if (resp.status === 402) throw new Error('AI-krediter slut');
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || `AI-fel (${resp.status})`);
  }

  const data = await resp.json();
  return data.result;
};

/** Build the unified result from all step results */
function buildUnifiedResult(stepResults: Record<string, any>, totalDuration: number): UnifiedScanResult {
  const blocker = stepResults.blocker_detection?.primary_blocker || stepResults.blocker_detection?.detected_blockers?.[0] || null;

  const broken_flows: any[] = [];
  if (stepResults.data_flow_validation?.issues) broken_flows.push(...stepResults.data_flow_validation.issues);
  if (stepResults.data_flow_validation?.broken_links) broken_flows.push(...stepResults.data_flow_validation.broken_links);
  if (stepResults.navigation_verification?.issues) broken_flows.push(...stepResults.navigation_verification.issues);
  if (stepResults.navigation_verification?.broken_routes) broken_flows.push(...stepResults.navigation_verification.broken_routes);

  const fake_features: any[] = [];
  if (stepResults.feature_detection?.features) {
    fake_features.push(
      ...stepResults.feature_detection.features.filter((f: any) => f.status === 'fake' || f.classification === 'fake')
    );
  }

  const interaction_failures: any[] = [];
  if (stepResults.interaction_qa?.issues) interaction_failures.push(...stepResults.interaction_qa.issues);
  if (stepResults.human_test?.issues) interaction_failures.push(...stepResults.human_test.issues);
  if (stepResults.human_test?.test_failures) interaction_failures.push(...stepResults.human_test.test_failures);

  const data_issues: any[] = [];
  if (stepResults.ui_data_binding?.issues) data_issues.push(...stepResults.ui_data_binding.issues);
  if (stepResults.ui_data_binding?.mismatches) data_issues.push(...stepResults.ui_data_binding.mismatches);

  const scores: number[] = [];
  for (const key of Object.keys(stepResults)) {
    const r = stepResults[key];
    if (r?.overall_score != null) scores.push(r.overall_score);
    if (r?.system_score != null) scores.push(r.system_score);
    if (r?.health_score != null) scores.push(r.health_score);
    if (r?.score != null) scores.push(r.score);
  }
  const system_health_score = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

  return {
    blocker,
    broken_flows,
    fake_features,
    interaction_failures,
    data_issues,
    system_health_score,
    step_results: stepResults,
    completed_at: new Date().toISOString(),
    total_duration_ms: totalDuration,
  };
}

/** Auto-generate prioritized work items from scan findings */
async function autoGenerateWorkItems(unified: UnifiedScanResult): Promise<number> {
  let created = 0;
  const allIssues: { title: string; priority: string; item_type: string; source: string }[] = [];

  if (unified.blocker) {
    allIssues.push({
      title: `BLOCKER: ${unified.blocker.description || unified.blocker.title || 'Critical blocker detected'}`.slice(0, 120),
      priority: 'critical',
      item_type: 'bug',
      source: 'blocker_detection',
    });
  }

  for (const flow of unified.broken_flows.slice(0, 5)) {
    allIssues.push({
      title: `Broken flow: ${flow.description || flow.route || flow.issue || 'unknown'}`.slice(0, 120),
      priority: 'high',
      item_type: 'bug',
      source: 'data_flow_validation',
    });
  }

  for (const fake of unified.fake_features.slice(0, 5)) {
    allIssues.push({
      title: `Fake feature: ${fake.name || fake.component || fake.description || 'unknown'}`.slice(0, 120),
      priority: 'high',
      item_type: 'improvement',
      source: 'feature_detection',
    });
  }

  for (const fail of unified.interaction_failures.slice(0, 3)) {
    allIssues.push({
      title: `Interaction failure: ${fail.description || fail.element || 'unknown'}`.slice(0, 120),
      priority: 'medium',
      item_type: 'bug',
      source: 'interaction_qa',
    });
  }

  for (const issue of allIssues) {
    // Dedup check
    const { data: existing } = await supabase
      .from('work_items' as any)
      .select('id')
      .eq('title', issue.title)
      .in('status', ['open', 'in_progress'])
      .limit(1);

    if (existing && existing.length > 0) continue;

    const { error } = await (supabase.from('work_items' as any) as any).insert({
      title: issue.title,
      description: `Auto-generated from full orchestrated scan`,
      status: 'open',
      priority: issue.priority,
      item_type: issue.item_type,
      source_type: 'ai_scan',
      source_id: issue.source,
    });

    if (!error) created++;
  }

  return created;
}

interface FullScanOrchestratorState {
  running: boolean;
  steps: OrchestratorStep[];
  currentStepIndex: number;
  unifiedResult: UnifiedScanResult | null;
  postScanStatus: 'idle' | 'generating_items' | 'running_pipeline' | 'done';
  workItemsCreated: number;
  runOrchestrated: (queryClient?: QueryClient) => Promise<void>;
}

export const useFullScanOrchestrator = create<FullScanOrchestratorState>((set, get) => ({
  running: false,
  steps: [],
  currentStepIndex: -1,
  unifiedResult: null,
  postScanStatus: 'idle' as const,
  workItemsCreated: 0,

  runOrchestrated: async (queryClient?: QueryClient) => {
    if (get().running) return;

    const lockStore = useExecutionLockStore.getState();
    const lockId = `orchestrator-${Date.now()}`;
    const acquired = lockStore.acquire('scans', lockId, 'Full Orchestrated Scan');
    if (!acquired) {
      const holder = lockStore.getHolder('scans');
      toast.error(`Skanningar blockerade — låst av ${holder?.description || 'annan uppgift'}`);
      return;
    }

    await useFeedbackLoopStore.getState().captureBeforeAction();

    const initialSteps: OrchestratorStep[] = ORCHESTRATED_STEPS.map(s => ({
      id: s.id,
      label: s.label,
      scanType: s.scanType,
      status: 'pending' as const,
      progressLabel: s.progressLabel,
    }));

    set({ running: true, steps: initialSteps, currentStepIndex: -1, unifiedResult: null });

    const stepResults: Record<string, any> = {};
    const globalStart = Date.now();

    for (let i = 0; i < initialSteps.length; i++) {
      const step = initialSteps[i];

      set(s => ({
        currentStepIndex: i,
        steps: s.steps.map((st, idx) => idx === i ? { ...st, status: 'running' as const } : st),
      }));

      const stepStart = Date.now();

      try {
        const previousContext: Record<string, any> = {};
        if (Object.keys(stepResults).length > 0) {
          for (const [key, val] of Object.entries(stepResults)) {
            if (val?.overall_score != null) previousContext[key] = { score: val.overall_score };
            if (val?.issues_count != null) previousContext[key] = { ...previousContext[key], issues: val.issues_count };
          }
        }

        const result = await callScan(step.scanType, {
          orchestrated: true,
          step_index: i,
          previous_context: Object.keys(previousContext).length > 0 ? previousContext : undefined,
        });

        stepResults[step.id] = result;
        const duration_ms = Date.now() - stepStart;

        set(s => ({
          steps: s.steps.map((st, idx) => idx === i ? { ...st, status: 'done' as const, result, duration_ms } : st),
        }));
      } catch (err: any) {
        const duration_ms = Date.now() - stepStart;
        stepResults[step.id] = { error: err?.message, failed: true };

        set(s => ({
          steps: s.steps.map((st, idx) => idx === i ? { ...st, status: 'error' as const, error: err?.message, duration_ms } : st),
        }));
      }
    }

    const totalDuration = Date.now() - globalStart;
    const unified = buildUnifiedResult(stepResults, totalDuration);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      await supabase.from('ai_scan_results' as any).insert({
        scan_type: 'full_orchestrated',
        results: unified as any,
        overall_score: unified.system_health_score,
        overall_status: unified.system_health_score >= 75 ? 'healthy' : unified.system_health_score >= 50 ? 'warning' : 'critical',
        executive_summary: `Full scan: ${unified.system_health_score}/100 | ${unified.broken_flows.length} broken flows | ${unified.fake_features.length} fake features | ${unified.interaction_failures.length} interaction failures | ${unified.data_issues.length} data issues | Blocker: ${unified.blocker ? 'YES' : 'none'}`,
        issues_count: unified.broken_flows.length + unified.fake_features.length + unified.interaction_failures.length + unified.data_issues.length,
        scanned_by: session?.user?.id || null,
      });
    } catch (e) {
      console.warn('Failed to persist orchestrated scan result:', e);
    }

    // ── POST-SCAN: Auto-generate work items ──
    set({ postScanStatus: 'generating_items' });
    let workItemsCreated = 0;
    try {
      workItemsCreated = await autoGenerateWorkItems(unified);
      if (workItemsCreated > 0) {
        toast.info(`${workItemsCreated} arbetsuppgifter skapade från skanning`, { duration: 4000 });
      }
    } catch (e) {
      console.warn('Failed to auto-generate work items:', e);
    }

    // ── POST-SCAN: Run unified pipeline (links bugs → work items → change log → verification) ──
    set({ postScanStatus: 'running_pipeline' });
    try {
      await runUnifiedPipeline();
    } catch (e) {
      console.warn('Post-scan pipeline failed:', e);
    }

    // ── POST-SCAN: Critical Path Protection check ──
    try {
      const pathReport = await runCriticalPathCheck();
      if (!pathReport.healthy) {
        console.warn(`[CriticalPath] ${pathReport.brokenStages.length} broken stages detected`);
      }
    } catch (e) {
      console.warn('Critical path check failed:', e);
    }

    if (queryClient) {
      for (const key of ['admin-scan-results', 'admin-work-items', 'admin-bugs', 'mini-workbench-items', 'autopilot-scan-runs', 'last-scan-result', 'scan-history', 'work-items']) {
        queryClient.invalidateQueries({ queryKey: [key] });
      }
    }

    const errorCount = get().steps.filter(s => s.status === 'error').length;
    const fbEntry = await useFeedbackLoopStore.getState().evaluateAfterAction(
      'scan', `Full Orchestrated Scan (10 steg)`, { failed: errorCount, regressed: 0, errors: errorCount }
    );

    const verdictLabel = fbEntry?.verdict === 'improved' ? '📈 Förbättrat' :
      fbEntry?.verdict === 'degraded' ? '📉 Försämrat' : '➡️ Stabilt';
    toast.success(`Full skanning klar — ${unified.system_health_score}/100 — ${verdictLabel} — ${workItemsCreated} nya uppgifter`, { duration: 6000 });

    lockStore.release(lockId);
    set({ running: false, unifiedResult: unified, postScanStatus: 'done', workItemsCreated });
  },
}));
