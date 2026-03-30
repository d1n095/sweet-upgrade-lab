import { useState, useEffect } from 'react';
import { Copy, Loader2, CheckCircle, Wrench, Radar, Monitor, Smartphone, Tablet, Eye, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { createWorkItemWithDedup } from '@/utils/workItemDedup';
import { callAI } from './_shared';

interface OverflowIssue {
  title: string; page: string; container: string; severity: string; breakpoint: string;
  overflow_type: string; description: string; css_fix: string; auto_fixable: boolean; lovable_prompt: string;
}
interface SafeContainer { page: string; container: string; reason: string }
interface OverflowResult {
  overflow_score: number; total_containers_checked: number; issues_found: number;
  executive_summary: string; issues: OverflowIssue[]; safe_containers: SafeContainer[]; tasks_created: number;
}

export const OverflowScanTab = () => {
  const [result, setResult] = useState<OverflowResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<string>('all');

  // Load last scan on mount
  useEffect(() => {
    (supabase.from('ai_scan_results') as any)
      .select('results, created_at')
      .eq('scan_type', 'ui_overflow_scan')
      .order('created_at', { ascending: false })
      .limit(1)
      .then(({ data }: any) => { if (data?.[0]) setResult(data[0].results); });
  }, []);

  const run = async () => {
    setLoading(true);
    const r = await callAI('ui_overflow_scan');
    if (r) { setResult(r); toast.success(`Overflow-skanning klar – ${r.issues_found || 0} problem`); }
    setLoading(false);
  };

  const sevColor = (s: string) => s === 'critical' ? 'text-destructive' : s === 'high' ? 'text-orange-500' : s === 'medium' ? 'text-yellow-500' : 'text-muted-foreground';
  const scoreColor = (s: number) => s >= 80 ? 'text-accent' : s >= 50 ? 'text-yellow-500' : 'text-destructive';
  const bpIcon = (bp: string) => bp === 'mobile' ? <Smartphone className="w-3.5 h-3.5" /> : bp === 'tablet' ? <Tablet className="w-3.5 h-3.5" /> : bp === 'desktop' ? <Monitor className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />;

  const overflowTypeLabel: Record<string, string> = {
    vertical_clip: 'Vertikal klippning', horizontal_clip: 'Horisontell klippning', no_scroll: 'Ingen scroll',
    flex_overflow: 'Flex overflow', modal_overflow: 'Modal overflow', table_overflow: 'Tabell overflow',
    text_overflow: 'Text overflow', dropdown_clip: 'Dropdown klippt',
  };

  const filteredIssues = result?.issues?.filter(i => filter === 'all' || i.severity === filter || i.overflow_type === filter) || [];

  const createTaskFromIssue = async (issue: OverflowIssue) => {
    try {
      const dedupResult = await createWorkItemWithDedup({
        title: `[Overflow] ${issue.title}`.substring(0, 200),
        description: `${issue.description}\n\nSida: ${issue.page}\nContainer: ${issue.container}\nBreakpoint: ${issue.breakpoint}\nTyp: ${issue.overflow_type}\n\nCSS Fix: ${issue.css_fix}`,
        priority: issue.severity === 'critical' ? 'critical' : issue.severity === 'high' ? 'high' : 'medium',
        item_type: 'bug',
        source_type: 'ai_detection',
        ai_detected: true,
        ai_confidence: 'high',
        ai_category: 'frontend',
        ai_type_classification: 'ui_overflow',
      });
      if (dedupResult.duplicate) {
        toast.info(`Ärende finns redan i masterlistan`);
      } else if (dedupResult.created) {
        toast.success(`Uppgift skapad: ${issue.title}`);
      } else {
        toast.error(dedupResult.error || 'Kunde inte skapa uppgift');
      }
    } catch { toast.error('Kunde inte skapa uppgift'); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2"><Maximize2 className="w-5 h-5 text-primary" /> UI Overflow Detection</h2>
          <p className="text-sm text-muted-foreground">AI skannar alla containers för overflow utan scroll</p>
        </div>
        <Button onClick={run} disabled={loading} className="gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Radar className="w-4 h-4" />}
          {loading ? 'Skannar...' : 'Kör Overflow-skanning'}
        </Button>
      </div>

      {!result && !loading && (
        <Card className="p-8 flex flex-col items-center justify-center text-center gap-3">
          <Maximize2 className="w-10 h-10 text-muted-foreground/40" />
          <h3 className="font-semibold text-muted-foreground">Ingen skanning har körts ännu</h3>
          <p className="text-sm text-muted-foreground/70 max-w-md">Klicka på "Kör Overflow-skanning" för att hitta containers där innehåll flödar över utan scroll.</p>
        </Card>
      )}

      {loading && (
        <Card className="p-8 flex flex-col items-center justify-center text-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Analyserar alla containers och breakpoints...</p>
        </Card>
      )}

      {result && (
        <>
          {/* Score + stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="p-3">
              <div className="text-xs text-muted-foreground mb-1">Overflow Score</div>
              <div className={cn('text-2xl font-bold', scoreColor(result.overflow_score))}>{result.overflow_score}</div>
              <Progress value={result.overflow_score} className="h-1.5 mt-1" />
            </Card>
            <Card className="p-3">
              <div className="text-xs text-muted-foreground mb-1">Containers kontrollerade</div>
              <div className="text-2xl font-bold">{result.total_containers_checked}</div>
            </Card>
            <Card className="p-3">
              <div className="text-xs text-muted-foreground mb-1">Problem hittade</div>
              <div className={cn('text-2xl font-bold', result.issues_found > 0 ? 'text-destructive' : 'text-accent')}>{result.issues_found}</div>
            </Card>
            <Card className="p-3">
              <div className="text-xs text-muted-foreground mb-1">Uppgifter skapade</div>
              <div className="text-2xl font-bold text-primary">{result.tasks_created}</div>
            </Card>
          </div>

          {/* Summary */}
          <Card className="p-4">
            <p className="text-sm">{result.executive_summary}</p>
          </Card>

          {/* Filter */}
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
              {filteredIssues.map((issue, i) => (
                <Card key={i} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={cn('font-semibold text-sm', sevColor(issue.severity))}>{issue.title}</span>
                        <Badge variant="outline" className="text-[10px]">{issue.severity}</Badge>
                        <Badge variant="secondary" className="text-[10px] gap-1">{bpIcon(issue.breakpoint)} {issue.breakpoint}</Badge>
                        <Badge variant="secondary" className="text-[10px]">{overflowTypeLabel[issue.overflow_type] || issue.overflow_type}</Badge>
                        {issue.auto_fixable && <Badge className="text-[10px] bg-accent/20 text-accent border-accent/30">Auto-fixbar</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground mb-1">{issue.page} → {issue.container}</p>
                      <p className="text-sm mb-2">{issue.description}</p>
                      <div className="bg-secondary/50 rounded-md p-2 mb-2">
                        <p className="text-xs font-mono text-muted-foreground">{issue.css_fix}</p>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5 shrink-0">
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => createTaskFromIssue(issue)}>
                        <Wrench className="w-3 h-3" /> Skapa uppgift
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => { navigator.clipboard.writeText(issue.lovable_prompt); toast.success('Prompt kopierad'); }}>
                        <Copy className="w-3 h-3" /> Prompt
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
              {filteredIssues.length === 0 && result.issues?.length > 0 && (
                <p className="text-center text-sm text-muted-foreground py-4">Inga problem matchar filtret</p>
              )}
            </div>
          </ScrollArea>

          {/* Safe containers */}
          {result.safe_containers?.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><CheckCircle className="w-4 h-4 text-accent" /> Säkra containers ({result.safe_containers.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="max-h-[200px]">
                  <div className="space-y-1">
                    {result.safe_containers.map((sc, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                        <CheckCircle className="w-3 h-3 text-accent shrink-0" />
                        <span className="font-medium">{sc.page}</span>
                        <span>→</span>
                        <span>{sc.container}</span>
                        <span className="text-muted-foreground/60">({sc.reason})</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
};
// ── UX Scanner Tab ──
