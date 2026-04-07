import React, { useEffect, useState } from 'react';
import { Layers, TrendingDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AreaStat {
  area: string;
  count: number;
  pct: number;
}

interface InsightData {
  areas: AreaStat[];
  total: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const AREA_LABELS: Record<string, string> = {
  broken_flows: 'Broken Flows',
  fake_features: 'Fake Features',
  interaction_failures: 'Interaction Failures',
  data_issues: 'Data Issues',
  issues: 'General Issues',
  detected_issues: 'Detected Issues',
  master_list: 'Master List',
};

const AREA_COLORS: Record<string, string> = {
  broken_flows: 'bg-destructive',
  fake_features: 'bg-orange-500',
  interaction_failures: 'bg-yellow-500',
  data_issues: 'bg-blue-500',
  issues: 'bg-purple-500',
  detected_issues: 'bg-teal-500',
  master_list: 'bg-slate-500',
};

const CATEGORY_KEYS = [
  'broken_flows', 'fake_features', 'interaction_failures',
  'data_issues', 'issues', 'detected_issues', 'master_list',
];

function parseAreaStats(unified_result: Record<string, unknown> | null): InsightData {
  if (!unified_result) return { areas: [], total: 0 };

  const counts: Record<string, number> = {};
  let total = 0;

  for (const key of CATEGORY_KEYS) {
    const raw = unified_result[key];
    if (!raw) continue;
    const arr: unknown[] = Array.isArray(raw)
      ? raw
      : Array.isArray((raw as Record<string, unknown>)?.issues)
        ? ((raw as Record<string, unknown>).issues as unknown[])
        : [];
    if (arr.length > 0) {
      counts[key] = arr.length;
      total += arr.length;
    }
  }

  const areas: AreaStat[] = Object.entries(counts)
    .map(([area, count]) => ({
      area,
      count,
      pct: total > 0 ? Math.round((count / total) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return { areas, total };
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SystemInsightPanel() {
  const [insight, setInsight] = useState<InsightData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const { data } = await supabase
        .from('scan_runs')
        .select('unified_result')
        .in('status', ['done', 'completed'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (!cancelled) {
        const unified = (data as { unified_result: Record<string, unknown> | null } | null)
          ?.unified_result ?? null;
        setInsight(parseAreaStats(unified));
        setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Layers className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-semibold">System Insight</span>
        {loading && (
          <span className="w-3 h-3 rounded-full border-2 border-muted-foreground border-t-transparent animate-spin ml-1" />
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-8 rounded border border-border animate-pulse bg-muted/20" />
          ))}
        </div>
      ) : !insight || insight.total === 0 ? (
        <p className="text-[11px] text-muted-foreground italic">No issue data available from the latest scan.</p>
      ) : (
        <div className="space-y-2">
          <p className="text-[11px] text-muted-foreground leading-snug">
            Latest scan detected <span className="font-semibold text-foreground">{insight.total} issues</span> across{' '}
            {insight.areas.length} area{insight.areas.length !== 1 ? 's' : ''}.
            The most affected area is{' '}
            <span className="font-semibold text-foreground">{AREA_LABELS[insight.areas[0]?.area] ?? insight.areas[0]?.area}</span>{' '}
            ({insight.areas[0]?.pct}% of all issues). Address the top area first to achieve the greatest improvement.
          </p>

          <div className="space-y-1.5">
            {insight.areas.map((a) => (
              <div key={a.area} className="space-y-0.5">
                <div className="flex items-center justify-between text-[10px]">
                  <div className="flex items-center gap-1">
                    {a.area === insight.areas[0].area && (
                      <TrendingDown className="w-3 h-3 text-destructive shrink-0" />
                    )}
                    <span className="text-foreground font-medium truncate max-w-[160px]">
                      {AREA_LABELS[a.area] ?? a.area}
                    </span>
                  </div>
                  <span className="text-muted-foreground font-mono shrink-0 ml-2">
                    {a.count} ({a.pct}%)
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full ${AREA_COLORS[a.area] ?? 'bg-primary'} transition-all duration-500`}
                    style={{ width: `${a.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
