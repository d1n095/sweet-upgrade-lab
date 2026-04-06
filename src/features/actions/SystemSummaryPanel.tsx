import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, Layers, Loader2, PlayCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { SystemActionPanel, executeIssue, type ActionIssue } from './SystemActionPanel';
import { toast } from 'sonner';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ScanRun {
  id: string;
  unified_result?: any;
}

interface Props {
  latestRun: ScanRun | null;
}

type Impact = 'critical' | 'high' | 'medium' | 'low' | 'info';

interface ImpactGroup {
  impact: Impact;
  issues: ActionIssue[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const CATEGORY_KEYS: Array<{ key: string; label: string }> = [
  { key: 'broken_flows', label: 'Broken Flow' },
  { key: 'fake_features', label: 'Fake Feature' },
  { key: 'interaction_failures', label: 'Interaction Failure' },
  { key: 'data_issues', label: 'Data Issue' },
  { key: 'issues', label: 'Issue' },
  { key: 'detected_issues', label: 'Detected Issue' },
  { key: 'master_list', label: 'Issue' },
];

const SEVERITY_ORDER: Record<Impact, number> = {
  critical: 0, high: 1, medium: 2, low: 3, info: 4,
};

function normalizeSeverity(v: string | undefined): ActionIssue['severity'] {
  const s = (v ?? '').toLowerCase();
  if (s === 'critical') return 'critical';
  if (s === 'high' || s === 'error') return 'high';
  if (s === 'medium' || s === 'warning') return 'medium';
  if (s === 'low') return 'low';
  return 'info';
}

function computeImpactScore(severity: ActionIssue['severity']): number {
  const scores: Record<ActionIssue['severity'], number> = {
    critical: 100, high: 75, medium: 50, low: 25, info: 10,
  };
  return scores[severity];
}

function extractIssues(unified_result: any): ActionIssue[] {
  if (!unified_result || typeof unified_result !== 'object') return [];
  const out: ActionIssue[] = [];
  const seen = new Set<string>();

  for (const { key, label } of CATEGORY_KEYS) {
    const raw = unified_result[key];
    if (!raw) continue;
    const arr: any[] = Array.isArray(raw) ? raw : Array.isArray(raw?.issues) ? raw.issues : [];
    for (let i = 0; i < arr.length; i++) {
      const item = arr[i];
      if (!item || typeof item !== 'object') continue;
      const _key = `${key}-${item.id || item.title || i}`;
      if (seen.has(_key)) continue;
      seen.add(_key);
      const severity = normalizeSeverity(item.severity || item.impact);
      out.push({
        _key,
        _category: key,
        id: item.id || _key,
        title: item.title || item.name || item.issue || `${label} #${i + 1}`,
        description: item.description || item.details || item.message || '',
        severity,
        file: item.file || item.component || item.route || undefined,
        fix_suggestion: item.fix_suggestion || item.recommended_fix || item.fix || undefined,
        impact_score: computeImpactScore(severity),
      });
    }
  }
  return out;
}

function groupByImpact(issues: ActionIssue[]): ImpactGroup[] {
  const order: Impact[] = ['critical', 'high', 'medium', 'low', 'info'];
  const map = new Map<Impact, ActionIssue[]>();
  for (const imp of order) map.set(imp, []);
  for (const issue of issues) {
    map.get(issue.severity)!.push(issue);
  }
  // Sort within each group: primary by severity order (same within group), secondary by category
  for (const [, groupIssues] of map) {
    groupIssues.sort((a, b) => {
      const severityDiff = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
      if (severityDiff !== 0) return severityDiff;
      return a._category.localeCompare(b._category);
    });
  }
  return order
    .map((impact) => ({ impact, issues: map.get(impact)! }))
    .filter((g) => g.issues.length > 0);
}

// ── Impact styling ────────────────────────────────────────────────────────────

const IMPACT_STYLES: Record<Impact, { badge: string; icon: React.ReactNode; label: string }> = {
  critical: {
    badge: 'bg-destructive/15 text-destructive border-destructive/30',
    icon: <AlertTriangle className="w-3.5 h-3.5 text-destructive" />,
    label: 'Kritisk',
  },
  high: {
    badge: 'bg-orange-500/15 text-orange-600 border-orange-400/30',
    icon: <AlertTriangle className="w-3.5 h-3.5 text-orange-500" />,
    label: 'Hög',
  },
  medium: {
    badge: 'bg-yellow-500/15 text-yellow-700 border-yellow-400/30',
    icon: <Info className="w-3.5 h-3.5 text-yellow-600" />,
    label: 'Medel',
  },
  low: {
    badge: 'bg-blue-500/10 text-blue-600 border-blue-400/20',
    icon: <Info className="w-3.5 h-3.5 text-blue-500" />,
    label: 'Låg',
  },
  info: {
    badge: 'bg-muted text-muted-foreground border-border',
    icon: <Info className="w-3.5 h-3.5 text-muted-foreground" />,
    label: 'Info',
  },
};

// ── Component ─────────────────────────────────────────────────────────────────

export function SystemSummaryPanel({ latestRun }: Props) {
  const [expandedGroups, setExpandedGroups] = useState<Set<Impact>>(new Set(['critical', 'high']));
  const [batchExecuting, setBatchExecuting] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ done: number; total: number } | null>(null);
  const [batchDoneKeys, setBatchDoneKeys] = useState<Set<string>>(new Set());

  const groups = useMemo(() => {
    if (!latestRun?.unified_result) return [];
    const issues = extractIssues(latestRun.unified_result);
    return groupByImpact(issues);
  }, [latestRun]);

  const totalIssues = useMemo(() => groups.reduce((s, g) => s + g.issues.length, 0), [groups]);
  const criticalIssues = useMemo(
    () => groups.find((g) => g.impact === 'critical')?.issues ?? [],
    [groups],
  );

  const toggleGroup = (impact: Impact) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(impact)) next.delete(impact);
      else next.add(impact);
      return next;
    });
  };

  const handleBatchExecute = async () => {
    const pending = criticalIssues.filter((i) => !batchDoneKeys.has(i._key));
    if (pending.length === 0) return;

    setBatchExecuting(true);
    setBatchProgress({ done: 0, total: pending.length });
    // Ensure critical group is expanded so user can see progress spinners
    setExpandedGroups((prev) => new Set([...prev, 'critical']));

    let done = 0;
    for (const issue of pending) {
      try {
        await executeIssue(issue, latestRun?.id);
        setBatchDoneKeys((prev) => new Set([...prev, issue._key]));
      } catch {
        // continue on individual failure
      }
      done++;
      setBatchProgress({ done, total: pending.length });
    }

    setBatchExecuting(false);
    toast.success(`Batch utförd: ${done}/${pending.length} kritiska problem åtgärdade`);
    setBatchProgress(null);
  };

  if (!latestRun) {
    return (
      <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
        Ingen scandata tillgänglig — kör en scan först.
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-32 gap-2 text-muted-foreground">
        <CheckCircle2 className="w-8 h-8 text-green-500" />
        <span className="text-sm">Inga problem hittades i senaste scan.</span>
      </div>
    );
  }

  const pendingCriticalCount = criticalIssues.filter((i) => !batchDoneKeys.has(i._key)).length;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Åtgärdsöversikt</span>
        </div>
        <div className="flex items-center gap-2">
          {batchProgress && (
            <span className="text-xs text-muted-foreground">
              {batchProgress.done}/{batchProgress.total}
            </span>
          )}
          {pendingCriticalCount > 0 && (
            <Button
              size="sm"
              variant="destructive"
              className="h-7 text-xs gap-1.5"
              disabled={batchExecuting}
              onClick={handleBatchExecute}
            >
              {batchExecuting ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <PlayCircle className="w-3 h-3" />
              )}
              {batchExecuting
                ? `Utför ${batchProgress?.done ?? 0}/${batchProgress?.total ?? pendingCriticalCount}…`
                : `Utför alla kritiska (${pendingCriticalCount})`}
            </Button>
          )}
          <Badge variant="outline" className="text-xs">
            {totalIssues} problem
          </Badge>
        </div>
      </div>

      {/* Data source badge */}
      <p className="text-[10px] text-muted-foreground">
        Källa: <span className="text-green-600 font-mono">scan_runs.unified_result</span>
        {latestRun.id && <span className="ml-1 font-mono opacity-60">{latestRun.id.slice(0, 8)}</span>}
      </p>

      {/* Groups */}
      {groups.map(({ impact, issues }) => {
        const style = IMPACT_STYLES[impact];
        const open = expandedGroups.has(impact);
        return (
          <div key={impact} className="border border-border rounded-lg overflow-hidden">
            {/* Group header */}
            <button
              className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/50 transition-colors"
              onClick={() => toggleGroup(impact)}
            >
              {style.icon}
              <span className="text-xs font-medium flex-1">{style.label} impact</span>
              <Badge variant="outline" className={cn('text-[10px]', style.badge)}>
                {issues.length}
              </Badge>
              <span className="text-[10px] text-muted-foreground ml-1">{open ? '▲' : '▼'}</span>
            </button>

            {/* Issues */}
            {open && (
              <div className="px-3 pb-3 pt-1 space-y-2 bg-muted/10 border-t border-border">
                {issues.map((issue) => (
                  <SystemActionPanel
                    key={issue._key}
                    issue={issue}
                    scanRunId={latestRun.id}
                    batchExecuting={batchExecuting && impact === 'critical' && !batchDoneKeys.has(issue._key)}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
