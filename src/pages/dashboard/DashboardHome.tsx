import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { Activity, AlertTriangle, CheckCircle, Loader2, Radar, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Priority order for work items
const PRIORITY_RANK: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };

function HealthBadge({ score }: { score: number | null }) {
  if (score === null) return null;
  const cls =
    score >= 80
      ? 'bg-green-100 text-green-800 border-green-200'
      : score >= 50
      ? 'bg-yellow-100 text-yellow-800 border-yellow-200'
      : 'bg-red-100 text-red-800 border-red-200';
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-semibold', cls)}>
      {score}%
    </span>
  );
}

export default function DashboardHome() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Latest scan run for this user
  const { data: latestRun, isLoading: scanLoading } = useQuery({
    queryKey: ['dashboard-latest-run', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scan_runs')
        .select('id, status, system_health_score, total_new_issues, executive_summary, created_at, completed_at, started_by')
        .eq('started_by', user!.id)
        .in('status', ['done', 'completed'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Open work items for this user's latest scan
  const { data: workItems = [], isLoading: workLoading } = useQuery({
    queryKey: ['dashboard-work-items', latestRun?.id],
    enabled: !!latestRun?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('work_items')
        .select('id, title, priority, status, source_id')
        .eq('source_id', latestRun!.id)
        .not('status', 'in', '("done","fixed","resolved","ignored")')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const isLoading = scanLoading || workLoading;

  // "Fix this first" — highest-priority open item
  const topItem = workItems.slice().sort(
    (a, b) => (PRIORITY_RANK[b.priority] ?? 0) - (PRIORITY_RANK[a.priority] ?? 0),
  )[0] ?? null;

  const totalItems = workItems.length;
  const progress = 0; // all fetched items are open; done count tracked separately

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ── Empty state ────────────────────────────────────────────────────────────
  if (!latestRun) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center space-y-4">
        <Radar className="h-12 w-12 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Run your first scan</h2>
        <p className="text-sm text-muted-foreground max-w-xs">
          Scan your system to detect issues, track trends, and get actionable fixes.
        </p>
        <Button onClick={() => navigate('/admin/system-explorer')}>
          Start scan
        </Button>
      </div>
    );
  }

  // ── Dashboard content ──────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Last scan:{' '}
            {latestRun.completed_at
              ? format(new Date(latestRun.completed_at), 'MMM d, yyyy HH:mm')
              : '—'}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate('/admin/system-explorer')}>
          <Radar className="h-4 w-4 mr-1.5" />
          Run scan
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <Activity className="h-4 w-4" />
              System health
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold">
                {latestRun.system_health_score ?? '—'}
              </span>
              {latestRun.system_health_score !== null && (
                <HealthBadge score={latestRun.system_health_score} />
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4" />
              Open issues
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold">{totalItems}</span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4" />
              New this scan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold">{latestRun.total_new_issues ?? '—'}</span>
          </CardContent>
        </Card>
      </div>

      {/* Executive summary */}
      {latestRun.executive_summary && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {latestRun.executive_summary}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Fix this first */}
      {topItem && (
        <Card className="border-destructive/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-1.5 text-destructive">
              <CheckCircle className="h-4 w-4" />
              Fix this first
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-start gap-2">
              <Badge
                variant="outline"
                className={cn(
                  'shrink-0 text-xs',
                  topItem.priority === 'critical' && 'border-red-400 text-red-600',
                  topItem.priority === 'high' && 'border-orange-400 text-orange-600',
                )}
              >
                {topItem.priority}
              </Badge>
              <p className="text-sm font-medium leading-snug">{topItem.title}</p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate('/admin/system-explorer')}
            >
              Open in system explorer
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Progress */}
      {totalItems > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>0 fixed</span>
              <span>{totalItems} open</span>
            </div>
            <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
