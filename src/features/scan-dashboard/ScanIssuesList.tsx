import React from 'react';
import { AlertTriangle, AlertCircle, Info, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ScanRun } from './ScanOverviewPanel';

export interface ScanIssue {
  id: string;
  title: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
  _source: string;
  _raw: Record<string, any>;
}

function normalizeSeverity(raw: any): 'high' | 'medium' | 'low' {
  const s = String(raw || '').toLowerCase();
  if (s === 'high' || s === 'critical' || s === 'error') return 'high';
  if (s === 'medium' || s === 'warning' || s === 'warn') return 'medium';
  return 'low';
}

const SOURCE_LABELS: Record<string, string> = {
  broken_flows: 'Trasigt flöde',
  fake_features: 'Saknad funktion',
  interaction_failures: 'Interaktionsfel',
  data_issues: 'Dataproblem',
};

export function extractIssues(latestRun: ScanRun | null): ScanIssue[] {
  if (!latestRun) return [];
  const ur = latestRun.unified_result;
  if (!ur) return [];

  const categories: Array<[string, any[]]> = [
    ['broken_flows', ur.broken_flows || []],
    ['fake_features', ur.fake_features || []],
    ['interaction_failures', ur.interaction_failures || []],
    ['data_issues', ur.data_issues || []],
  ];

  const issues: ScanIssue[] = [];
  for (const [source, list] of categories) {
    if (!Array.isArray(list)) continue;
    list.forEach((item: any, idx: number) => {
      const title =
        item?.title || item?.name || item?.issue || item?.target || item?.component || `Problem ${idx + 1}`;
      const description =
        item?.description || item?.message || item?.detail || item?.summary || '';
      const severity = normalizeSeverity(item?.severity || item?.level);
      issues.push({
        id: item?.id || `${source}-${idx}`,
        title: String(title),
        description: String(description),
        severity,
        _source: source,
        _raw: item || {},
      });
    });
  }

  // Sort: high → medium → low
  const order = { high: 0, medium: 1, low: 2 };
  issues.sort((a, b) => order[a.severity] - order[b.severity]);

  return issues;
}

function SeverityIcon({ severity }: { severity: ScanIssue['severity'] }) {
  if (severity === 'high') return <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />;
  if (severity === 'medium') return <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0" />;
  return <Info className="w-4 h-4 text-blue-400 shrink-0" />;
}

function SeverityBadge({ severity }: { severity: ScanIssue['severity'] }) {
  if (severity === 'high') return <Badge className="bg-red-500/15 text-red-600 border-red-500/30 text-[10px]">Hög</Badge>;
  if (severity === 'medium') return <Badge className="bg-yellow-500/15 text-yellow-600 border-yellow-500/30 text-[10px]">Medel</Badge>;
  return <Badge className="bg-blue-500/15 text-blue-600 border-blue-500/30 text-[10px]">Låg</Badge>;
}

interface ScanIssuesListProps {
  latestRun: ScanRun | null;
  selectedIssueId?: string | null;
  onSelectIssue?: (issue: ScanIssue) => void;
}

export function ScanIssuesList({ latestRun, selectedIssueId, onSelectIssue }: ScanIssuesListProps) {
  const issues = extractIssues(latestRun);

  const highCount = issues.filter(i => i.severity === 'high').length;
  const mediumCount = issues.filter(i => i.severity === 'medium').length;
  const lowCount = issues.filter(i => i.severity === 'low').length;

  if (issues.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Hittade problem</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 text-sm text-muted-foreground">
          {latestRun ? 'Inga problem hittades i senaste skanningen. 🎉' : 'Kör en skanning för att se problem här.'}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Hittade problem ({issues.length})</CardTitle>
          <div className="flex gap-1.5">
            {highCount > 0 && <Badge className="bg-red-500/15 text-red-600 border-red-500/30 text-[10px]">{highCount} hög</Badge>}
            {mediumCount > 0 && <Badge className="bg-yellow-500/15 text-yellow-600 border-yellow-500/30 text-[10px]">{mediumCount} medel</Badge>}
            {lowCount > 0 && <Badge className="bg-blue-500/15 text-blue-600 border-blue-500/30 text-[10px]">{lowCount} låg</Badge>}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border">
          {issues.map((issue) => (
            <button
              key={issue.id}
              onClick={() => onSelectIssue?.(issue)}
              className={`w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-muted/40 transition-colors ${
                selectedIssueId === issue.id ? 'bg-muted/60' : ''
              }`}
            >
              <SeverityIcon severity={issue.severity} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-foreground truncate">{issue.title}</span>
                  <SeverityBadge severity={issue.severity} />
                  <span className="text-[10px] text-muted-foreground">
                    {SOURCE_LABELS[issue._source] || issue._source}
                  </span>
                </div>
                {issue.description && (
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{issue.description}</p>
                )}
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
