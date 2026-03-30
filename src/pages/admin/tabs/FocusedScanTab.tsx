import { useState, useEffect } from 'react';
import { Loader2, CheckCircle, Clock, Activity, TrendingUp, AlertCircle, Radar, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { callAI, useDetailContext } from './_shared';

export const FocusedScanTab = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const { openDetail } = useDetailContext();

  // Load last scan on mount
  useEffect(() => {
    (supabase.from('ai_scan_results') as any)
      .select('results, created_at, overall_score, overall_status, executive_summary')
      .eq('scan_type', 'focused_scan')
      .order('created_at', { ascending: false })
      .limit(1)
      .then(({ data }: any) => {
        if (data?.[0]) setResult({ ...(data[0].results as any), _stored_at: data[0].created_at, _score: data[0].overall_score });
      });
  }, []);

  const runScan = async () => {
    setLoading(true);
    try {
      const data = await callAI('focused_scan');
      if (data) setResult(data);
    } catch { toast.error('Fokusscan misslyckades'); }
    finally { setLoading(false); }
  };

  const statusColor = (s: string) => {
    if (s === 'critical') return 'bg-destructive/15 text-destructive border-destructive/30';
    if (s === 'warning') return 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20';
    if (s === 'improving') return 'bg-green-500/10 text-green-700 border-green-500/20';
    return 'bg-muted text-muted-foreground border-border';
  };

  const trendIcon = (t: string) => {
    if (t === 'worsening') return <TrendingUp className="w-3.5 h-3.5 text-destructive rotate-0" />;
    if (t === 'improving') return <TrendingUp className="w-3.5 h-3.5 text-green-600 rotate-180" />;
    if (t === 'new') return <AlertCircle className="w-3.5 h-3.5 text-yellow-600" />;
    return <Activity className="w-3.5 h-3.5 text-muted-foreground" />;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold flex items-center gap-2"><Radar className="w-5 h-5 text-primary" /> Adaptive Scan Zones</h3>
          <p className="text-sm text-muted-foreground">AI identifierar hot zones med hög problemkoncentration och djupanalyserar dem.</p>
        </div>
        <Button onClick={runScan} disabled={loading} size="sm">
          {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Radar className="w-4 h-4 mr-1" />}
          Kör fokusscan
        </Button>
      </div>

      {result?._stored_at && !loading && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Clock className="w-3 h-3" /> Senaste scan: {new Date(result._stored_at).toLocaleString('sv-SE')}
        </p>
      )}

      {result && (
        <>
          {/* Summary */}
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline" className={cn('text-xs', statusColor(result.overall_risk || 'medium'))}>
                  Risk: {result.overall_risk || 'medium'}
                </Badge>
                {result.tasks_created > 0 && (
                  <Badge variant="secondary" className="text-xs">{result.tasks_created} uppgifter skapade</Badge>
                )}
              </div>
              <p className="text-sm">{result.summary}</p>
            </CardContent>
          </Card>

          {/* Hot Zones Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {result.hot_zones?.length > 0 && (
              <Card className="border-border md:col-span-2">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">🔥 Hot Zones ({result.hot_zones.length})</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {result.hot_zones.map((hz: any, i: number) => (
                    <div key={i} className="border border-border rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm capitalize">{hz.area}</span>
                          <Badge variant="outline" className={cn('text-[10px]', statusColor(hz.status))}>{hz.status}</Badge>
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            {trendIcon(hz.trend)} {hz.trend}
                          </span>
                        </div>
                        {hz.heat_score > 0 && (
                          <span className="text-xs font-mono text-muted-foreground">heat: {hz.heat_score}</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{hz.diagnosis}</p>
                      {hz.actions?.length > 0 && (
                        <div className="space-y-1">
                          {hz.actions.map((a: string, j: number) => (
                            <div key={j} className="text-xs flex items-start gap-1.5">
                              <ArrowRight className="w-3 h-3 mt-0.5 text-primary shrink-0" />
                              <span>{a}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {hz.related_areas?.length > 0 && (
                        <div className="flex gap-1 flex-wrap">
                          {hz.related_areas.map((ra: string, k: number) => (
                            <Badge key={k} variant="secondary" className="text-[10px]">{ra}</Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Cold Zones + Next Scan Recommendations */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {result.cold_zones?.length > 0 && (
              <Card className="border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-600" /> Stabila zoner</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-1.5">
                    {result.cold_zones.map((z: string, i: number) => (
                      <Badge key={i} variant="outline" className="text-xs bg-green-500/5 text-green-700 border-green-500/20">{z}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {result.recommended_next_scan_areas?.length > 0 && (
              <Card className="border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><Radar className="w-4 h-4 text-primary" /> Nästa fokusområden</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-1.5">
                    {result.recommended_next_scan_areas.map((a: string, i: number) => (
                      <Badge key={i} variant="outline" className="text-xs">{a}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </>
      )}

      {!result && !loading && (
        <Card className="border-dashed border-border">
          <CardContent className="py-12 text-center">
            <Radar className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">Kör en fokusscan för att identifiera problemområden</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};


