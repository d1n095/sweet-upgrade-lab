import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RefreshCw, ChevronRight, ChevronDown, Radar, CheckCircle2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import AdminBreadcrumbs from '@/components/admin/AdminBreadcrumbs';

interface ScanResult {
  id: string;
  scan_type: string;
  created_at: string;
  overall_status: string | null;
  overall_score: number | null;
  issues_count: number | null;
  executive_summary: string | null;
  scanned_by: string | null;
  tasks_created: number | null;
  results: any;
}

const AdminScans = () => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: scans = [], isLoading, refetch } = useQuery({
    queryKey: ['admin-scans-list'],
    queryFn: async () => {
      const { data } = await supabase
        .from('ai_scan_results')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      return (data || []) as ScanResult[];
    },
  });

  const stats = useMemo(() => ({
    total: scans.length,
    totalIssues: scans.reduce((sum, s) => sum + (s.issues_count || 0), 0),
    avgScore: scans.length > 0
      ? Math.round(scans.filter(s => s.overall_score != null).reduce((sum, s) => sum + (s.overall_score || 0), 0) / Math.max(scans.filter(s => s.overall_score != null).length, 1))
      : 0,
  }), [scans]);

  return (
    <div className="space-y-4">
      <AdminBreadcrumbs items={[{ label: 'Skanningar', href: '/admin/scans' }]} />

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Skanningar ({stats.total})</h1>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-1" /> Uppdatera
        </Button>
      </div>

      {/* Quick stats */}
      <div className="flex gap-3 text-xs text-muted-foreground">
        <span>{stats.total} skanningar</span>
        <span>•</span>
        <span>{stats.totalIssues} totala problem</span>
        <span>•</span>
        <span>Genomsnitt: {stats.avgScore}%</span>
      </div>

      <ScrollArea className="h-[65vh]">
        <div className="space-y-1.5">
          {isLoading && <p className="text-sm text-muted-foreground p-4">Laddar...</p>}
          {!isLoading && scans.length === 0 && <p className="text-sm text-muted-foreground p-4">Inga skanningar hittade.</p>}
          {scans.map(scan => {
            const isOpen = expandedId === scan.id;
            const scoreColor = (scan.overall_score || 0) >= 80 ? 'text-green-600' : (scan.overall_score || 0) >= 50 ? 'text-amber-600' : 'text-red-600';
            return (
              <Card
                key={scan.id}
                className="border-border/50 cursor-pointer hover:shadow-sm transition-shadow"
                onClick={() => setExpandedId(isOpen ? null : scan.id)}
              >
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <Radar className="h-4 w-4 text-primary shrink-0" />
                    <span className="text-sm font-medium flex-1">{scan.scan_type || 'full_scan'}</span>
                    {scan.overall_score != null && (
                      <span className={cn('text-sm font-bold tabular-nums', scoreColor)}>
                        {scan.overall_score}%
                      </span>
                    )}
                    <Badge variant="outline" className="text-[10px]">
                      {scan.issues_count || 0} problem
                    </Badge>
                    {scan.overall_status === 'healthy' ? (
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                    ) : scan.overall_status === 'warning' ? (
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                    ) : scan.overall_status === 'critical' ? (
                      <AlertTriangle className="w-4 h-4 text-red-500" />
                    ) : null}
                    <span className="text-[10px] text-muted-foreground">{format(new Date(scan.created_at), 'dd MMM HH:mm')}</span>
                    {isOpen ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                  </div>
                  {isOpen && (
                    <div className="mt-3 pt-3 border-t border-border/50 space-y-2 text-sm">
                      {scan.executive_summary && <p className="text-muted-foreground">{scan.executive_summary}</p>}
                      <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground">
                        {scan.scanned_by && <span>Av: {scan.scanned_by}</span>}
                        {scan.tasks_created != null && <span>Uppgifter skapade: {scan.tasks_created}</span>}
                        <span>ID: {scan.id.slice(0, 8)}</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
};

export default AdminScans;
