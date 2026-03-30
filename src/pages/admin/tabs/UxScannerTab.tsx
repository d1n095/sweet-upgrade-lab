import { useState, useEffect } from 'react';
import { Loader2, CheckCircle, Zap, TrendingUp, AlertCircle, Wrench, Smartphone, Eye, Compass, Play, Settings2, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { callAI, useDetailContext } from './_shared';

const categoryLabels: Record<string, string> = {
  navigation: 'Navigering', clickability: 'Klickbarhet', scroll: 'Scroll',
  mobile: 'Mobil', forms: 'Formulär', loading: 'Laddning',
  conversion: 'Konvertering', accessibility: 'Tillgänglighet',
};
const catIcon = (c: string) => {
  const icons: Record<string, any> = { navigation: Compass, clickability: Zap, scroll: Maximize2, mobile: Smartphone, forms: Settings2, loading: Loader2, conversion: TrendingUp, accessibility: Eye };
  const Icon = icons[c] || AlertCircle;
  return <Icon className="w-3.5 h-3.5" />;
};

export const UxScannerTab = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [filter, setFilter] = useState('all');
  const { openDetail } = useDetailContext();

  const { data: lastScan } = useQuery({
    queryKey: ['ux-scan-last'],
    queryFn: async () => {
      const { data } = await supabase.from('ai_scan_results' as any).select('*').eq('scan_type', 'ux_scan').order('created_at', { ascending: false }).limit(1) as any;
      return data?.[0] || null;
    },
  });

  useEffect(() => {
    if (lastScan && !result) setResult((lastScan as any).results);
  }, [lastScan]);

  const runScan = async () => {
    setLoading(true);
    try {
      const res = await callAI('ux_scan');
      if (res) { setResult(res); toast.success(`UX-skanning klar — ${res.issues_found || 0} problem`); }
    } finally { setLoading(false); }
  };

  const createTask = async (issue: any) => {
    const res = await callAI('create_action', { title: `UX: ${issue.title}`, description: `${issue.description}\n\nPåverkan: ${issue.user_impact}\nFix: ${issue.fix_suggestion}`, priority: issue.severity, category: issue.category, source_type: 'ux_scan' });
    if (res?.work_item_id) { toast.success('Uppgift skapad'); openDetail(res.work_item_id); }
  };

  const sevColor = (s: string) => s === 'critical' ? 'text-destructive' : s === 'high' ? 'text-orange-500' : s === 'medium' ? 'text-yellow-500' : 'text-muted-foreground';
  const scoreColor = (s: number) => s >= 80 ? 'text-accent' : s >= 50 ? 'text-yellow-500' : 'text-destructive';

  const filteredIssues = result?.issues?.filter((i: any) => filter === 'all' || i.severity === filter || i.category === filter) || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2"><Eye className="w-5 h-5" /> UX Scanner</h2>
          <p className="text-xs text-muted-foreground">AI-driven analys av användarupplevelsen</p>
        </div>
        <Button onClick={runScan} disabled={loading} size="sm" className="gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          {loading ? 'Skannar...' : 'Kör UX-skanning'}
        </Button>
      </div>

      {lastScan && !result && (
        <p className="text-xs text-muted-foreground">Senaste skanning: {new Date((lastScan as any).created_at).toLocaleString('sv-SE')}</p>
      )}

      {result && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="p-3">
              <div className="text-xs text-muted-foreground mb-1">UX Score</div>
              <div className={cn('text-2xl font-bold', scoreColor(result.ux_score))}>{result.ux_score}/100</div>
              <Progress value={result.ux_score} className="h-1.5 mt-1" />
            </Card>
            <Card className="p-3">
              <div className="text-xs text-muted-foreground mb-1">Problem</div>
              <div className={cn('text-2xl font-bold', result.issues_found > 0 ? 'text-destructive' : 'text-accent')}>{result.issues_found}</div>
            </Card>
            <Card className="p-3">
              <div className="text-xs text-muted-foreground mb-1">Uppgifter skapade</div>
              <div className="text-2xl font-bold text-primary">{result.tasks_created || 0}</div>
            </Card>
            <Card className="p-3">
              <div className="text-xs text-muted-foreground mb-1">Positiva fynd</div>
              <div className="text-2xl font-bold text-accent">{result.positive_findings?.length || 0}</div>
            </Card>
          </div>

          <Card className="p-4"><p className="text-sm">{result.executive_summary}</p></Card>

          {/* Filters */}
          {result.issues?.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {['all', 'critical', 'high', 'medium', 'low'].map(f => (
                <Button key={f} size="sm" variant={filter === f ? 'default' : 'outline'} className="h-7 text-xs" onClick={() => setFilter(f)}>
                  {f === 'all' ? `Alla (${result.issues.length})` : f.charAt(0).toUpperCase() + f.slice(1)}
                </Button>
              ))}
              <Separator orientation="vertical" className="h-7 mx-1" />
              {Object.keys(categoryLabels).map(c => {
                const count = result.issues.filter((i: any) => i.category === c).length;
                if (count === 0) return null;
                return (
                  <Button key={c} size="sm" variant={filter === c ? 'default' : 'outline'} className="h-7 text-xs gap-1" onClick={() => setFilter(filter === c ? 'all' : c)}>
                    {catIcon(c)} {categoryLabels[c]} ({count})
                  </Button>
                );
              })}
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
                        {catIcon(issue.category)}
                        <span className={cn('font-semibold text-sm', sevColor(issue.severity))}>{issue.title}</span>
                        <Badge variant="outline" className="text-[10px]">{issue.severity}</Badge>
                        <Badge variant="secondary" className="text-[10px]">{categoryLabels[issue.category] || issue.category}</Badge>
                        {issue.can_auto_fix && <Badge className="text-[10px] bg-accent/20 text-accent border-accent/30">Auto-fixbar</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground mb-1">Sida: {issue.page}</p>
                      <p className="text-sm mb-2">{issue.description}</p>
                      <div className="text-xs space-y-1">
                        <p><strong>Påverkan:</strong> {issue.user_impact}</p>
                        <p><strong>Föreslagen fix:</strong> {issue.fix_suggestion}</p>
                      </div>
                    </div>
                    <Button size="sm" variant="outline" className="shrink-0 h-8 text-xs gap-1" onClick={() => createTask(issue)}>
                      <Wrench className="w-3 h-3" /> Skapa uppgift
                    </Button>
                  </div>
                </Card>
              ))}
              {filteredIssues.length === 0 && result.issues?.length === 0 && (
                <Card className="p-6 text-center"><CheckCircle className="w-8 h-8 text-accent mx-auto mb-2" /><p className="text-sm font-medium">Inga UX-problem hittade!</p></Card>
              )}
            </div>
          </ScrollArea>

          {/* Positive findings */}
          {result.positive_findings?.length > 0 && (
            <Card className="p-4">
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5"><CheckCircle className="w-4 h-4 text-accent" /> Bra UX-mönster</h3>
              <ul className="space-y-1">
                {result.positive_findings.map((f: string, i: number) => (
                  <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                    <CheckCircle className="w-3 h-3 text-accent shrink-0 mt-0.5" /> {f}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}
    </div>
  );
};
