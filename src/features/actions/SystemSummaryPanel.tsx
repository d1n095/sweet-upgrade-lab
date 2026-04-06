import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, Layers } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { SystemActionPanel, type ActionIssue } from './SystemActionPanel';

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

function normalizeSeverity(v: string | undefined): ActionIssue['severity'] {
  const s = (v ?? '').toLowerCase();
  if (s === 'critical') return 'critical';
  if (s === 'high' || s === 'error') return 'high';
  if (s === 'medium' || s === 'warning') return 'medium';
  if (s === 'low') return 'low';
  return 'info';
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
      out.push({
        _key,
        _category: key,
        id: item.id || _key,
        title: item.title || item.name || item.issue || `${label} #${i + 1}`,
        description: item.description || item.details || item.message || '',
        severity: normalizeSeverity(item.severity || item.impact),
        file: item.file || item.component || item.route || undefined,
        fix_suggestion: item.fix_suggestion || item.recommended_fix || item.fix || undefined,
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

  const groups = useMemo(() => {
    if (!latestRun?.unified_result) return [];
    const issues = extractIssues(latestRun.unified_result);
    return groupByImpact(issues);
  }, [latestRun]);

  const totalIssues = useMemo(() => groups.reduce((s, g) => s + g.issues.length, 0), [groups]);

  const toggleGroup = (impact: Impact) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(impact)) next.delete(impact);
      else next.add(impact);
      return next;
    });
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

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Åtgärdsöversikt</span>
        </div>
        <Badge variant="outline" className="text-xs">
          {totalIssues} problem
        </Badge>
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
                  <SystemActionPanel key={issue._key} issue={issue} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
