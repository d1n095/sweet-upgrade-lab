import { useState, useEffect } from 'react';
import { Loader2, Lightbulb, CheckCircle, Wrench, Radar, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { callAI } from './_shared';

export const ContentValidationTab = () => {
  const [loading, setLoading] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [result, setResult] = useState<any>(null);

  // Load last scan on mount
  useEffect(() => {
    (supabase.from('ai_scan_results') as any)
      .select('results, created_at')
      .eq('scan_type', 'content_validation')
      .order('created_at', { ascending: false })
      .limit(1)
      .then(({ data }: any) => { if (data?.[0]) setResult(data[0].results); });
  }, []);

  const runScan = async (autoFix = false) => {
    if (autoFix) setFixing(true); else setLoading(true);
    try {
      const data = await callAI('content_validation', { auto_fix: autoFix });
      if (data) {
        setResult(data);
        if (autoFix && data.auto_fixed > 0) toast.success(`${data.auto_fixed} problem åtgärdade automatiskt`);
      }
    } catch { toast.error('Content validation misslyckades'); }
    finally { setLoading(false); setFixing(false); }
  };

  const sevColor = (s: string) => {
    if (s === 'critical') return 'bg-destructive/15 text-destructive border-destructive/30';
    if (s === 'high') return 'bg-destructive/10 text-destructive border-destructive/20';
    return 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20';
  };

  const fixableCount = result?.mismatches?.filter((m: any) => m.auto_fixable && !m.fixed)?.length || 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold flex items-center gap-2"><Eye className="w-5 h-5 text-primary" /> Content Validation Engine</h3>
          <p className="text-sm text-muted-foreground">Verifierar att alla påståenden i UI:t matchar verklig systemdata.</p>
        </div>
        <div className="flex gap-2">
          {fixableCount > 0 && (
            <Button onClick={() => runScan(true)} disabled={fixing} size="sm" variant="default">
              {fixing ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Wrench className="w-4 h-4 mr-1" />}
              Auto-fix ({fixableCount})
            </Button>
          )}
          <Button onClick={() => runScan(false)} disabled={loading} size="sm" variant="outline">
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Radar className="w-4 h-4 mr-1" />}
            Validera
          </Button>
        </div>
      </div>

      {result && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="border-border">
              <CardContent className="pt-4 pb-4 text-center">
                <p className="text-3xl font-bold" style={{ color: result.score >= 80 ? 'hsl(var(--primary))' : result.score >= 50 ? 'hsl(45,100%,40%)' : 'hsl(var(--destructive))' }}>{result.score}</p>
                <p className="text-xs text-muted-foreground">Content Score</p>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardContent className="pt-4 pb-4 text-center">
                <p className="text-3xl font-bold">{result.mismatches?.length || 0}</p>
                <p className="text-xs text-muted-foreground">Mismatches</p>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardContent className="pt-4 pb-4 text-center">
                <p className="text-3xl font-bold text-primary">{result.auto_fixed || 0}</p>
                <p className="text-xs text-muted-foreground">Auto-fixade</p>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardContent className="pt-4 pb-4 text-center">
                <p className="text-3xl font-bold">{result.tasks_created || 0}</p>
                <p className="text-xs text-muted-foreground">Tasks skapade</p>
              </CardContent>
            </Card>
          </div>

          {result.fixes?.length > 0 && (
            <Card className="border-border">
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><CheckCircle className="w-4 h-4 text-primary" /> Automatiskt åtgärdat</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {result.fixes.map((f: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-sm p-2 rounded bg-primary/5 border border-primary/10">
                      <CheckCircle className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span className="font-medium">{f.target}</span>
                      <span className="text-muted-foreground">— {f.result}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {result.mismatches?.length > 0 && (
            <Card className="border-border">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Innehållsavvikelser</CardTitle></CardHeader>
              <CardContent>
                <ScrollArea className="max-h-[400px]">
                  <div className="space-y-2">
                    {result.mismatches.map((m: any, i: number) => (
                      <div key={i} className={cn('p-3 rounded-lg border border-border bg-card space-y-1', m.fixed && 'opacity-50')}>
                        <div className="flex items-start gap-2">
                          <Badge variant="outline" className={cn('text-[10px] shrink-0', sevColor(m.severity))}>{m.severity}</Badge>
                          {m.fixed && <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">Fixad</Badge>}
                          {m.auto_fixable && !m.fixed && <Badge variant="outline" className="text-[10px] bg-accent/10 text-accent-foreground border-accent/20">Auto-fixbar</Badge>}
                          <p className="text-sm font-medium">{m.claim}</p>
                        </div>
                        <p className="text-xs text-muted-foreground"><span className="font-medium">Verklighet:</span> {m.reality}</p>
                        <p className="text-xs text-muted-foreground"><span className="font-medium">Källa:</span> {m.source}</p>
                        <div className="flex items-center gap-1 mt-1">
                          <Lightbulb className="w-3 h-3 text-yellow-500" />
                          <p className="text-xs text-foreground/70">{m.suggestion}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {result.mismatches?.length === 0 && (
            <Card className="border-border">
              <CardContent className="py-8 text-center">
                <CheckCircle className="w-10 h-10 text-primary mx-auto mb-2" />
                <p className="font-medium">Allt stämmer!</p>
                <p className="text-sm text-muted-foreground">Inga innehållsavvikelser hittade.</p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
};


// ── Pattern Detection Tab ──
