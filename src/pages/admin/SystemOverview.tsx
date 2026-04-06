import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Flame, AlertTriangle, CheckCircle2, ChevronRight, ChevronDown, Loader2, RefreshCw, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

interface RawIssue {
  title?: string;
  description?: string;
  severity?: string;
  fix?: string;
  cause?: string;
  target?: string;
  component?: string;
  entity_name?: string;
  _source?: string;
  [key: string]: unknown;
}

interface ScanRun {
  id: string;
  status: string;
  created_at: string;
  completed_at: string | null;
  system_health_score: number | null;
  unified_result: Record<string, unknown> | null;
}

interface Issue {
  id: string;
  title: string;
  description: string;
  fix: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  target: string;
}

function extractIssues(unified_result: Record<string, unknown> | null): Issue[] {
  if (!unified_result) return [];
  const raw: RawIssue[] = [
    ...((unified_result.broken_flows as RawIssue[]) || []),
    ...((unified_result.fake_features as RawIssue[]) || []),
    ...((unified_result.interaction_failures as RawIssue[]) || []),
    ...((unified_result.data_issues as RawIssue[]) || []),
  ];

  const severityRank: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

  return raw
    .filter((r) => r.title)
    .map((r, i): Issue => ({
      id: `issue-${i}`,
      title: r.title || 'Unknown issue',
      description: r.description || r.cause || '',
      fix: r.fix || 'Review and resolve manually.',
      severity: (['critical', 'high', 'medium', 'low'].includes((r.severity || '').toLowerCase())
        ? (r.severity as Issue['severity'])
        : 'medium') as Issue['severity'],
      target: r.target || r.component || r.entity_name || '',
    }))
    .sort((a, b) => (severityRank[a.severity] ?? 2) - (severityRank[b.severity] ?? 2));
}

