import { useState, useEffect } from 'react';
import { Copy, Loader2, CheckCircle, Radar, ArrowRight, GitMerge } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { callAI, useDetailContext } from './_shared';

export const PatternDetectionTab = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const { openDetail } = useDetailContext();

  // Load last scan on mount
  useEffect(() => {
    (supabase.from('ai_scan_results') as any)
      .select('results, created_at')
      .eq('scan_type', 'pattern_detection')
      .order('created_at', { ascending: false })
      .limit(1)
      .then(({ data }: any) => { if (data?.[0]) setResult(data[0].results); });
  }, []);

  const runScan = async () => {
    setLoading(true);
    try {
      const data = await callAI('pattern_detection');
      if (data) setResult(data);
    } catch { toast.error('Pattern detection misslyckades'); }
    finally { setLoading(false); }
  };

  const prioColor = (p: string) => {
    if (p === 'critical') return 'bg-destructive/15 text-destructive border-destructive/30';
    if (p === 'high') return 'bg-destructive/10 text-destructive border-destructive/20';
    if (p === 'medium') return 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20';
    return 'bg-muted text-muted-foreground border-border';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold flex items-center gap-2"><GitMerge className="w-5 h-5 text-primary" /> Pattern Detection Engine</h3>
          <p className="text-sm text-muted-foreground">AI analyserar likheter, grupperar problem och identifierar rotorsaker.</p>
        </div>
        <Button onClick={runScan} disabled={loading} size="sm">
          {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Radar className="w-4 h-4 mr-1" />}
          Analysera mönster
        </Button>
      </div>

      {result && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="border-border">
              <CardContent className="pt-4 pb-4 text-center">
                <p className="text-3xl font-bold">{result.total_items_analyzed || 0}</p>
                <p className="text-xs text-muted-foreground">Analyserade</p>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardContent className="pt-4 pb-4 text-center">
                <p className="text-3xl font-bold text-primary">{result.clusters?.length || 0}</p>
                <p className="text-xs text-muted-foreground">Kluster</p>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardContent className="pt-4 pb-4 text-center">
                <p className="text-3xl font-bold">{result.links_created || 0}</p>
                <p className="text-xs text-muted-foreground">Länkar skapade</p>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardContent className="pt-4 pb-4 text-center">
                <p className="text-3xl font-bold">{result.master_tasks_created || 0}</p>
                <p className="text-xs text-muted-foreground">Root tasks</p>
              </CardContent>
            </Card>
          </div>

          {result.clusters?.length > 0 && (
            <ScrollArea className="max-h-[50vh]"><div className="space-y-3 pr-2">
              {result.clusters.map((c: any, i: number) => (
                <Card key={i} className="border-border">
                  <CardContent className="pt-4 pb-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-semibold text-sm">{c.label}</h4>
                        <Badge variant="outline" className={cn('text-[10px]', prioColor(c.priority))}>{c.priority}</Badge>
                        <Badge variant="secondary" className="text-[10px]">{c.category}</Badge>
                        <Badge variant="outline" className="text-[10px]">{c.affected_count} issues</Badge>
                      </div>
                      {c.master_id && (
                        <Button size="sm" variant="ghost" className="text-xs shrink-0" onClick={() => openDetail(c.master_id)}>
                          <ArrowRight className="w-3 h-3 mr-1" /> Visa
                        </Button>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Rotorsak</p>
                        <p className="text-sm">{c.root_cause}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Föreslagen fix</p>
                        <p className="text-sm">{c.fix_suggestion}</p>
                      </div>
                    </div>
                    {c.lovable_prompt && (
                      <div className="relative">
                        <pre className="text-xs bg-muted/50 border border-border rounded-lg p-3 whitespace-pre-wrap max-h-32 overflow-auto">{c.lovable_prompt}</pre>
                        <Button
                          size="sm" variant="ghost"
                          className="absolute top-1 right-1 h-6 w-6 p-0"
                          onClick={() => { navigator.clipboard.writeText(c.lovable_prompt); toast.success('Kopierad'); }}
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div></ScrollArea>
          )}

          {result.clusters?.length === 0 && (
            <Card className="border-border">
              <CardContent className="py-8 text-center">
                <CheckCircle className="w-10 h-10 text-primary mx-auto mb-2" />
                <p className="font-medium">Inga mönster hittade</p>
                <p className="text-sm text-muted-foreground">Alla problem verkar vara unika.</p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
};

