import { useState, useEffect } from 'react';
import { Loader2, CheckCircle, Wrench, ArrowRightLeft, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { callAI, useDetailContext } from './_shared';

export const SyncScannerTab = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [filter, setFilter] = useState('all');
  const { openDetail } = useDetailContext();

  const { data: lastScan } = useQuery({
    queryKey: ['sync-scan-last'],
    queryFn: async () => {
      const { data } = await supabase.from('ai_scan_results' as any).select('*').eq('scan_type', 'sync_scan').order('created_at', { ascending: false }).limit(1) as any;
      return data?.[0] || null;
    },
  });

  useEffect(() => {
    if (lastScan && !result) setResult((lastScan as any).results);
  }, [lastScan]);

  const runScan = async () => {
    setLoading(true);
    try {
      const res = await callAI('sync_scan');
      if (res) { setResult(res); toast.success(`Sync-skanning klar — ${res.issues_found || 0} problem, ${res.auto_fixed_count || 0} auto-fixade`); }
    } finally { setLoading(false); }
  };

  const createTask = async (issue: any) => {
    const res = await callAI('create_action', { title: `Sync: ${issue.title}`, description: `${issue.description}\n\nÅtgärd: ${issue.fix_action}`, priority: issue.severity, category: 'data_integrity', source_type: 'sync_scan' });
    if (res?.work_item_id) { toast.success('Uppgift skapad'); openDetail(res.work_item_id); }
  };

  const sevColor = (s: string) => s === 'critical' ? 'text-destructive' : s === 'high' ? 'text-orange-500' : s === 'medium' ? 'text-yellow-500' : 'text-muted-foreground';
  const scoreColor = (s: number) => s >= 80 ? 'text-accent' : s >= 50 ? 'text-yellow-500' : 'text-destructive';

  const filteredIssues = result?.issues?.filter((i: any) => filter === 'all' || i.severity === filter || i.type === filter) || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2"><ArrowRightLeft className="w-5 h-5" /> Sync Scanner</h2>
          <p className="text-xs text-muted-foreground">Upptäcker frontend-backend inkonsekvenser automatiskt</p>
        </div>
        <Button onClick={runScan} disabled={loading} size="sm" className="gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          {loading ? 'Skannar...' : 'Kör Sync-skanning'}
        </Button>
      </div>

      {lastScan && !result && (
        <p className="text-xs text-muted-foreground">Senaste skanning: {new Date((lastScan as any).created_at).toLocaleString('sv-SE')}</p>
      )}

      {result && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="p-3">
              <div className="text-xs text-muted-foreground mb-1">Sync Score</div>
              <div className={cn('text-2xl font-bold', scoreColor(result.sync_score))}>{result.sync_score}/100</div>
              <Progress value={result.sync_score} className="h-1.5 mt-1" />
            </Card>
            <Card className="p-3">
              <div className="text-xs text-muted-foreground mb-1">Problem</div>
              <div className={cn('text-2xl font-bold', result.issues_found > 0 ? 'text-destructive' : 'text-accent')}>{result.issues_found}</div>
            </Card>
            <Card className="p-3">
              <div className="text-xs text-muted-foreground mb-1">Auto-fixade</div>
              <div className="text-2xl font-bold text-accent">{result.auto_fixed_count || 0}</div>
            </Card>
            <Card className="p-3">
              <div className="text-xs text-muted-foreground mb-1">Uppgifter skapade</div>
              <div className="text-2xl font-bold text-primary">{result.tasks_created || 0}</div>
            </Card>
          </div>

          <Card className="p-4"><p className="text-sm">{result.executive_summary}</p></Card>

          {/* Auto-fixed summary */}
          {result.auto_fixed?.length > 0 && (
            <Card className="p-4 border-accent/30 bg-accent/5">
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5"><CheckCircle className="w-4 h-4 text-accent" /> Automatiskt åtgärdat</h3>
              <ul className="space-y-1">
                {result.auto_fixed.map((f: any, i: number) => (
                  <li key={i} className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <CheckCircle className="w-3 h-3 text-accent shrink-0" /> {f.action} ({f.count} st)
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {/* Filters */}
          {result.issues?.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {['all', 'critical', 'high', 'medium', 'low'].map(f => (
                <Button key={f} size="sm" variant={filter === f ? 'default' : 'outline'} className="h-7 text-xs" onClick={() => setFilter(f)}>
                  {f === 'all' ? `Alla (${result.issues.length})` : f.charAt(0).toUpperCase() + f.slice(1)}
                </Button>
              ))}
            </div>
          )}

          {/* Issues */}
          <ScrollArea className="max-h-[50vh]">
            <div className="space-y-3">
              {filteredIssues.map((issue: any, i: number) => (
                <Card key={i} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={cn('font-semibold text-sm', sevColor(issue.severity))}>{issue.title}</span>
                        <Badge variant="outline" className="text-[10px]">{issue.severity}</Badge>
                        <Badge variant="secondary" className="text-[10px]">{syncTypeLabels[issue.type] || issue.type}</Badge>
                        <Badge variant="secondary" className="text-[10px]">{issue.affected_count} påverkade</Badge>
                        {issue.can_auto_fix && <Badge className="text-[10px] bg-accent/20 text-accent border-accent/30">Auto-fixbar</Badge>}
                      </div>
                      <p className="text-sm mb-2">{issue.description}</p>
                      <p className="text-xs text-muted-foreground"><strong>Åtgärd:</strong> {issue.fix_action}</p>
                    </div>
                    {!issue.can_auto_fix && (
                      <Button size="sm" variant="outline" className="shrink-0 h-8 text-xs gap-1" onClick={() => createTask(issue)}>
                        <Wrench className="w-3 h-3" /> Skapa uppgift
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
              {filteredIssues.length === 0 && result.issues?.length === 0 && (
                <Card className="p-6 text-center"><CheckCircle className="w-8 h-8 text-accent mx-auto mb-2" /><p className="text-sm font-medium">Inga sync-problem hittade! Frontend och backend är synkroniserade.</p></Card>
              )}
            </div>
          </ScrollArea>
        </>
      )}
    </div>
  );
};

// ── Action Governor Tab (Lovable 0.5) ──