const severityConfig = {
  critical: { label: '🔥 Fix this first', bg: 'bg-red-50 border-red-200', badge: 'bg-red-100 text-red-700', dot: 'bg-red-500' },
  high:     { label: '🔥 Fix this first', bg: 'bg-red-50 border-red-200', badge: 'bg-red-100 text-red-700', dot: 'bg-red-500' },
  medium:   { label: '⚠️ Next',           bg: 'bg-amber-50 border-amber-200', badge: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
  low:      { label: '⚠️ Next',           bg: 'bg-amber-50 border-amber-200', badge: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
};

function IssueCard({ issue, isOpen, onToggle }: { issue: Issue; isOpen: boolean; onToggle: () => void }) {
  const cfg = severityConfig[issue.severity];
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'w-full text-left rounded-2xl border-2 p-6 transition-all duration-200 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        cfg.bg,
        isOpen && 'shadow-md',
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <span className={cn('mt-1.5 h-3 w-3 rounded-full flex-shrink-0', cfg.dot)} />
          <div className="min-w-0">
            <p className="text-xl font-semibold text-gray-900 leading-snug">{issue.title}</p>
            {issue.target && (
              <p className="mt-1 text-sm text-gray-500 truncate">{issue.target}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className={cn('rounded-full px-3 py-1 text-sm font-medium', cfg.badge)}>
            {issue.severity}
          </span>
          {isOpen ? (
            <ChevronDown className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronRight className="h-5 w-5 text-gray-400" />
          )}
        </div>
      </div>

      {isOpen && (
        <div className="mt-5 space-y-4 border-t border-gray-200 pt-5 text-left" onClick={(e) => e.stopPropagation()}>
          {issue.description && (
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-gray-400 mb-1">What happened</p>
              <p className="text-base text-gray-700">{issue.description}</p>
            </div>
          )}
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-gray-400 mb-1">How to fix</p>
            <p className="text-base font-medium text-gray-900">{issue.fix}</p>
          </div>
        </div>
      )}
    </button>
  );
}

export default function SystemOverview() {
  const [openId, setOpenId] = useState<string | null>(null);

  const { data: latestRun, isLoading, refetch, dataUpdatedAt } = useQuery<ScanRun | null>({
    queryKey: ['system-overview-latest-run'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scan_runs')
        .select('id, status, created_at, completed_at, system_health_score, unified_result')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as ScanRun | null;
    },
    staleTime: 2 * 60 * 1000,
  });

  const allIssues = extractIssues(latestRun?.unified_result ?? null);
  const critical = allIssues.filter((i) => i.severity === 'critical' || i.severity === 'high').slice(0, 1);
  const next = allIssues.filter((i) => i.severity === 'medium' || i.severity === 'low').slice(0, 3);
  const restCount = allIssues.length - critical.length - next.length;

  const healthScore = latestRun?.system_health_score ?? null;
  const scannedAt = latestRun?.completed_at ?? latestRun?.created_at ?? null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 space-y-8">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">System Status</h1>
          {scannedAt && (
            <p className="mt-1 text-sm text-gray-400">
              Last scan: {new Date(scannedAt).toLocaleString()}
            </p>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={() => refetch()} className="text-gray-500">
          <RefreshCw className="h-4 w-4 mr-1" />
          Refresh
        </Button>
      </div>

      {/* Health score pill */}
      {healthScore !== null && (
        <div className={cn(
          'inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-medium',
          healthScore >= 80 ? 'bg-green-100 text-green-700' :
          healthScore >= 50 ? 'bg-amber-100 text-amber-700' :
                              'bg-red-100 text-red-700',
        )}>
          <span className={cn(
            'h-2 w-2 rounded-full',
            healthScore >= 80 ? 'bg-green-500' :
            healthScore >= 50 ? 'bg-amber-500' :
                                'bg-red-500',
          )} />
          Health: {healthScore}%
        </div>
      )}

      {/* No scan yet */}
      {!latestRun && (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 p-10 text-center">
          <p className="text-lg text-gray-500">No scan data yet.</p>
          <p className="mt-1 text-sm text-gray-400">Run a scan from the Command Center.</p>
          <div className="mt-4">
            <Link to="/admin/system-explorer">
              <Button variant="outline">Go to Command Center</Button>
            </Link>
          </div>
        </div>
      )}

      {/* All clear */}
      {latestRun && allIssues.length === 0 && (
        <div className="rounded-2xl border-2 border-green-200 bg-green-50 p-10 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
          <p className="mt-3 text-2xl font-bold text-green-800">Everything looks good</p>
          <p className="mt-1 text-sm text-gray-500">No issues found in the latest scan.</p>
        </div>
      )}

      {/* Critical — only 1 */}
      {critical.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Flame className="h-5 w-5 text-red-500" />
            <h2 className="text-lg font-semibold text-gray-900">Fix this first</h2>
          </div>
          {critical.map((issue) => (
            <IssueCard
              key={issue.id}
              issue={issue}
              isOpen={openId === issue.id}
              onToggle={() => setOpenId(openId === issue.id ? null : issue.id)}
            />
          ))}
        </section>
      )}

      {/* Next 2–3 */}
      {next.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <h2 className="text-lg font-semibold text-gray-900">Next</h2>
          </div>
          {next.map((issue) => (
            <IssueCard
              key={issue.id}
              issue={issue}
              isOpen={openId === issue.id}
              onToggle={() => setOpenId(openId === issue.id ? null : issue.id)}
            />
          ))}
        </section>
      )}

      {/* Hidden count */}
      {restCount > 0 && (
        <p className="text-center text-sm text-gray-400">
          ✔ {restCount} more issue{restCount !== 1 ? 's' : ''} hidden — use the{' '}
          <Link to="/admin/system-explorer" className="underline hover:text-gray-700">
            Command Center
          </Link>{' '}
          for the full picture.
        </p>
      )}

      {/* Footer link */}
      <div className="pt-2 text-center">
        <Link to="/admin/system-explorer" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-700">
          <ArrowLeft className="h-3.5 w-3.5" />
          Advanced view
        </Link>
      </div>
    </div>
  );
}
