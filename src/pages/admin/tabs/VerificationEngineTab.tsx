import { useState } from 'react';
import { Copy, Loader2, Lightbulb, RefreshCw, CheckCircle, XCircle, ArrowRight, GitMerge, ArrowRightLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { callAI, copyToClipboard } from './_shared';

export const VerificationEngineTab = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const run = async () => {
    setLoading(true);
    const r = await callAI('verification_engine');
    if (r) {
      setResult(r);
      toast.success(`Verifiering klar – ${r.false_done_items?.length || 0} falska done, ${r.auto_closed_items?.length || 0} auto-stängda, ${r.tasks_created || 0} nya`);
    }
    setLoading(false);
  };

  const scoreColor = (s: number) => s >= 70 ? 'text-green-700' : s >= 40 ? 'text-yellow-700' : 'text-red-700';

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">AI Verification Engine</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Verifierar avslutade uppgifter, hittar falska "done", auto-stänger lösta, föreslår förbättringar.
        </p>
        <Button onClick={run} disabled={loading} className="gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Kör verifiering
        </Button>
      </Card>

      {result && (
        <div className="space-y-4">
          {/* Score */}
          <Card className="p-4">
            <div className="flex items-center gap-4">
              <div className={cn('text-3xl font-bold', scoreColor(result.verification_score || 0))}>
                {result.verification_score || 0}
              </div>
              <div>
                <p className="font-medium">Verification Score</p>
                <p className="text-xs text-muted-foreground">{result.summary}</p>
              </div>
            </div>
          </Card>

          {/* Stats row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Card className="p-3 text-center">
              <p className="text-2xl font-bold text-destructive">{result.false_done_items?.length || 0}</p>
              <p className="text-xs text-muted-foreground">Falska "done" återöppnade</p>
            </Card>
            <Card className="p-3 text-center">
              <p className="text-2xl font-bold text-primary">{result.auto_closed_items?.length || 0}</p>
              <p className="text-xs text-muted-foreground">Auto-stängda</p>
            </Card>
            <Card className="p-3 text-center">
              <p className="text-2xl font-bold">{result.tasks_created || 0}</p>
              <p className="text-xs text-muted-foreground">Nya förbättringar</p>
            </Card>
          </div>

          {/* False done items */}
          {result.false_done_items?.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><XCircle className="w-4 h-4 text-destructive" /> Falska "done" (återöppnade)</CardTitle></CardHeader>
              <CardContent><ScrollArea className="max-h-[50vh]"><div className="space-y-2 pr-2">
                {result.false_done_items.map((item: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-sm border-b border-border pb-2">
                    <Badge variant="destructive" className="text-[9px]">Återöppnad</Badge>
                    <span className="font-medium">{item.title}</span>
                    <span className="text-muted-foreground text-xs">— {item.reason}</span>
                  </div>
                ))}
              </div></ScrollArea></CardContent>
            </Card>
          )}

          {/* Auto-closed items */}
          {result.auto_closed_items?.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><CheckCircle className="w-4 h-4 text-primary" /> Auto-stängda</CardTitle></CardHeader>
              <CardContent><ScrollArea className="max-h-[50vh]"><div className="space-y-2 pr-2">
                {result.auto_closed_items.map((item: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-sm border-b border-border pb-2">
                    <Badge variant="secondary" className="text-[9px]">Stängd</Badge>
                    <span>{item.title}</span>
                    <span className="text-muted-foreground text-xs">— {item.reason}</span>
                  </div>
                ))}
              </div></ScrollArea></CardContent>
            </Card>
          )}

          {/* Post-fix suggestions */}
          {result.post_fix_suggestions?.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Lightbulb className="w-4 h-4 text-yellow-500" /> Post-fix förbättringar</CardTitle></CardHeader>
              <CardContent><ScrollArea className="max-h-[50vh]"><div className="space-y-3 pr-2">
                {result.post_fix_suggestions.map((s: any, i: number) => (
                  <div key={i} className="border border-border rounded-lg p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge variant={s.priority === 'high' ? 'destructive' : 'secondary'} className="text-[9px]">{s.priority}</Badge>
                      <Badge variant="outline" className="text-[9px]">{s.type}</Badge>
                      <span className="text-sm font-medium">{s.suggestion}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Relaterad: {s.related_task}</p>
                    {s.lovable_prompt && (
                      <div className="bg-muted/50 rounded p-2 text-xs">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium">Lovable Prompt</span>
                          <Button size="sm" variant="ghost" className="h-5 px-1.5 text-[9px]" onClick={() => copyToClipboard(s.lovable_prompt)}>
                            <Copy className="w-3 h-3" />
                          </Button>
                        </div>
                        <p className="whitespace-pre-wrap">{s.lovable_prompt}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div></ScrollArea></CardContent>
            </Card>
          )}

          {/* Recategorizations */}
          {result.recategorizations?.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><ArrowRightLeft className="w-4 h-4" /> Omkategoriseringar</CardTitle></CardHeader>
              <CardContent><ScrollArea className="max-h-[50vh]"><div className="space-y-2 pr-2">
                {result.recategorizations.map((r: any, i: number) => (
                  <div key={i} className="text-sm border-b border-border pb-2">
                    <span className="font-medium">{r.task_title}</span>
                    <div className="flex items-center gap-1 mt-1">
                      <Badge variant="outline" className="text-[9px]">{r.current_type}</Badge>
                      <ArrowRight className="w-3 h-3" />
                      <Badge variant="default" className="text-[9px]">{r.suggested_type}</Badge>
                      <span className="text-xs text-muted-foreground ml-1">{r.reason}</span>
                    </div>
                  </div>
                ))}
              </div></ScrollArea></CardContent>
            </Card>
          )}

          {/* Merge suggestions */}
          {result.merge_suggestions?.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><GitMerge className="w-4 h-4" /> Merge-förslag</CardTitle></CardHeader>
              <CardContent><ScrollArea className="max-h-[50vh]"><div className="space-y-2 pr-2">
                {result.merge_suggestions.map((m: any, i: number) => (
                  <div key={i} className="text-sm border-b border-border pb-2 space-y-1">
                    {m.tasks.map((t: string, j: number) => <p key={j} className="text-xs">• {t}</p>)}
                    <p className="text-xs text-muted-foreground">{m.reason}</p>
                  </div>
                ))}
              </div></ScrollArea></CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};

// ── Auto Cleanup System ──
