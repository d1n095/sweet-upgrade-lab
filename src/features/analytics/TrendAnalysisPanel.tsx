import React, { useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

// ── Types ─────────────────────────────────────────────────────────────────────

interface IssueSummary {
  key: string;      // normalized title
  count: number;    // number of scans it appears in
  severity: string;
  category: string;
  trend: 'rising' | 'stable' | 'falling';
}

interface TrendData {
  recurring: IssueSummary[];   // appears in 3+ scans
  unresolved: IssueSummary[];  // in latest scan AND older ones
  rising: IssueSummary[];      // count has grown scan-over-scan
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const CATEGORY_KEYS = [
  'broken_flows', 'fake_features', 'interaction_failures',
  'data_issues', 'issues', 'detected_issues', 'master_list',
];

function normalizeSeverity(v: string | undefined): string {
  const s = (v ?? '').toLowerCase();
  if (s === 'critical') return 'critical';
  if (s === 'high' || s === 'error') return 'high';
  if (s === 'medium' || s === 'warning') return 'medium';
  if (s === 'low') return 'low';
  return 'info';
}

function extractIssueTitles(unified_result: any): Array<{ title: string; severity: string; category: string }> {
  if (!unified_result || typeof unified_result !== 'object') return [];
  const out: Array<{ title: string; severity: string; category: string }> = [];
  for (const key of CATEGORY_KEYS) {
    const raw = unified_result[key];
    if (!raw) continue;
    const arr: any[] = Array.isArray(raw) ? raw : Array.isArray(raw?.issues) ? raw.issues : [];
    for (const item of arr) {
      if (!item || typeof item !== 'object') continue;
      const title = item.title || item.name || item.issue || '(untitled)';
      out.push({
        title: title.trim().toLowerCase(),
        severity: normalizeSeverity(item.severity || item.impact),
        category: key,
      });
    }
  }
  return out;
}

function analyzeTrends(scans: any[]): TrendData {
  // Each scan → { title → {severity, category} }
  const perScan: Array<Map<string, { severity: string; category: string }>> = scans.map((s) => {
    const map = new Map<string, { severity: string; category: string }>();
    for (const item of extractIssueTitles(s.unified_result)) {
      map.set(item.title, { severity: item.severity, category: item.category });
    }
    return map;
  });

  // Count appearances across scans
  const appearances = new Map<string, { count: number; meta: { severity: string; category: string } }>();
  for (const scanMap of perScan) {
    for (const [title, meta] of scanMap) {
      const existing = appearances.get(title);
      if (existing) {
        existing.count++;
      } else {
        appearances.set(title, { count: 1, meta });
      }
    }
  }

  // Recurring: in 3+ scans
  const recurring: IssueSummary[] = [];
  for (const [title, { count, meta }] of appearances) {
    if (count >= 3) {
      recurring.push({ key: title, count, severity: meta.severity, category: meta.category, trend: 'stable' });
    }
  }
  recurring.sort((a, b) => b.count - a.count || a.severity.localeCompare(b.severity));

  // Unresolved: present in latest AND at least one older scan
  const latestMap = perScan[perScan.length - 1] ?? new Map();
  const unresolved: IssueSummary[] = [];
  for (const [title, meta] of latestMap) {
    const info = appearances.get(title);
    if (info && info.count > 1) {
      unresolved.push({ key: title, count: info.count, severity: meta.severity, category: meta.category, trend: 'stable' });
    }
  }
  unresolved.sort((a, b) => b.count - a.count);

  // Rising: count in last 3 scans > count in first 3 scans
  const rising: IssueSummary[] = [];
  if (scans.length >= 4) {
    const firstHalf = perScan.slice(0, Math.floor(perScan.length / 2));
    const secondHalf = perScan.slice(Math.floor(perScan.length / 2));
    for (const [title, { meta }] of appearances) {
      const countOld = firstHalf.filter((m) => m.has(title)).length;
      const countNew = secondHalf.filter((m) => m.has(title)).length;
      if (countNew > countOld) {
        rising.push({ key: title, count: countNew, severity: meta.severity, category: meta.category, trend: 'rising' });
      }
    }
    rising.sort((a, b) => b.count - a.count);
  }

  return { recurring, unresolved, rising };
}

// ── Sub-list ──────────────────────────────────────────────────────────────────

const SEV_STYLE: Record<string, string> = {
  critical: 'bg-destructive/10 text-destructive border-destructive/20',
  high: 'bg-orange-500/10 text-orange-600 border-orange-400/20',
  medium: 'bg-yellow-500/10 text-yellow-700 border-yellow-400/20',
  low: 'bg-blue-500/10 text-blue-600 border-blue-400/20',
  info: 'bg-muted text-muted-foreground border-border',
};

function IssueRow({ item }: { item: IssueSummary }) {
  return (
    <div className="flex items-center gap-1.5 py-1 border-b border-border/40 last:border-0 text-xs">
      <Badge variant="outline" className={cn('text-[9px] shrink-0 px-1 py-0', SEV_STYLE[item.severity] ?? SEV_STYLE.info)}>
        {item.severity}
      </Badge>
      <span className="flex-1 truncate text-foreground">{item.key}</span>
      <span className="shrink-0 text-[10px] text-muted-foreground font-mono">{item.count}×</span>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function TrendAnalysisPanel() {
  const [trends, setTrends] = useState<TrendData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const { data } = await supabase
        .from('scan_runs')
        .select('id, created_at, unified_result')
        .in('status', ['done', 'completed'])
        .order('created_at', { ascending: true })
        .limit(10);

      if (!cancelled) {
        const result = analyzeTrends(data ?? []);
        setTrends(result);
        setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  const sections: Array<{
    id: string;
    label: string;
    icon: React.ReactNode;
    items: IssueSummary[];
    emptyText: string;
  }> = [
    {
      id: 'recurring',
      label: 'Recurring (3+ scans)',
      icon: <RefreshCw className="w-3.5 h-3.5 text-orange-500" />,
      items: trends?.recurring ?? [],
      emptyText: 'No recurring issues detected.',
    },
    {
      id: 'unresolved',
      label: 'Unresolved (still in latest)',
      icon: <AlertTriangle className="w-3.5 h-3.5 text-destructive" />,
      items: trends?.unresolved ?? [],
      emptyText: 'No unresolved cross-scan issues.',
    },
    {
      id: 'rising',
      label: 'Rising Pattern',
      icon: <TrendingUp className="w-3.5 h-3.5 text-yellow-600" />,
      items: trends?.rising ?? [],
      emptyText: 'No rising issue patterns.',
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-semibold">Trend Analysis</span>
        {loading && <span className="w-3 h-3 rounded-full border-2 border-muted-foreground border-t-transparent animate-spin" />}
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 rounded-lg border border-border animate-pulse bg-muted/20" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {sections.map((s) => (
            <div key={s.id} className="rounded-lg border border-border p-3 space-y-2 bg-card">
              <div className="flex items-center gap-1.5">
                {s.icon}
                <span className="text-xs font-medium">{s.label}</span>
                <Badge variant="outline" className="text-[9px] ml-auto">
                  {s.items.length}
                </Badge>
              </div>
              {s.items.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">{s.emptyText}</p>
              ) : (
                <div className="max-h-36 overflow-y-auto">
                  {s.items.slice(0, 10).map((item) => (
                    <IssueRow key={item.key} item={item} />
                  ))}
                  {s.items.length > 10 && (
                    <p className="text-[10px] text-muted-foreground pt-1">
                      +{s.items.length - 10} more
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
