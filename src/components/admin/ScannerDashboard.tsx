import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Radar, AlertTriangle, CheckCircle, XCircle, Clock,
  RefreshCw, Activity, Search, Database, TrendingUp,
  ChevronDown, ChevronRight, Filter,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function severityColor(s?: string | null) {
  switch (s) {
    case 'critical': return 'text-red-600 bg-red-500/10 border-red-500/30';
    case 'high': return 'text-orange-600 bg-orange-500/10 border-orange-500/30';
    case 'medium': return 'text-yellow-600 bg-yellow-500/10 border-yellow-500/30';
    case 'low': return 'text-blue-600 bg-blue-500/10 border-blue-500/30';
    default: return 'text-muted-foreground bg-muted border-border';
  }
}

function statusIcon(status: string) {
  switch (status) {
    case 'done': return <CheckCircle className="w-3.5 h-3.5 text-green-500" />;
    case 'running': return <Radar className="w-3.5 h-3.5 text-blue-500 animate-spin" />;
    case 'error': return <XCircle className="w-3.5 h-3.5 text-destructive" />;
    default: return <Clock className="w-3.5 h-3.5 text-muted-foreground" />;
  }
}

function fmtDate(iso?: string | null) {
  if (!iso) return '–';
  return new Date(iso).toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' });
}

// ─── Scan Run Row ──────────────────────────────────────────────────────────────

