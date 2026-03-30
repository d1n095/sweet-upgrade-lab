import { useState } from 'react';
import { Loader2, AlertTriangle, CheckCircle, Zap, Activity, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { callAI, UnifiedReport } from './_shared';

// ── Unified Dashboard Tab (NEW) ──
export const UnifiedDashboardTab = () => {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<UnifiedReport | null>(null);

  const runReport = async () => {
    setLoading(true);
    const res = await callAI('unified_report');
    if (res) setReport(res);
    setLoading(false);
  };

  const statusColor = (s: string) => {
    if (s === 'healthy') return 'text-green-700 bg-green-100 border-green-300';
    if (s === 'warning') return 'text-yellow-700 bg-yellow-100 border-yellow-300';
    return 'text-red-700 bg-red-100 border-red-300';
  };

  const statusIcon = (s: string) => {
    if (s === 'healthy') return <CheckCircle className="w-4 h-4 text-green-600" />;
    if (s === 'warning') return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
    return <AlertCircle className="w-4 h-4 text-red-600" />;
  };

  const urgencyBadge = (u: string) => {
    if (u === 'now') return 'destructive' as const;
    if (u === 'today') return 'default' as const;
    return 'secondary' as const;
  };

  const urgencyLabel = (u: string) => {
    if (u === 'now') return 'NU';
    if (u === 'today') return 'Idag';
    return 'Denna vecka';
  };

  return (
    <div className="space-y-4">
      <Button onClick={runReport} disabled={loading} className="w-full gap-2">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
        Kör systemanalys (alla datakällor)
      </Button>

      {report && (
        <div className="space-y-4">
          {/* Overall score */}
          <div className={cn('border rounded-xl p-5 flex items-center gap-5', statusColor(report.overall_status))}>
            <div className={cn(
              'w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold border-2',
              report.overall_score >= 70 ? 'border-green-500 text-green-700' :
              report.overall_score >= 40 ? 'border-yellow-500 text-yellow-700' :
              'border-red-500 text-red-700'
            )}>
              {report.overall_score}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                {statusIcon(report.overall_status)}
                <h3 className="font-bold text-base">Systemstatus</h3>
              </div>
              <p className="text-sm mt-1">{report.executive_summary}</p>
            </div>
          </div>

          {/* Raw metrics grid */}
          {report.raw_metrics && (
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {[
                { key: 'revenue', label: 'Intäkter', fmt: (v: number) => `${v} kr` },
                { key: 'orders', label: 'Ordrar', fmt: (v: number) => String(v) },
                { key: 'conversion', label: 'Konvertering', fmt: (v: number) => `${v}%` },
                { key: 'openBugs', label: 'Öppna buggar', fmt: (v: number) => String(v) },
                { key: 'openItems', label: 'Öppna tasks', fmt: (v: number) => String(v) },
                { key: 'lowStock', label: 'Lågt lager', fmt: (v: number) => String(v) },
                { key: 'unresolvedIncidents', label: 'Ärenden', fmt: (v: number) => String(v) },
                { key: 'slaRate', label: 'SLA %', fmt: (v: number) => `${v}%` },
                { key: 'errorLogs', label: 'Fel (7d)', fmt: (v: number) => String(v) },
                { key: 'pendingRefunds', label: 'Refunds', fmt: (v: number) => String(v) },
              ].map(m => (
                <Card key={m.key} className="border-border">
                  <CardContent className="py-2 px-3 text-center">
                    <p className="text-lg font-bold leading-tight">{m.fmt(report.raw_metrics![m.key] || 0)}</p>
                    <p className="text-[9px] text-muted-foreground leading-tight">{m.label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Top priorities */}
          {report.top_priorities?.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5" /> Topprioriteter
              </h4>
              <div className="space-y-1.5">
                {report.top_priorities.map((p, i) => (
                  <div key={i} className="border rounded-lg p-3 flex items-start gap-3">
                    <Badge variant={urgencyBadge(p.urgency)} className="text-[9px] shrink-0 mt-0.5">
                      {urgencyLabel(p.urgency)}
                    </Badge>
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{p.title}</p>
                      <p className="text-xs text-muted-foreground">{p.reason}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Area breakdown */}
          {report.areas?.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground">Systemområden</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {report.areas.map((area, i) => (
                  <Card key={i} className="border-border">
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {statusIcon(area.status)}
                          <span className="text-sm font-semibold">{area.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={cn('text-xs font-mono font-bold', 
                            area.score >= 70 ? 'text-green-700' : area.score >= 40 ? 'text-yellow-700' : 'text-red-700'
                          )}>
                            {area.score}
                          </span>
                        </div>
                      </div>
                      <Progress value={area.score} className="h-1.5" />
                      <p className="text-xs text-muted-foreground">{area.summary}</p>
                      {area.actions.length > 0 && (
                        <ul className="text-[10px] space-y-0.5">
                          {area.actions.map((a, j) => (
                            <li key={j} className="flex items-start gap-1">
                              <span className="text-primary mt-0.5">→</span>
                              <span>{a}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
