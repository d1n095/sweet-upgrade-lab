import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { resolveFailure } from '@/lib/failureMemory';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Brain, CheckCircle, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

const FailureMemoryPanel = () => {
  const { data: patterns, refetch } = useQuery({
    queryKey: ['failure-memory-hotspots'],
    queryFn: async () => {
      const { data } = await supabase
        .from('functional_failure_memory' as any)
        .select('*')
        .eq('is_resolved', false)
        .order('occurrence_count', { ascending: false })
        .limit(20);
      return (data as any[]) || [];
    },
  });

  const handleResolve = async (id: string) => {
    const ok = await resolveFailure(id);
    if (ok) {
      toast.success('Mönster markerat som löst');
      refetch();
    }
  };

  if (!patterns?.length) return null;

  return (
    <Card className="border-amber-500/30 bg-amber-500/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Brain className="w-4 h-4 text-amber-600" /> Failure Memory — Kända felhotspots ({patterns.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-[10px] text-muted-foreground mb-3">
          Systemet minns var åtgärder misslyckas. Dessa flöden prioriteras automatiskt vid nästa skanning.
        </p>
        <ScrollArea className="max-h-[40vh]">
          <div className="space-y-2 pr-2">
            {patterns.map((p: any) => (
              <div key={p.id} className="border border-border rounded-lg p-3 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={p.severity === 'critical' ? 'destructive' : p.severity === 'high' ? 'default' : 'secondary'} className="text-[10px]">
                      {p.severity}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      {p.occurrence_count}x
                    </Badge>
                    <span className="text-[10px] text-muted-foreground font-mono">{p.component}</span>
                  </div>
                  <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => handleResolve(p.id)}>
                    <CheckCircle className="w-3 h-3 mr-1" /> Löst
                  </Button>
                </div>
                <p className="text-xs font-semibold">{p.action_type}</p>
                <div className="flex gap-3 text-[10px] text-muted-foreground flex-wrap">
                  <span>📍 Steg: <code className="bg-muted px-1 rounded">{p.failed_step}</code></span>
                  <span>🎯 Entitet: {p.entity_type}</span>
                </div>
                {p.fail_reason && (
                  <p className="text-[10px] text-muted-foreground bg-muted/50 p-1.5 rounded truncate">{p.fail_reason}</p>
                )}
                <div className="flex gap-3 text-[8px] text-muted-foreground/60">
                  <span>Först sedd: {new Date(p.first_seen_at).toLocaleDateString('sv-SE')}</span>
                  <span>Senast: {new Date(p.last_seen_at).toLocaleDateString('sv-SE')}</span>
                  {p.last_scan_retest_at && (
                    <span className="flex items-center gap-0.5">
                      {p.last_retest_passed
                        ? <><CheckCircle className="w-2.5 h-2.5 text-green-600" /> Omtest OK</>
                        : <><AlertTriangle className="w-2.5 h-2.5 text-amber-600" /> Omtest misslyckat</>}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default FailureMemoryPanel;