function ScanRunRow({ run }: { run: any }) {
  const [expanded, setExpanded] = useState(false);
  const steps: Record<string, any> = run.steps_results || {};
  const stepEntries = Object.entries(steps);
  const failedSteps = stepEntries.filter(([, v]) => v?.failed || v?.issues_found > 0);

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-3 w-full px-4 py-3 text-left hover:bg-muted/40 transition-colors"
      >
        {statusIcon(run.status)}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium truncate">
              {run.scan_mode || 'full'} — iteration {run.iteration}/{run.max_iterations}
            </span>
            <Badge variant="outline" className={cn('text-[10px]', run.status === 'done' ? 'text-green-600 border-green-500/30' : run.status === 'error' ? 'text-destructive border-destructive/30' : 'text-blue-600 border-blue-500/30')}>
              {run.status}
            </Badge>
            {run.system_health_score != null && (
              <Badge variant="outline" className="text-[10px]">
                Hälsa: {run.system_health_score}/100
              </Badge>
            )}
            {run.total_new_issues != null && (
              <Badge variant="outline" className={cn('text-[10px]', run.total_new_issues > 0 ? 'text-orange-600 border-orange-500/30' : '')}>
                {run.total_new_issues} nya ärenden
              </Badge>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {fmtDate(run.started_at)} — {run.target_area || 'hela systemet'}
          </p>
        </div>
        {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
      </button>

      {expanded && (
        <div className="border-t border-border px-4 py-3 space-y-3 bg-muted/20">
          {run.executive_summary && (
            <p className="text-xs text-muted-foreground">{run.executive_summary}</p>
          )}

          {/* Broken flows */}
          {(run.unified_result as any)?.broken_flows?.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-destructive uppercase tracking-wide mb-1">Brutna flöden ({(run.unified_result as any).broken_flows.length})</p>
              <div className="space-y-1">
                {((run.unified_result as any).broken_flows as any[]).map((f: any, i: number) => (
                  <div key={i} className="text-[11px] bg-destructive/5 border border-destructive/20 rounded px-2 py-1">
                    <span className="font-medium">{f.flow || f.name || f.component}</span>
                    {f.reason && <span className="text-muted-foreground"> — {f.reason}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Failed / issue steps */}
          {failedSteps.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-orange-600 uppercase tracking-wide mb-1">Skanners med problem ({failedSteps.length})</p>
              <div className="space-y-1">
                {failedSteps.map(([key, v]) => (
                  <div key={key} className="flex items-center justify-between text-[11px] bg-orange-500/5 border border-orange-500/20 rounded px-2 py-1">
                    <span className="font-medium font-mono">{key}</span>
                    <span className="text-muted-foreground">
                      {v?.issues_found != null ? `${v.issues_found} problem` : 'misslyckad'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {stepEntries.length === 0 && <p className="text-xs text-muted-foreground">Inga stegresultat</p>}
        </div>
      )}
    </div>
  );
}

// ─── Scan Results Table ────────────────────────────────────────────────────────

function ScanResultsTable({
  severityFilter,
  scanTypeFilter,
  search,
}: {
  severityFilter: string;
  scanTypeFilter: string;
  search: string;
}) {
  const { data: results = [], isLoading } = useQuery({
    queryKey: ['scanner-dashboard-results', severityFilter, scanTypeFilter, search],
    queryFn: async () => {
      let q = supabase
        .from('ai_scan_results' as any)
        .select('id, scan_type, overall_score, overall_status, issues_count, executive_summary, created_at, scanned_by')
        .order('created_at', { ascending: false })
        .limit(100);

      if (scanTypeFilter && scanTypeFilter !== 'all') q = q.eq('scan_type', scanTypeFilter);
      if (search) q = q.ilike('executive_summary', `%${search}%`);

      const { data } = await q;
      let rows = (data || []) as any[];

      if (severityFilter && severityFilter !== 'all') {
        const scoreMap: Record<string, [number, number]> = {
          critical: [0, 30],
          high: [31, 50],
          medium: [51, 70],
          low: [71, 100],
        };
        const [min, max] = scoreMap[severityFilter] || [0, 100];
        rows = rows.filter((r: any) => (r.overall_score ?? 100) >= min && (r.overall_score ?? 100) <= max);
      }

      return rows;
    },
    refetchInterval: 30000,
  });

  if (isLoading) return <p className="text-xs text-muted-foreground py-4 text-center">Laddar skannerresultat…</p>;
  if (results.length === 0) return <p className="text-xs text-muted-foreground py-4 text-center">Inga resultat hittades</p>;

  return (
    <div className="space-y-1">
      {results.map((r: any) => {
        const severity = r.overall_score == null ? 'info'
          : r.overall_score <= 30 ? 'critical'
          : r.overall_score <= 50 ? 'high'
          : r.overall_score <= 70 ? 'medium' : 'low';

        return (
          <div key={r.id} className="flex items-start gap-3 px-3 py-2.5 rounded-lg border border-border hover:bg-muted/30 transition-colors">
            <Badge variant="outline" className={cn('text-[9px] shrink-0 mt-0.5', severityColor(severity))}>
              {severity}
            </Badge>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-mono font-medium">{r.scan_type || '–'}</span>
                {r.overall_score != null && (
                  <span className="text-[10px] text-muted-foreground">{r.overall_score}/100</span>
                )}
                {r.issues_count != null && r.issues_count > 0 && (
                  <Badge variant="outline" className="text-[9px] text-orange-600 border-orange-500/30">
                    {r.issues_count} problem
                  </Badge>
                )}
              </div>
              {r.executive_summary && (
                <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{r.executive_summary}</p>
              )}
            </div>
            <span className="text-[10px] text-muted-foreground shrink-0 whitespace-nowrap">{fmtDate(r.created_at)}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Work Items Issues ─────────────────────────────────────────────────────────

function IssuesTable({
  severityFilter,
  componentFilter,
  search,
}: {
  severityFilter: string;
  componentFilter: string;
  search: string;
}) {
  const { data: items = [], isLoading } = useQuery({
    queryKey: ['scanner-dashboard-issues', severityFilter, componentFilter, search],
    queryFn: async () => {
      let q = supabase
        .from('work_items' as any)
        .select('id, title, item_type, priority, status, affected_components, created_at, description')
        .in('status', ['open', 'in_progress'])
        .order('created_at', { ascending: false })
        .limit(150);

      if (severityFilter && severityFilter !== 'all') q = q.eq('priority', severityFilter);
      if (search) q = q.ilike('title', `%${search}%`);

      const { data } = await q;
      let rows = (data || []) as any[];

      if (componentFilter && componentFilter !== 'all') {
        rows = rows.filter((r: any) =>
          Array.isArray(r.affected_components) &&
          r.affected_components.some((c: string) => c?.toLowerCase().includes(componentFilter.toLowerCase()))
        );
      }

      return rows;
    },
    refetchInterval: 30000,
  });

  if (isLoading) return <p className="text-xs text-muted-foreground py-4 text-center">Laddar ärenden…</p>;
  if (items.length === 0) return <p className="text-xs text-muted-foreground py-4 text-center">Inga öppna ärenden</p>;

  const priorityColors: Record<string, string> = {
    critical: 'text-red-600 border-red-500/30 bg-red-500/10',
    high: 'text-orange-600 border-orange-500/30 bg-orange-500/10',
    medium: 'text-yellow-600 border-yellow-500/30 bg-yellow-500/10',
    low: 'text-blue-600 border-blue-500/30 bg-blue-500/10',
  };

  return (
    <div className="space-y-1">
      {items.map((item: any) => (
        <div key={item.id} className="flex items-start gap-3 px-3 py-2.5 rounded-lg border border-border hover:bg-muted/30 transition-colors">
          <Badge variant="outline" className={cn('text-[9px] shrink-0 mt-0.5', priorityColors[item.priority] || 'text-muted-foreground')}>
            {item.priority || '–'}
          </Badge>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-medium truncate">{item.title}</span>
              <Badge variant="secondary" className="text-[9px]">{item.item_type}</Badge>
            </div>
            {item.affected_components?.length > 0 && (
              <div className="flex gap-1 flex-wrap mt-0.5">
                {(item.affected_components as string[]).slice(0, 4).map((c: string) => (
                  <span key={c} className="text-[9px] bg-muted px-1.5 py-0.5 rounded-full">{c}</span>
                ))}
              </div>
            )}
          </div>
          <span className="text-[10px] text-muted-foreground shrink-0 whitespace-nowrap">{fmtDate(item.created_at)}</span>
        </div>
      ))}
    </div>
  );
}

// ─── ScannerDashboard ──────────────────────────────────────────────────────────

const ScannerDashboard = () => {
  const [severityFilter, setSeverityFilter] = useState('all');
  const [componentFilter, setComponentFilter] = useState('');
  const [search, setSearch] = useState('');
  const [activeView, setActiveView] = useState<'scan_runs' | 'scan_results' | 'issues'>('scan_runs');

  const { data: scanRuns = [], isLoading: runsLoading, refetch: refetchRuns } = useQuery({
    queryKey: ['scanner-dashboard-runs'],
    queryFn: async () => {
      const { data } = await supabase
        .from('scan_runs' as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      return (data || []) as any[];
    },
    refetchInterval: 15000,
  });

  const { data: stats } = useQuery({
    queryKey: ['scanner-dashboard-stats'],
    queryFn: async () => {
      const [runsRes, resultsRes, itemsRes] = await Promise.all([
        supabase.from('scan_runs' as any).select('id, status', { count: 'exact', head: false }).eq('status', 'done'),
        supabase.from('ai_scan_results' as any).select('id', { count: 'exact', head: true }),
        supabase.from('work_items' as any).select('id', { count: 'exact', head: true }).in('status', ['open', 'in_progress']),
      ]);
      return {
        completedRuns: runsRes.count ?? 0,
        scanResults: resultsRes.count ?? 0,
        openIssues: itemsRes.count ?? 0,
      };
    },
    refetchInterval: 30000,
  });

  const views = [
    { id: 'scan_runs' as const, label: 'Scan Runs', icon: Radar },
    { id: 'scan_results' as const, label: 'Skannerresultat', icon: Database },
    { id: 'issues' as const, label: 'Öppna ärenden', icon: AlertTriangle },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Radar className="w-5 h-5 text-primary" />
            Scanner / Data Center
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Deterministisk skanner — ingen AI, inga dolda anrop
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => refetchRuns()}>
          <RefreshCw className="w-3.5 h-3.5" />
          Uppdatera
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Genomförda skanningar</p>
                <p className="text-lg font-bold">{stats?.completedRuns ?? '–'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-blue-500 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Skannerresultat</p>
                <p className="text-lg font-bold">{stats?.scanResults ?? '–'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-500 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Öppna ärenden</p>
                <p className="text-lg font-bold">{stats?.openIssues ?? '–'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* View selector */}
      <div className="flex items-center gap-2 border-b border-border pb-3">
        {views.map(v => (
          <button
            key={v.id}
            onClick={() => setActiveView(v.id)}
            className={cn(
              'flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md transition-colors',
              activeView === v.id
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            )}
          >
            <v.icon className="w-3.5 h-3.5" />
            {v.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <Filter className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
          <Input
            className="pl-7 h-7 text-xs w-48"
            placeholder="Sök…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger className="h-7 text-xs w-36">
            <SelectValue placeholder="Allvarlighet" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alla</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
        {activeView === 'issues' && (
          <Input
            className="h-7 text-xs w-40"
            placeholder="Komponent…"
            value={componentFilter}
            onChange={e => setComponentFilter(e.target.value)}
          />
        )}
      </div>

      {/* Content */}
      <ScrollArea className="h-[500px] pr-2">
        {activeView === 'scan_runs' && (
          <div className="space-y-2">
            {runsLoading && <p className="text-xs text-muted-foreground py-4 text-center">Laddar scan runs…</p>}
            {!runsLoading && scanRuns.length === 0 && (
              <p className="text-xs text-muted-foreground py-4 text-center">Inga skanningar hittade — kör en skanning för att börja</p>
            )}
            {scanRuns.map(run => <ScanRunRow key={run.id} run={run} />)}
          </div>
        )}

        {activeView === 'scan_results' && (
          <ScanResultsTable
            severityFilter={severityFilter}
            scanTypeFilter="all"
            search={search}
          />
        )}

        {activeView === 'issues' && (
          <IssuesTable
            severityFilter={severityFilter === 'all' ? '' : severityFilter}
            componentFilter={componentFilter}
            search={search}
          />
        )}
      </ScrollArea>
    </div>
  );
};

export default ScannerDashboard;
