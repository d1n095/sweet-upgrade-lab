import { useState } from 'react';
import { Bug, Loader2, AlertTriangle, Lightbulb, Shield, Zap, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { callAI } from './_shared';

export const SystemHealthTab = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);

  const run = async () => {
    setLoading(true);
    const res = await callAI('system_health');
    if (res) setData(res);
    setLoading(false);
  };

  const severityColor = (s: string) => {
    if (s === 'critical') return 'text-red-700 bg-red-100 border-red-200';
    if (s === 'high') return 'text-orange-700 bg-orange-100 border-orange-200';
    return 'text-yellow-700 bg-yellow-100 border-yellow-200';
  };

  const impactBadge = (i: string) => {
    if (i === 'high') return 'destructive' as const;
    if (i === 'medium') return 'default' as const;
    return 'secondary' as const;
  };

  return (
    <div className="space-y-4">
      <Button onClick={run} disabled={loading} className="w-full gap-2">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
        Kör systemhälsoanalys
      </Button>

      {data && (
        <div className="space-y-4">
          <div className="border rounded-xl p-4 flex items-center gap-4">
            <div className={cn(
              'w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold border-2',
              data.health_score >= 70 ? 'border-green-500 text-green-700 bg-green-50' :
              data.health_score >= 40 ? 'border-yellow-500 text-yellow-700 bg-yellow-50' :
              'border-red-500 text-red-700 bg-red-50'
            )}>
              {data.health_score}
            </div>
            <div>
              <h3 className="text-sm font-semibold">Systemhälsa</h3>
              <p className="text-xs text-muted-foreground">{data.summary}</p>
            </div>
          </div>

          {data.critical_issues?.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5 text-destructive" /> Kritiska problem ({data.critical_issues.length})</h4>
              <ScrollArea className="max-h-[50vh]">
                <div className="space-y-2 pr-2">
                  {data.critical_issues.map((issue: any, i: number) => (
                    <div key={i} className={cn('border rounded-lg p-3 space-y-1', severityColor(issue.severity))}>
                      <div className="flex items-center gap-2">
                        <Badge variant="destructive" className="text-[9px]">{issue.severity}</Badge>
                        <span className="text-sm font-semibold">{issue.title}</span>
                      </div>
                      <p className="text-xs">{issue.description}</p>
                      <p className="text-xs font-medium">→ {issue.suggested_action}</p>
                      <Button size="sm" variant="outline" className="h-5 text-[9px] gap-0.5 mt-1" onClick={async () => {
                        const res = await callAI('create_action', {
                          title: issue.title,
                          description: `${issue.description}\n\nÅtgärd: ${issue.suggested_action}`,
                          priority: issue.severity === 'critical' ? 'critical' : 'high',
                          category: 'system',
                          source_type: 'ai_detection',
                        });
                        if (res?.created) toast.success('Uppgift skapad');
                      }}>
                        <Zap className="w-2.5 h-2.5" /> Skapa uppgift
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {data.duplicate_bugs?.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5"><Bug className="w-3.5 h-3.5" /> Duplicerade buggar ({data.duplicate_bugs.length})</h4>
              <ScrollArea className="max-h-[50vh]">
                <div className="space-y-2 pr-2">
                  {data.duplicate_bugs.map((d: any, i: number) => (
                    <div key={i} className="border rounded-lg p-3 space-y-1">
                      <p className="text-xs"><span className="font-medium">Anledning:</span> {d.reason}</p>
                      <p className="text-xs text-muted-foreground">→ {d.suggested_action}</p>
                      <div className="flex gap-1 flex-wrap">
                        {d.bug_ids.map((id: string) => <span key={id} className="text-[9px] bg-muted px-1.5 py-0.5 rounded-full font-mono">{id.slice(0, 8)}</span>)}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {data.missing_fixes?.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> Saknade åtgärder</h4>
              {data.missing_fixes.map((m: any, i: number) => (
                <div key={i} className="border rounded-lg p-3 space-y-1">
                  <Badge variant="outline" className="text-[9px]">{m.area}</Badge>
                  <p className="text-xs font-medium">{m.problem}</p>
                  <p className="text-xs text-muted-foreground">→ {m.suggestion}</p>
                </div>
              ))}
            </div>
          )}

          {data.improvements?.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5"><Lightbulb className="w-3.5 h-3.5" /> Förbättringsförslag</h4>
              <ScrollArea className="max-h-[50vh]">
                <div className="space-y-2 pr-2">
                  {data.improvements.map((imp: any, i: number) => (
                    <div key={i} className="border rounded-lg p-3 space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant={impactBadge(imp.impact)} className="text-[9px]">{imp.impact} impact</Badge>
                        <span className="text-sm font-medium">{imp.title}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{imp.description}</p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── Trend Analysis Panel ──
