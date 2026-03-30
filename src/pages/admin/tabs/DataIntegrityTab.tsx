import { useState, useEffect } from 'react';
import { Loader2, CheckCircle, Radar, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { callAI } from './_shared';

export const DataIntegrityTab = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  // Load last scan on mount
  useEffect(() => {
    (supabase.from('ai_scan_results') as any)
      .select('results, created_at')
      .eq('scan_type', 'data_integrity')
      .order('created_at', { ascending: false })
      .limit(1)
      .then(({ data }: any) => { if (data?.[0]) setResult(data[0].results); });
  }, []);

  const runScan = async () => {
    setLoading(true);
    try {
      const data = await callAI('data_integrity');
      if (data) setResult(data);
    } catch { toast.error('Integrity scan misslyckades'); }
    finally { setLoading(false); }
  };

  const sevColor = (s: string) => {
    if (s === 'critical') return 'bg-destructive/15 text-destructive border-destructive/30';
    if (s === 'high') return 'bg-destructive/10 text-destructive border-destructive/20';
    return 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-primary" /> Data Integrity Validator</h3>
          <p className="text-sm text-muted-foreground">Skannar systemet efter datainkonsekvenser, brutna relationer och felaktiga tillstånd.</p>
        </div>
        <Button onClick={runScan} disabled={loading} size="sm">
          {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Radar className="w-4 h-4 mr-1" />}
          Kör skanning
        </Button>
      </div>

      {result && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Card className="border-border">
              <CardContent className="pt-4 pb-4 text-center">
                <p className="text-3xl font-bold" style={{ color: result.score >= 80 ? 'hsl(var(--primary))' : result.score >= 50 ? 'hsl(45,100%,40%)' : 'hsl(var(--destructive))' }}>{result.score}</p>
                <p className="text-xs text-muted-foreground">Health Score</p>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardContent className="pt-4 pb-4 text-center">
                <p className="text-3xl font-bold">{result.issues?.length || 0}</p>
                <p className="text-xs text-muted-foreground">Problem hittade</p>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardContent className="pt-4 pb-4 text-center">
                <p className="text-3xl font-bold text-primary">{result.tasks_created || 0}</p>
                <p className="text-xs text-muted-foreground">Tasks skapade</p>
              </CardContent>
            </Card>
          </div>

          {result.issues?.length > 0 && (
            <Card className="border-border">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Hittade problem</CardTitle></CardHeader>
              <CardContent>
                <ScrollArea className="max-h-[400px]">
                  <div className="space-y-2">
                    {result.issues.map((issue: any, i: number) => (
                      <div key={i} className="flex items-start gap-2 p-2 rounded-lg border border-border bg-card">
                        <Badge variant="outline" className={cn('text-[10px] shrink-0', sevColor(issue.severity))}>{issue.severity}</Badge>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{issue.title}</p>
                          <p className="text-xs text-muted-foreground">{issue.detail}</p>
                          <Badge variant="secondary" className="text-[10px] mt-1">{issue.type}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {result.issues?.length === 0 && (
            <Card className="border-border">
              <CardContent className="py-8 text-center">
                <CheckCircle className="w-10 h-10 text-primary mx-auto mb-2" />
                <p className="font-medium">Allt ser bra ut!</p>
                <p className="text-sm text-muted-foreground">Inga datainkonsekvenser hittade.</p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
};

// ── Content Validation Tab ──
