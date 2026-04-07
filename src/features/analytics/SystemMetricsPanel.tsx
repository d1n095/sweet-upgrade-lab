import React, { useEffect, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, Clock, TrendingDown, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

// ── Types ─────────────────────────────────────────────────────────────────────

interface MetricsData {
  healthScore: number | null;
  prevHealthScore: number | null;
  totalIssues: number;
  executedFixes: number;
  failedFixes: number;
  avgFixTimeMs: number | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function countIssues(unified_result: any): number {
  if (!unified_result || typeof unified_result !== 'object') return 0;
  const keys = ['broken_flows', 'fake_features', 'interaction_failures', 'data_issues', 'issues', 'detected_issues', 'master_list'];
  let total = 0;
  for (const key of keys) {
    const raw = unified_result[key];
    if (!raw) continue;
    total += Array.isArray(raw) ? raw.length : Array.isArray(raw?.issues) ? raw.issues.length : 0;
  }
  return total;
}

function healthColor(score: number | null): string {
  if (score == null) return 'text-muted-foreground';
  if (score >= 70) return 'text-green-600';
  if (score >= 40) return 'text-yellow-600';
  return 'text-destructive';
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60_000).toFixed(1)}m`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SystemMetricsPanel() {
  const [data, setData] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        // Fetch last 2 completed scans for trend
        const { data: scans } = await supabase
          .from('scan_runs')
          .select('id, system_health_score, unified_result, completed_at')
          .in('status', ['done', 'completed'])
          .order('created_at', { ascending: false })
          .limit(2);

        const latest = (scans?.[0] ?? null) as any;
        const prev = (scans?.[1] ?? null) as any;

        const healthScore = latest
          ? (latest.system_health_score ?? latest.unified_result?.system_health_score ?? null)
          : null;
        const prevHealthScore = prev
          ? (prev.system_health_score ?? prev.unified_result?.system_health_score ?? null)
          : null;
        const totalIssues = countIssues(latest?.unified_result);

        // Fetch fix execution stats from change_log (last 100)
        const { data: logs } = await supabase
          .from('change_log')
          .select('change_type, created_at, metadata')
          .in('change_type', ['fix_execution', 'fix_reverted'])
          .order('created_at', { ascending: false })
          .limit(100);

        const executions = (logs ?? []).filter((l: any) => l.change_type === 'fix_execution');
        const reverts = (logs ?? []).filter((l: any) => l.change_type === 'fix_reverted');

        // Approximate avg fix time: time between fix_execution and same work_item's revert (if any)
        // Simple fallback: we don't have start times, so avg fix time is omitted unless calculable.
        // Instead: we show time-since-last-fix
        let avgFixTimeMs: number | null = null;
        if (executions.length >= 2) {
          const timestamps = executions
            .map((e: any) => new Date(e.created_at).getTime())
            .filter(Boolean)
            .sort((a: number, b: number) => b - a);
          const deltas: number[] = [];
          for (let i = 0; i < timestamps.length - 1; i++) {
            deltas.push(timestamps[i] - timestamps[i + 1]);
          }
          avgFixTimeMs = deltas.length > 0 ? deltas.reduce((a, b) => a + b, 0) / deltas.length : null;
        }

        if (!cancelled) {
          setData({
            healthScore,
            prevHealthScore,
            totalIssues,
            executedFixes: executions.length,
            failedFixes: reverts.length,
            avgFixTimeMs,
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  const successRate =
    data && data.executedFixes > 0
      ? Math.round(((data.executedFixes - data.failedFixes) / data.executedFixes) * 100)
      : null;

  const scoreDelta =
    data?.healthScore != null && data?.prevHealthScore != null
      ? data.healthScore - data.prevHealthScore
      : null;

  const metrics = data
    ? [
        {
          label: 'Health Score',
          value: data.healthScore != null ? `${data.healthScore}` : '—',
          sub: scoreDelta != null
            ? scoreDelta > 0
              ? <span className="flex items-center gap-0.5 text-green-600"><TrendingUp className="w-3 h-3" />+{scoreDelta}</span>
              : scoreDelta < 0
              ? <span className="flex items-center gap-0.5 text-destructive"><TrendingDown className="w-3 h-3" />{scoreDelta}</span>
              : <span className="text-muted-foreground">—</span>
            : null,
          icon: <Activity className="w-4 h-4" />,
          valueClass: healthColor(data.healthScore),
        },
        {
          label: 'Open Issues',
          value: `${data.totalIssues}`,
          sub: <span className="text-muted-foreground">latest scan</span>,
          icon: <AlertTriangle className="w-4 h-4 text-orange-500" />,
          valueClass: data.totalIssues > 0 ? 'text-orange-600' : 'text-green-600',
        },
        {
          label: 'Success Rate',
          value: successRate != null ? `${successRate}%` : '—',
          sub: <span className="text-muted-foreground">{data.executedFixes} fixes logged</span>,
          icon: <CheckCircle2 className="w-4 h-4 text-green-500" />,
          valueClass: successRate != null && successRate >= 80 ? 'text-green-600' : 'text-yellow-600',
        },
        {
          label: 'Avg Fix Interval',
          value: data.avgFixTimeMs != null ? formatDuration(data.avgFixTimeMs) : '—',
          sub: <span className="text-muted-foreground">between fixes</span>,
          icon: <Clock className="w-4 h-4 text-blue-500" />,
          valueClass: 'text-foreground',
        },
      ]
    : [];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Activity className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-semibold">System Metrics</span>
        {loading && <span className="w-3 h-3 rounded-full border-2 border-muted-foreground border-t-transparent animate-spin" />}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-lg border border-border p-3 animate-pulse bg-muted/20 h-16" />
            ))
          : metrics.map((m) => (
              <div key={m.label} className="rounded-lg border border-border p-3 space-y-1 bg-card">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  {m.icon}
                  <span className="text-[10px] uppercase tracking-wide">{m.label}</span>
                </div>
                <div className={cn('text-xl font-bold tabular-nums leading-none', m.valueClass)}>
                  {m.value}
                </div>
                {m.sub && <div className="text-[10px] flex items-center gap-0.5">{m.sub}</div>}
              </div>
            ))}
      </div>
    </div>
  );
}
