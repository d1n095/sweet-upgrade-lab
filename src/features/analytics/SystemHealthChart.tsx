import React, { useEffect, useState } from 'react';
import { BarChart2 } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { supabase } from '@/integrations/supabase/client';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ChartPoint {
  label: string;
  score: number | null;
  issues: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function countIssues(unified_result: any): number {
  if (!unified_result || typeof unified_result !== 'object') return 0;
  const keys = ['broken_flows', 'fake_features', 'interaction_failures', 'data_issues', 'issues', 'detected_issues'];
  let total = 0;
  for (const key of keys) {
    const raw = unified_result[key];
    if (!raw) continue;
    total += Array.isArray(raw) ? raw.length : Array.isArray(raw?.issues) ? raw.issues.length : 0;
  }
  return total;
}

function formatLabel(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function scoreColor(score: number | null): string {
  if (score == null) return 'hsl(var(--muted-foreground))';
  if (score >= 70) return '#22c55e';
  if (score >= 40) return '#eab308';
  return '#ef4444';
}

// ── Custom Tooltip ────────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const score = payload.find((p: any) => p.dataKey === 'score')?.value;
  const issues = payload.find((p: any) => p.dataKey === 'issues')?.value;
  return (
    <div className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs shadow-xl space-y-0.5">
      <p className="font-medium text-muted-foreground">{label}</p>
      {score != null && <p className="text-foreground">Health: <span className="font-bold">{score}</span></p>}
      {issues != null && <p className="text-muted-foreground">Issues: {issues}</p>}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SystemHealthChart() {
  const [points, setPoints] = useState<ChartPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const { data } = await supabase
        .from('scan_runs')
        .select('created_at, system_health_score, unified_result')
        .in('status', ['done', 'completed'])
        .order('created_at', { ascending: true })
        .limit(10);

      if (!cancelled) {
        const pts: ChartPoint[] = (data ?? []).map((row: any) => ({
          label: row.created_at ? formatLabel(row.created_at) : '?',
          score: row.system_health_score ?? row.unified_result?.system_health_score ?? null,
          issues: countIssues(row.unified_result),
        }));
        setPoints(pts);
        setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  // Dynamic stroke color based on latest score
  const latestScore = points.length > 0 ? points[points.length - 1].score : null;
  const lineColor = scoreColor(latestScore);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <BarChart2 className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-semibold">System Health Over Time</span>
        {loading && <span className="w-3 h-3 rounded-full border-2 border-muted-foreground border-t-transparent animate-spin" />}
        {latestScore != null && !loading && (
          <span className="ml-auto text-xs font-bold tabular-nums" style={{ color: lineColor }}>
            Latest: {latestScore}
          </span>
        )}
      </div>

      {!loading && points.length === 0 ? (
        <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
          No completed scans found.
        </div>
      ) : (
        <div className="h-44 w-full">
          {loading ? (
            <div className="h-full w-full rounded-lg border border-border animate-pulse bg-muted/20" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={points} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                  tickCount={5}
                />
                <Tooltip content={<CustomTooltip />} />
                {/* Healthy threshold line */}
                <ReferenceLine y={70} stroke="#22c55e" strokeDasharray="4 3" strokeWidth={1} />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke={lineColor}
                  strokeWidth={2}
                  dot={{ r: 3, fill: lineColor, strokeWidth: 0 }}
                  activeDot={{ r: 4 }}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      {!loading && points.length > 0 && (
        <p className="text-[10px] text-muted-foreground">
          Last {points.length} completed scan{points.length !== 1 ? 's' : ''} · green line = 70 threshold
        </p>
      )}
    </div>
  );
}
