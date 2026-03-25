import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';

export type ConfidenceLevel = 'high' | 'medium' | 'low' | 'failed';

export interface FixConfidenceResult {
  taskId: string;
  taskTitle: string;
  confidence: ConfidenceLevel;
  score: number; // 0-100
  evaluatedAt: string;
  factors: ConfidenceFactor[];
  action?: 'none' | 'reopened' | 'marked_unstable';
  linkedBugId?: string;
  linkedWorkItemId?: string;
}

export interface ConfidenceFactor {
  name: string;
  weight: number; // 0-1
  score: number;  // 0-100
  detail: string;
}

function computeConfidence(factors: ConfidenceFactor[]): { score: number; level: ConfidenceLevel } {
  if (factors.length === 0) return { score: 0, level: 'failed' };
  const totalWeight = factors.reduce((s, f) => s + f.weight, 0);
  const weighted = factors.reduce((s, f) => s + f.score * f.weight, 0);
  const score = Math.round(weighted / Math.max(totalWeight, 0.01));
  const level: ConfidenceLevel =
    score >= 75 ? 'high' :
    score >= 50 ? 'medium' :
    score > 0 ? 'low' : 'failed';
  return { score, level };
}

/** Evaluate fix confidence based on validation checks, regressions, and pre/post state */
export function evaluateFixConfidence(params: {
  taskId: string;
  taskTitle: string;
  validationPassed: boolean;
  checksTotal: number;
  checksPassed: number;
  regressionsDetected: number;
  preSnapshot?: Record<string, any>;
  postSnapshot?: Record<string, any>;
  expectChangedKeys?: string[];
  guardKeys?: string[];
  executionTimeMs?: number;
  resultHasData?: boolean;
}): FixConfidenceResult {
  const factors: ConfidenceFactor[] = [];

  // Factor 1: Validation pass rate (weight 0.35)
  const passRate = params.checksTotal > 0 ? (params.checksPassed / params.checksTotal) * 100 : 0;
  factors.push({
    name: 'Validering',
    weight: 0.35,
    score: params.validationPassed ? passRate : 0,
    detail: params.validationPassed
      ? `${params.checksPassed}/${params.checksTotal} kontroller godkända`
      : `Validering misslyckades (${params.checksPassed}/${params.checksTotal})`,
  });

  // Factor 2: No regressions (weight 0.30)
  const regScore = params.regressionsDetected === 0 ? 100 : Math.max(0, 100 - params.regressionsDetected * 40);
  factors.push({
    name: 'Regressionsfri',
    weight: 0.30,
    score: regScore,
    detail: params.regressionsDetected === 0
      ? 'Inga regressioner'
      : `${params.regressionsDetected} regression(er) upptäckta`,
  });

  // Factor 3: System improvement — did expected keys change? (weight 0.20)
  let improvementScore = 50; // neutral if no snapshots
  if (params.preSnapshot && params.postSnapshot && params.expectChangedKeys?.length) {
    let changed = 0;
    for (const key of params.expectChangedKeys) {
      const pre = params.preSnapshot[key];
      const post = params.postSnapshot[key];
      try {
        if (JSON.stringify(pre) !== JSON.stringify(post)) changed++;
      } catch { if (pre !== post) changed++; }
    }
    improvementScore = Math.round((changed / params.expectChangedKeys.length) * 100);
  }
  factors.push({
    name: 'Systemförbättring',
    weight: 0.20,
    score: improvementScore,
    detail: improvementScore >= 75
      ? 'Förväntade förändringar bekräftade'
      : improvementScore >= 25
        ? 'Delvis förbättring observerad'
        : 'Ingen mätbar förbättring',
  });

  // Factor 4: Result quality (weight 0.15)
  const resultScore = params.resultHasData !== false ? 80 : 20;
  factors.push({
    name: 'Resultatkvalitet',
    weight: 0.15,
    score: resultScore,
    detail: resultScore >= 50 ? 'Resultat returnerades korrekt' : 'Tomt eller felaktigt resultat',
  });

  const { score, level } = computeConfidence(factors);

  return {
    taskId: params.taskId,
    taskTitle: params.taskTitle,
    confidence: level,
    score,
    evaluatedAt: new Date().toISOString(),
    factors,
  };
}

/** Persist low/failed confidence as action — reopen bug or mark unstable */
export async function applyConfidenceAction(
  result: FixConfidenceResult,
  sourceType?: string,
  sourceId?: string,
): Promise<FixConfidenceResult> {
  if (result.confidence === 'high' || result.confidence === 'medium') {
    return { ...result, action: 'none' };
  }

  // Low or failed → reopen linked bug or mark work item unstable
  if (sourceType === 'bug_report' && sourceId) {
    await supabase.from('bug_reports').update({
      status: 'open',
      resolution_notes: `Auto-återöppnad: fix confidence ${result.confidence} (${result.score}/100)`,
    }).eq('id', sourceId);
    result = { ...result, action: 'reopened', linkedBugId: sourceId };
  }

  // Mark the work item (if it exists) with low confidence metadata
  if (sourceId) {
    await (supabase.from('work_items' as any) as any).update({
      ai_review_status: result.confidence === 'failed' ? 'failed' : 'needs_review',
      ai_review_notes: `Fix confidence: ${result.confidence} (${result.score}/100) — ${result.factors.filter(f => f.score < 50).map(f => f.name).join(', ')}`,
    }).eq('source_id', sourceId);
    result = { ...result, action: result.action || 'marked_unstable', linkedWorkItemId: sourceId };
  }

  return result;
}

// ─── Store ───

interface FixConfidenceState {
  results: FixConfidenceResult[];
  addResult: (r: FixConfidenceResult) => void;
  getByTask: (taskId: string) => FixConfidenceResult | undefined;
  getAverage: () => number;
  clearResults: () => void;
}

export const useFixConfidenceStore = create<FixConfidenceState>((set, get) => ({
  results: [],

  addResult: (r) => set(s => ({
    results: [r, ...s.results].slice(0, 100), // keep last 100
  })),

  getByTask: (taskId) => get().results.find(r => r.taskId === taskId),

  getAverage: () => {
    const r = get().results;
    if (r.length === 0) return 0;
    return Math.round(r.reduce((s, x) => s + x.score, 0) / r.length);
  },

  clearResults: () => set({ results: [] }),
}));
