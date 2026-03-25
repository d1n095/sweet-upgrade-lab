import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Shield, Activity, CheckCircle, XCircle, AlertTriangle,
  TrendingUp, Loader2, RefreshCw, Bug, GitMerge, Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAiQueueStore } from '@/stores/aiQueueStore';

type TrustLabel = 'unstable' | 'improving' | 'stable' | 'production_ready';

interface TrustBreakdown {
  workingFeatures: number;
  failedActions: number;
  verifiedFixes: number;
  regressionRate: number;
  score: number;
  label: TrustLabel;
}

const labelConfig: Record<TrustLabel, { text: string; color: string; icon: React.ElementType }> = {
  unstable: { text: 'Instabilt', color: 'text-destructive', icon: XCircle },
  improving: { text: 'Förbättras', color: 'text-orange-500', icon: TrendingUp },
  stable: { text: 'Stabilt', color: 'text-blue-500', icon: Shield },
  production_ready: { text: 'Produktionsredo', color: 'text-green-500', icon: CheckCircle },
};

function getLabel(score: number): TrustLabel {
  if (score < 40) return 'unstable';
  if (score < 65) return 'improving';
  if (score < 85) return 'stable';
  return 'production_ready';
}

const SystemTrustScore = () => {
  const queueStore = useAiQueueStore();

  const { data: breakdown, isLoading, refetch } = useQuery({
    queryKey: ['system-trust-score'],
    queryFn: async (): Promise<TrustBreakdown> => {
      // Parallel DB queries
      const [workItemsRes, bugsRes, scansRes, changeLogRes] = await Promise.all([
        supabase.from('work_items' as any).select('status, ai_review_status, priority').limit(500),
        supabase.from('bug_reports').select('status, ai_severity').limit(500),
        supabase.from('ai_scan_results').select('overall_score, issues_count, tasks_created').order('created_at', { ascending: false }).limit(20),
        supabase.from('change_log').select('change_type, source').order('created_at', { ascending: false }).limit(200),
      ]);

      const workItems = (workItemsRes.data || []) as any[];
      const bugs = bugsRes.data || [];
      const scans = scansRes.data || [];
      const changes = changeLogRes.data || [];

      // ─── 1. Working Features (% of work items done / verified) ───
      const totalItems = workItems.length || 1;
      const doneItems = workItems.filter((w: any) => w.status === 'done').length;
      const verifiedItems = workItems.filter((w: any) => w.ai_review_status === 'verified').length;
      const workingPct = Math.round(((doneItems + verifiedItems * 0.5) / totalItems) * 100);

      // ─── 2. Failed Actions (% of bugs open or critical) ───
      const totalBugs = bugs.length || 1;
      const openBugs = bugs.filter(b => b.status === 'open' || b.status === 'new').length;
      const criticalBugs = bugs.filter(b => b.ai_severity === 'critical' || b.ai_severity === 'high').length;
      const failedPct = Math.round(((openBugs + criticalBugs * 0.5) / totalBugs) * 100);

      // ─── 3. Verified Fixes (% of done items with AI verification) ───
      const fixItems = workItems.filter((w: any) => w.status === 'done');
      const verifiedFixes = fixItems.filter((w: any) => w.ai_review_status === 'verified').length;
      const verifiedPct = fixItems.length > 0 ? Math.round((verifiedFixes / fixItems.length) * 100) : 100;

      // ─── 4. Regression Rate (from queue store + work items) ───
      const queueRegressions = queueStore.regressionLog.length;
      const regressedItems = workItems.filter((w: any) => w.status === 'regressed' || w.status === 'reopened').length;
      const totalCompleted = doneItems + regressedItems || 1;
      const regressionPct = Math.round(((regressedItems + queueRegressions) / totalCompleted) * 100);

      // ─── 5. Scan health bonus ───
      const avgScanScore = scans.length > 0
        ? scans.reduce((sum, s) => sum + (s.overall_score || 0), 0) / scans.length
        : 50;

      // ─── COMPOSITE SCORE ───
      const score = Math.max(0, Math.min(100, Math.round(
        (Math.min(workingPct, 100) * 0.30) +
        ((100 - Math.min(failedPct, 100)) * 0.25) +
        (Math.min(verifiedPct, 100) * 0.20) +
        ((100 - Math.min(regressionPct, 100)) * 0.15) +
        (Math.min(avgScanScore, 100) * 0.10)
      )));

      return {
        workingFeatures: Math.min(workingPct, 100),
        failedActions: Math.min(failedPct, 100),
        verifiedFixes: Math.min(verifiedPct, 100),
        regressionRate: Math.min(regressionPct, 100),
        score,
        label: getLabel(score),
      };
    },
    refetchInterval: 60000,
  });

  const score = breakdown?.score ?? 0;
  const label = breakdown?.label ?? 'unstable';
  const cfg = labelConfig[label];
  const LabelIcon = cfg.icon;

  const metrics = breakdown ? [
    { label: 'Fungerande features', value: breakdown.workingFeatures, icon: CheckCircle, good: true },
    { label: 'Misslyckade åtgärder', value: breakdown.failedActions, icon: XCircle, good: false },
    { label: 'Verifierade fixar', value: breakdown.verifiedFixes, icon: GitMerge, good: true },
    { label: 'Regressionsgrad', value: breakdown.regressionRate, icon: Bug, good: false },
  ] : [];

  // Score ring SVG
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const strokeColor =
    score >= 85 ? 'hsl(var(--chart-2))' :
    score >= 65 ? 'hsl(var(--chart-1))' :
    score >= 40 ? 'hsl(var(--chart-4))' :
    'hsl(var(--destructive))';

  return (
    <div className="space-y-4">
      {/* Hero score */}
      <Card>
        <CardContent className="py-6 flex flex-col sm:flex-row items-center gap-6">
          {/* Ring */}
          <div className="relative w-36 h-36 shrink-0">
            <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
              <circle cx="60" cy="60" r={radius} fill="none"
                stroke="hsl(var(--muted))" strokeWidth="8" />
              <circle cx="60" cy="60" r={radius} fill="none"
                stroke={strokeColor} strokeWidth="8"
                strokeDasharray={circumference} strokeDashoffset={isLoading ? circumference : offset}
                strokeLinecap="round"
                className="transition-all duration-1000 ease-out" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              {isLoading ? (
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              ) : (
                <>
                  <span className="text-3xl font-bold">{score}</span>
                  <span className="text-[10px] text-muted-foreground">/ 100</span>
                </>
              )}
            </div>
          </div>

          {/* Label + actions */}
          <div className="flex-1 text-center sm:text-left space-y-2">
            <div className="flex items-center gap-2 justify-center sm:justify-start">
              <LabelIcon className={cn('w-5 h-5', cfg.color)} />
              <span className={cn('text-lg font-semibold', cfg.color)}>{cfg.text}</span>
            </div>
            <p className="text-sm text-muted-foreground max-w-sm">
              {label === 'production_ready' && 'Systemet är stabilt med hög verifieringsgrad och låg regression.'}
              {label === 'stable' && 'Systemet fungerar bra men har utrymme för förbättring.'}
              {label === 'improving' && 'Systemet förbättras men har fortfarande öppna problem.'}
              {label === 'unstable' && 'Systemet har kritiska problem som kräver omedelbar uppmärksamhet.'}
            </p>
            <Button size="sm" variant="outline" onClick={() => refetch()} className="gap-1.5 text-xs">
              <RefreshCw className="w-3.5 h-3.5" /> Uppdatera
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Metric bars */}
      {!isLoading && breakdown && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {metrics.map(m => (
            <Card key={m.label}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <m.icon className={cn('w-4 h-4', m.good
                      ? (m.value >= 70 ? 'text-green-500' : m.value >= 40 ? 'text-orange-500' : 'text-destructive')
                      : (m.value <= 10 ? 'text-green-500' : m.value <= 30 ? 'text-orange-500' : 'text-destructive')
                    )} />
                    {m.label}
                  </div>
                  <span className="text-sm font-bold">{m.value}%</span>
                </div>
                <Progress value={m.good ? m.value : 100 - m.value} className="h-2" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default SystemTrustScore;
