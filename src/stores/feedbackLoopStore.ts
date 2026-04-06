import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';

export type FeedbackVerdict = 'improved' | 'stable' | 'degraded' | 'unknown';

export interface FeedbackSnapshot {
  openBugs: number;
  criticalBugs: number;
  openWorkItems: number;
  avgScanScore: number;
  failedTasks: number;
  regressedTasks: number;
  totalErrors: number;
  capturedAt: string;
}

export interface FeedbackEntry {
  id: string;
  trigger: 'scan' | 'fix' | 'verification' | 'pipeline';
  triggerLabel: string;
  before: FeedbackSnapshot;
  after: FeedbackSnapshot;
  verdict: FeedbackVerdict;
  delta: FeedbackDelta;
  suggestion?: string;
  createdAt: string;
}

export interface FeedbackDelta {
  bugsDelta: number;
  criticalDelta: number;
  workItemsDelta: number;
  scanScoreDelta: number;
  errorsDelta: number;
  regressionsDelta: number;
}

function deriveVerdict(delta: FeedbackDelta): FeedbackVerdict {
  const positiveSignals =
    (delta.bugsDelta < 0 ? 1 : 0) +
    (delta.criticalDelta < 0 ? 1 : 0) +
    (delta.scanScoreDelta > 0 ? 1 : 0) +
    (delta.errorsDelta < 0 ? 1 : 0) +
    (delta.regressionsDelta <= 0 ? 1 : 0);

  const negativeSignals =
    (delta.bugsDelta > 2 ? 1 : 0) +
    (delta.criticalDelta > 0 ? 1 : 0) +
    (delta.scanScoreDelta < -10 ? 1 : 0) +
    (delta.errorsDelta > 2 ? 1 : 0) +
    (delta.regressionsDelta > 0 ? 2 : 0); // regressions weigh double

  if (negativeSignals >= 3) return 'degraded';
  if (positiveSignals >= 3 && negativeSignals === 0) return 'improved';
  if (positiveSignals >= 2) return 'improved';
  if (negativeSignals >= 2) return 'degraded';
  return 'stable';
}

function buildSuggestion(verdict: FeedbackVerdict, delta: FeedbackDelta): string | undefined {
  if (verdict === 'improved') return undefined;
  const issues: string[] = [];
  if (delta.regressionsDelta > 0) issues.push(`${delta.regressionsDelta} nya regressioner — överväg rollback`);
  if (delta.criticalDelta > 0) issues.push(`${delta.criticalDelta} nya kritiska buggar`);
  if (delta.scanScoreDelta < -15) issues.push(`Scan-score sjönk med ${Math.abs(delta.scanScoreDelta)} poäng`);
  if (delta.errorsDelta > 3) issues.push(`${delta.errorsDelta} fler fel — systemet destabiliseras`);
  if (issues.length === 0 && verdict === 'degraded') issues.push('Systemet försämrades — granska senaste ändringar');
  return issues.join('. ') || undefined;
}

/** Capture a live snapshot of system health metrics */
export async function captureSnapshot(): Promise<FeedbackSnapshot> {
  const [bugsRes, workRes, scansRes] = await Promise.all([
    supabase.from('bug_reports').select('status, ai_severity').in('status', ['open', 'new', 'triaged']).limit(500),
    supabase.from('work_items' as any).select('status').in('status', ['open', 'claimed', 'in_progress', 'escalated']).limit(500),
    supabase.from('scan_results').select('overall_score').order('created_at', { ascending: false }).limit(5),
  ]);

  const bugs = bugsRes.data || [];
  const workItems = workRes.data || [];
  const scans = scansRes.data || [];

  return {
    openBugs: bugs.length,
    criticalBugs: bugs.filter((b: any) => b.ai_severity === 'critical').length,
    openWorkItems: workItems.length,
    avgScanScore: scans.length > 0
      ? Math.round(scans.reduce((s: number, x: any) => s + (x.overall_score || 0), 0) / scans.length)
      : 0,
    failedTasks: 0, // populated from queue state at call site
    regressedTasks: 0,
    totalErrors: 0,
    capturedAt: new Date().toISOString(),
  };
}

function computeDelta(before: FeedbackSnapshot, after: FeedbackSnapshot): FeedbackDelta {
  return {
    bugsDelta: after.openBugs - before.openBugs,
    criticalDelta: after.criticalBugs - before.criticalBugs,
    workItemsDelta: after.openWorkItems - before.openWorkItems,
    scanScoreDelta: after.avgScanScore - before.avgScanScore,
    errorsDelta: after.totalErrors - before.totalErrors,
    regressionsDelta: after.regressedTasks - before.regressedTasks,
  };
}

// ─── Store ───

interface FeedbackLoopState {
  entries: FeedbackEntry[];
  /** Snapshot captured before an action — call captureBeforeAction before scan/fix */
  pendingSnapshot: FeedbackSnapshot | null;

  /** Call before a scan, fix, or verification starts */
  captureBeforeAction: () => Promise<void>;

  /** Call after action completes — compares before/after and logs entry */
  evaluateAfterAction: (trigger: FeedbackEntry['trigger'], label: string, queueStats?: { failed: number; regressed: number; errors: number }) => Promise<FeedbackEntry | null>;

  /** Get the latest N entries */
  getRecent: (n?: number) => FeedbackEntry[];

  /** Overall trend: improved / stable / degraded */
  getTrend: () => FeedbackVerdict;

  clearEntries: () => void;
}

export const useFeedbackLoopStore = create<FeedbackLoopState>((set, get) => ({
  entries: [],
  pendingSnapshot: null,

  captureBeforeAction: async () => {
    const snap = await captureSnapshot();
    set({ pendingSnapshot: snap });
  },

  evaluateAfterAction: async (trigger, label, queueStats) => {
    const before = get().pendingSnapshot;
    if (!before) return null;

    const after = await captureSnapshot();
    // Enrich with queue stats if provided
    if (queueStats) {
      after.failedTasks = queueStats.failed;
      after.regressedTasks = queueStats.regressed;
      after.totalErrors = queueStats.errors;
    }

    const delta = computeDelta(before, after);
    const verdict = deriveVerdict(delta);
    const suggestion = buildSuggestion(verdict, delta);

    const entry: FeedbackEntry = {
      id: `fb-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      trigger,
      triggerLabel: label,
      before,
      after,
      verdict,
      delta,
      suggestion,
      createdAt: new Date().toISOString(),
    };

    set(s => ({
      entries: [entry, ...s.entries].slice(0, 200),
      pendingSnapshot: null,
    }));

    // If degraded, flag regression in the change log
    if (verdict === 'degraded' && suggestion) {
      try {
        await supabase.from('change_log').insert({
          change_type: 'regression',
          description: `Feedback Loop: ${suggestion}`,
          source: 'feedback_loop',
          affected_components: ['continuous_feedback'],
          metadata: { trigger, label, delta, verdict } as any,
        });
      } catch {}
    }

    return entry;
  },

  getRecent: (n = 20) => get().entries.slice(0, n),

  getTrend: () => {
    const recent = get().entries.slice(0, 10);
    if (recent.length === 0) return 'unknown';
    const improved = recent.filter(e => e.verdict === 'improved').length;
    const degraded = recent.filter(e => e.verdict === 'degraded').length;
    if (degraded >= 3) return 'degraded';
    if (improved >= 5) return 'improved';
    return 'stable';
  },

  clearEntries: () => set({ entries: [], pendingSnapshot: null }),
}));
