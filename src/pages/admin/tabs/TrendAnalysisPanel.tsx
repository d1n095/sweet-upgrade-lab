import { useState } from 'react';
import { Loader2, AlertTriangle, Lightbulb, Info, CheckCircle, XCircle, Activity, TrendingUp, Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { callAI } from './_shared';

export const TrendAnalysisPanel = () => {
  const [loading, setLoading] = useState(false);
  const [trends, setTrends] = useState<any>(null);
  const [expanded, setExpanded] = useState(false);

  const runTrends = async () => {
    setLoading(true);
    const res = await callAI('memory_trends');
    if (res) {
      setTrends(res);
      if (!res.trend_available) toast.info(res.message);
      else toast.success('Trendanalys klar');
    }
    setLoading(false);
  };

  const trendIcon = (dir: string) => {
    if (dir === 'improving' || dir === 'up' || dir === 'decreasing') return <TrendingUp className="w-4 h-4 text-accent" />;
    if (dir === 'stable' || dir === 'unchanged') return <Activity className="w-4 h-4 text-muted-foreground" />;
    return <AlertTriangle className="w-4 h-4 text-destructive" />;
  };

  const trendLabel = (dir: string) => {
    if (dir === 'improving' || dir === 'up' || dir === 'decreasing') return 'Förbättras';
    if (dir === 'stable' || dir === 'unchanged') return 'Stabilt';
    return 'Försämras';
  };

  const trendColor = (dir: string) => {
    if (dir === 'improving' || dir === 'up' || dir === 'decreasing') return 'text-accent';
    if (dir === 'stable' || dir === 'unchanged') return 'text-muted-foreground';
    return 'text-destructive';
  };

  const changeIcon = (c: string) => {
    if (c === 'improved') return <CheckCircle className="w-3.5 h-3.5 text-accent" />;
    if (c === 'unchanged') return <Activity className="w-3.5 h-3.5 text-muted-foreground" />;
    return <XCircle className="w-3.5 h-3.5 text-destructive" />;
  };

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" />
          <h4 className="text-sm font-bold">AI Minne & Trendanalys</h4>
        </div>
        <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={runTrends} disabled={loading}>
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Compass className="w-3.5 h-3.5" />}
          {loading ? 'Analyserar...' : 'Kör trendanalys'}
        </Button>
      </div>

      {!trends && !loading && (
        <p className="text-xs text-muted-foreground text-center py-2">Klicka för att analysera systemets utveckling över tid</p>
      )}

      {trends?.trend_available === false && (
        <div className="text-center py-4">
          <Info className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">{trends.message}</p>
        </div>
      )}

      {trends?.trend_available && (
        <div className="space-y-3">
          {/* Overall trend */}
          <div className={cn('border rounded-lg p-3 flex items-center gap-3',
            trends.overall_trend === 'improving' ? 'border-accent/30 bg-accent/5' :
            trends.overall_trend === 'stable' ? 'border-border bg-muted/20' :
            'border-destructive/30 bg-destructive/5'
          )}>
            {trendIcon(trends.overall_trend)}
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className={cn('text-xs font-bold', trendColor(trends.overall_trend))}>
                  {trendLabel(trends.overall_trend)}
                </span>
                <Badge variant="secondary" className="text-[9px]">{trends.scan_count} skanningar</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{trends.trend_summary}</p>
            </div>
          </div>

          {/* Metric trends */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {[
              { label: 'Systempoäng', data: trends.score_trend, extra: trends.score_trend?.change != null ? `${trends.score_trend.change > 0 ? '+' : ''}${trends.score_trend.change}` : '' },
              { label: 'Buggar', data: trends.bug_trend },
              { label: 'Prestanda', data: trends.performance_trend },
            ].map(t => (
              <div key={t.label} className="border rounded-lg p-2.5 space-y-1">
                <div className="flex items-center gap-1.5">
                  {trendIcon(t.data?.direction)}
                  <span className="text-[10px] font-medium text-muted-foreground">{t.label}</span>
                </div>
                <p className={cn('text-xs font-bold', trendColor(t.data?.direction))}>
                  {trendLabel(t.data?.direction)} {t.extra && <span className="text-[10px] font-normal">({t.extra})</span>}
                </p>
                <p className="text-[10px] text-muted-foreground line-clamp-2">{t.data?.message}</p>
              </div>
            ))}
          </div>

          {/* Score timeline mini chart */}
          {trends.scan_timeline?.length > 1 && (
            <div className="border rounded-lg p-3">
              <h5 className="text-[10px] font-semibold text-muted-foreground mb-2">Poängutveckling</h5>
              <div className="flex items-end gap-1 h-12">
                {trends.scan_timeline.map((s: any, i: number) => {
                  const score = s.score || 0;
                  const height = Math.max(4, (score / 100) * 48);
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-0.5" title={`${new Date(s.date).toLocaleDateString('sv-SE')}: ${score}`}>
                      <div
                        className={cn('w-full rounded-sm min-w-[4px]',
                          score >= 70 ? 'bg-accent' : score >= 40 ? 'bg-yellow-400' : 'bg-destructive'
                        )}
                        style={{ height: `${height}px` }}
                      />
                      <span className="text-[8px] text-muted-foreground">{score}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Key changes */}
          <Button variant="ghost" size="sm" className="w-full text-xs gap-1.5" onClick={() => setExpanded(!expanded)}>
            {expanded ? 'Dölj detaljer' : 'Visa förändringar & rekommendationer'}
          </Button>

          {expanded && (
            <>
              {trends.key_changes?.length > 0 && (
                <div className="space-y-1.5">
                  <h5 className="text-[10px] font-semibold text-muted-foreground">Nyckelförändringar</h5>
                  {trends.key_changes.map((kc: any, i: number) => (
                    <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-secondary/20">
                      {changeIcon(kc.change)}
                      <div>
                        <span className="text-xs font-medium">{kc.area}</span>
                        <p className="text-[10px] text-muted-foreground">{kc.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {trends.recommendations?.length > 0 && (
                <div className="space-y-1.5">
                  <h5 className="text-[10px] font-semibold text-muted-foreground">AI-rekommendationer</h5>
                  {trends.recommendations.map((rec: string, i: number) => (
                    <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-primary/5 border border-primary/10">
                      <Lightbulb className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                      <p className="text-xs">{rec}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Raw stats */}
              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div className="border rounded p-2">
                  <p className="text-muted-foreground">Buggar öppna / lösta</p>
                  <p className="font-bold">{trends.bug_stats?.open} / {trends.bug_stats?.resolved}</p>
                </div>
                <div className="border rounded p-2">
                  <p className="text-muted-foreground">Uppgifter öppna / klara</p>
                  <p className="font-bold">{trends.work_stats?.open} / {trends.work_stats?.done}</p>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </Card>
  );
};

// ── System Scan Tab (MASTER ENGINE) ──
