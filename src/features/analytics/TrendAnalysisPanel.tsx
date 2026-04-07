import React, { useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw, TrendingUp, Zap, ArrowUpCircle, Loader2, Bot } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { executeIssue, type ActionIssue } from '@/features/actions/SystemActionPanel';
import { toast } from 'sonner';

// ── Types ─────────────────────────────────────────────────────────────────────

interface IssueSummary {
  key: string;      // normalized title
  count: number;    // number of scans it appears in
  severity: string;
  category: string;
  trend: 'rising' | 'stable' | 'falling';
  confidence: number; // 0–100: pct of scans where this was detected
}

interface TrendData {
  recurring: IssueSummary[];   // appears in 3+ scans
  unresolved: IssueSummary[];  // in latest scan AND older ones
  rising: IssueSummary[];      // count has grown scan-over-scan
  totalScans: number;
}

interface ScanRow {
  id: string;
  created_at: string;
  unified_result: Record<string, unknown> | null;
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

function severityBonus(sev: string): number {
  if (sev === 'critical') return 10;
  if (sev === 'high') return 7;
  if (sev === 'medium') return 4;
  if (sev === 'low') return 2;
  return 0;
}

function recencyBonus(
  perScan: Array<Map<string, { severity: string; category: string }>>,
  title: string,
): number {
  const n = perScan.length;
  if (n === 0) return 0;
  if (perScan[n - 1]?.has(title)) return 20;
  if (n >= 2 && perScan[n - 2]?.has(title)) return 10;
  if (n >= 3 && perScan[n - 3]?.has(title)) return 5;
  return 0;
}

function calcConfidence(
  count: number,
  totalScans: number,
  severity: string,
  perScan: Array<Map<string, { severity: string; category: string }>>,
  title: string,
): number {
  const freq = totalScans > 0 ? (count / totalScans) * 70 : 0;
  const recency = recencyBonus(perScan, title);
  const sev = severityBonus(severity);
  return Math.min(100, Math.round(freq + recency + sev));
}

function analyzeTrends(scans: ScanRow[]): TrendData {
  const totalScans = scans.length;

  const perScan: Array<Map<string, { severity: string; category: string }>> = scans.map((s) => {
    const map = new Map<string, { severity: string; category: string }>();
    for (const item of extractIssueTitles(s.unified_result)) {
      map.set(item.title, { severity: item.severity, category: item.category });
    }
    return map;
  });

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

  const confidence = (count: number, severity: string, title: string) =>
    calcConfidence(count, totalScans, severity, perScan, title);

  // Recurring: in 3+ scans
  const recurring: IssueSummary[] = [];
  for (const [title, { count, meta }] of appearances) {
    if (count >= 3) {
      recurring.push({ key: title, count, severity: meta.severity, category: meta.category, trend: 'stable', confidence: confidence(count, meta.severity, title) });
    }
  }
  recurring.sort((a, b) => b.confidence - a.confidence || b.count - a.count);

  // Unresolved: present in latest AND at least one older scan
  const latestMap = perScan[perScan.length - 1] ?? new Map();
  const unresolved: IssueSummary[] = [];
  for (const [title, meta] of latestMap) {
    const info = appearances.get(title);
    if (info && info.count > 1) {
      unresolved.push({ key: title, count: info.count, severity: meta.severity, category: meta.category, trend: 'stable', confidence: confidence(info.count, meta.severity, title) });
    }
  }
  unresolved.sort((a, b) => b.confidence - a.confidence);

  // Rising: count in second half > first half
  const rising: IssueSummary[] = [];
  if (scans.length >= 4) {
    const firstHalf = perScan.slice(0, Math.floor(perScan.length / 2));
    const secondHalf = perScan.slice(Math.floor(perScan.length / 2));
    for (const [title, { meta }] of appearances) {
      const countOld = firstHalf.filter((m) => m.has(title)).length;
      const countNew = secondHalf.filter((m) => m.has(title)).length;
      if (countNew > countOld) {
        const c = countNew + countOld;
        rising.push({ key: title, count: countNew, severity: meta.severity, category: meta.category, trend: 'rising', confidence: confidence(c, meta.severity, title) });
      }
    }
    rising.sort((a, b) => b.confidence - a.confidence);
  }

  return { recurring, unresolved, rising, totalScans };
}

function toActionIssue(item: IssueSummary): ActionIssue {
  return {
    _key: item.key,
    _category: item.category,
    id: '',
    title: item.key,
    description: `Trend-detected issue (${item.category}). Confidence: ${item.confidence}%. Detected in ${item.count} scans.`,
    severity: (item.severity as ActionIssue['severity']) ?? 'info',
    impact_score: item.confidence,
  };
}

// ── UI Helpers ────────────────────────────────────────────────────────────────

const SEV_STYLE: Record<string, string> = {
  critical: 'bg-destructive/10 text-destructive border-destructive/20',
  high: 'bg-orange-500/10 text-orange-600 border-orange-400/20',
  medium: 'bg-yellow-500/10 text-yellow-700 border-yellow-400/20',
  low: 'bg-blue-500/10 text-blue-600 border-blue-400/20',
  info: 'bg-muted text-muted-foreground border-border',
};

function ConfidencePill({ value }: { value: number }) {
  const color = value >= 80 ? 'text-destructive' : value >= 50 ? 'text-yellow-600' : 'text-muted-foreground';
  return (
    <span className={cn('text-[9px] font-mono shrink-0', color)} title="Confidence: frequency (70%) + recency (20%) + severity (10%)">
      {value}%
    </span>
  );
}

function IssueRow({
  item,
  actionLabel,
  onAction,
  acting,
  wasAutoExecuted,
}: {
  item: IssueSummary;
  actionLabel?: string;
  onAction?: () => void;
  acting?: boolean;
  wasAutoExecuted?: boolean;
}) {
  return (
    <div className={cn(
      'flex items-center gap-1.5 py-1 border-b border-border/40 last:border-0 text-xs group',
      wasAutoExecuted && 'bg-green-500/5',
    )}>
      <Badge variant="outline" className={cn('text-[9px] shrink-0 px-1 py-0', SEV_STYLE[item.severity] ?? SEV_STYLE.info)}>
        {item.severity}
      </Badge>
      <span className={cn('flex-1 truncate', wasAutoExecuted ? 'text-green-700' : 'text-foreground')}>{item.key}</span>
      {wasAutoExecuted && <span className="text-[9px] text-green-600 shrink-0">✓ auto</span>}
      <ConfidencePill value={item.confidence} />
      <span className="shrink-0 text-[10px] text-muted-foreground font-mono">{item.count}×</span>
      {!wasAutoExecuted && actionLabel && onAction && (
        <Button
          size="icon"
          variant="ghost"
          className="h-5 w-5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={onAction}
          disabled={acting}
          title={actionLabel}
        >
          {acting ? <Loader2 className="w-3 h-3 animate-spin" /> : <ArrowUpCircle className="w-3 h-3 text-primary" />}
        </Button>
      )}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function TrendAnalysisPanel() {
  const [trends, setTrends] = useState<TrendData | null>(null);
  const [loading, setLoading] = useState(true);
  const [latestRunId, setLatestRunId] = useState<string | undefined>(undefined);
  const [batchRunning, setBatchRunning] = useState(false);
  const [actingKeys, setActingKeys] = useState<Set<string>>(new Set());
  const [autoMode, setAutoMode] = useState(false);
  const [autoExecuted, setAutoExecuted] = useState<string[]>([]);
  const autoExecutingRef = React.useRef(false);

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
        const rows = (data ?? []) as ScanRow[];
        const result = analyzeTrends(rows);
        setTrends(result);
        // latest run = last element (ascending order)
        const last = rows[rows.length - 1];
        setLatestRunId(last?.id ?? undefined);
        setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  // ── Auto Mode: execute critical issues with confidence > 85 ───────────────────

  useEffect(() => {
    if (!autoMode || !trends || loading) return;
    // Guard against concurrent executions (e.g. rapid toggle or trends update during run)
    if (autoExecutingRef.current) return;

    const candidates = [
      ...trends.recurring,
      ...trends.unresolved,
    ].filter(
      (item) => item.confidence > 85 && item.severity === 'critical',
    );

    if (candidates.length === 0) {
      toast.info('Auto Mode: no critical issues with confidence > 85% found');
      return;
    }

    autoExecutingRef.current = true;
    let active = true;
    (async () => {
      const executed: string[] = [];
      for (const item of candidates) {
        if (!active) break;
        try {
          await executeIssue(toActionIssue(item), latestRunId);
          executed.push(item.key);
        } catch {
          // non-fatal — continue batch
        }
      }
      autoExecutingRef.current = false;
      if (active) {
        setAutoExecuted(executed);
        toast.success(`Auto Mode: ${executed.length} critical issue${executed.length !== 1 ? 's' : ''} auto-executed`);
      }
    })();

    return () => { active = false; autoExecutingRef.current = false; };
  }, [autoMode, trends, latestRunId, loading]);

  // ── Action handlers ──────────────────────────────────────────────────────────

  async function handlePrioritize(item: IssueSummary) {
    setActingKeys((prev) => new Set([...prev, item.key]));
    try {
      await executeIssue(toActionIssue(item), latestRunId);
      toast.success(`Prioritized: ${item.key}`);
    } catch {
      toast.error('Action failed');
    } finally {
      setActingKeys((prev) => { const s = new Set(prev); s.delete(item.key); return s; });
    }
  }

  async function handleFixAllRecurring() {
    if (!trends?.recurring.length) return;
    setBatchRunning(true);
    let done = 0;
    for (const item of trends.recurring) {
      try {
        await executeIssue(toActionIssue(item), latestRunId);
        done++;
      } catch {
        // continue batch even on individual failure
      }
    }
    setBatchRunning(false);
    toast.success(`Batch complete: ${done}/${trends.recurring.length} recurring issues processed`);
  }

  // ── Section definitions ──────────────────────────────────────────────────────

  const sections: Array<{
    id: string;
    label: string;
    icon: React.ReactNode;
    items: IssueSummary[];
    emptyText: string;
    insightText: string;
    sectionAction?: { label: string; onClick: () => void; loading: boolean };
    rowActionLabel?: string;
    onRowAction?: (item: IssueSummary) => void;
  }> = [
    {
      id: 'recurring',
      label: 'Recurring (3+ scans)',
      icon: <RefreshCw className="w-3.5 h-3.5 text-orange-500" />,
      items: trends?.recurring ?? [],
      emptyText: 'No recurring issues detected.',
      insightText: 'These issues persist across multiple scans, indicating a root cause that has not been addressed. High confidence = strong signal. Fix the root cause rather than the symptom.',
      sectionAction: {
        label: `Fix all recurring (${trends?.recurring.length ?? 0})`,
        onClick: handleFixAllRecurring,
        loading: batchRunning,
      },
    },
    {
      id: 'unresolved',
      label: 'Unresolved (still in latest)',
      icon: <AlertTriangle className="w-3.5 h-3.5 text-destructive" />,
      items: trends?.unresolved ?? [],
      emptyText: 'No unresolved cross-scan issues.',
      insightText: 'Present in the latest scan and in prior scans. Previously detected but not yet fixed. Prioritize these to stop score degradation.',
      rowActionLabel: 'Prioritize issue',
      onRowAction: handlePrioritize,
    },
    {
      id: 'rising',
      label: 'Rising Pattern',
      icon: <TrendingUp className="w-3.5 h-3.5 text-yellow-600" />,
      items: trends?.rising ?? [],
      emptyText: 'No rising issue patterns.',
      insightText: 'Detected more frequently in recent scans than in earlier ones. Indicates active deterioration. Investigate recent changes near the affected components.',
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-semibold">Trend Analysis</span>
        {trends && (
          <span className="text-[10px] text-muted-foreground ml-1">
            ({trends.totalScans} scans analyzed)
          </span>
        )}
        {loading && <span className="w-3 h-3 rounded-full border-2 border-muted-foreground border-t-transparent animate-spin" />}
        <Button
          size="sm"
          variant={autoMode ? 'default' : 'outline'}
          className={cn('ml-auto h-6 text-[10px] px-2 gap-1', autoMode && 'bg-primary text-primary-foreground')}
          onClick={() => {
            setAutoMode((v) => !v);
            if (autoMode) setAutoExecuted([]);
          }}
          title="Auto Mode: automatically executes critical issues with confidence > 85%"
        >
          <Bot className="w-3 h-3" />
          Auto
          {autoMode && <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />}
        </Button>
      </div>

      {autoMode && autoExecuted.length > 0 && (
        <div className="rounded-md border border-green-400/30 bg-green-500/5 px-3 py-1.5 text-[11px] text-green-700 flex items-center gap-1.5">
          <Bot className="w-3 h-3 shrink-0" />
          Auto-executed {autoExecuted.length} critical issue{autoExecuted.length !== 1 ? 's' : ''} with confidence &gt; 85%.
        </div>
      )}

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
              {/* Section header */}
              <div className="flex items-center gap-1.5">
                {s.icon}
                <span className="text-xs font-medium">{s.label}</span>
                <Badge variant="outline" className="text-[9px] ml-auto">
                  {s.items.length}
                </Badge>
              </div>

              {/* Insight text */}
              <p className="text-[11px] text-muted-foreground leading-snug">{s.insightText}</p>

              {/* Section-level action */}
              {s.sectionAction && s.items.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 text-[11px] px-2 gap-1"
                  onClick={s.sectionAction.onClick}
                  disabled={s.sectionAction.loading}
                >
                  {s.sectionAction.loading
                    ? <Loader2 className="w-3 h-3 animate-spin" />
                    : <Zap className="w-3 h-3" />}
                  {s.sectionAction.label}
                </Button>
              )}

              {/* Row list */}
              {s.items.length === 0 ? (
                <p className="text-[11px] text-muted-foreground italic">{s.emptyText}</p>
              ) : (
                <div className="max-h-40 overflow-y-auto">
                  {s.items.slice(0, 10).map((item) => (
                    <IssueRow
                      key={item.key}
                      item={item}
                      actionLabel={s.rowActionLabel}
                      onAction={s.onRowAction ? () => s.onRowAction!(item) : undefined}
                      acting={actingKeys.has(item.key)}
                      wasAutoExecuted={autoExecuted.includes(item.key)}
                    />
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

