import { useState } from 'react';
import { Copy, Loader2, Zap, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { callAI, copyToClipboard } from './_shared';

export const DevGuardianTab = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const runGuardian = async () => {
    setLoading(true);
    const res = await callAI('dev_guardian');
    if (res) setResult(res);
    setLoading(false);
  };

  const catLabel: Record<string, string> = {
    broken: '🔴 Trasigt', incomplete: '🟡 Ofullständigt', missing_feature: '🟢 Saknad feature',
    structure_issue: '🔵 Struktur', data_gap: '📊 Datagap', unverified_fix: '⚠️ Overifierad fix',
    performance: '⚡ Prestanda', security: '🔒 Säkerhet',
  };

  const urgencyBadge = (u: string) => {
    if (u === 'immediate') return 'destructive' as const;
    if (u === 'today') return 'default' as const;
    return 'secondary' as const;
  };

  return (
    <div className="space-y-4">
      <Button onClick={runGuardian} disabled={loading} className="w-full gap-2">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
        Kör Development Guardian
      </Button>

      {result && (
        <div className="space-y-4">
          {/* Health score */}
          <Card className="border-border">
            <CardContent className="py-4 flex items-center gap-4">
              <div className={cn(
                'w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold border-2',
                result.health_score >= 70 ? 'border-green-500 text-green-700' :
                result.health_score >= 40 ? 'border-yellow-500 text-yellow-700' :
                'border-red-500 text-red-700'
              )}>
                {result.health_score}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-sm">Development Health</h3>
                <p className="text-xs text-muted-foreground mt-1">{result.summary}</p>
                {result.work_items_created > 0 && (
                  <Badge className="mt-1 text-[9px]">{result.work_items_created} tasks skapade</Badge>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Category breakdown */}
          {result.category_counts && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {Object.entries(result.category_counts).map(([key, count]) => (
                <Card key={key} className="border-border">
                  <CardContent className="py-2 px-3 text-center">
                    <p className="text-lg font-bold">{count as number}</p>
                    <p className="text-[10px] text-muted-foreground">{catLabel[key] || key}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Top priorities */}
          {result.top_priorities?.length > 0 && (
            <Card className="border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Zap className="w-4 h-4 text-warning" /> Top prioriteringar
                </CardTitle>
              </CardHeader>
              <CardContent><ScrollArea className="max-h-[50vh]"><div className="space-y-2 pr-2">
                {result.top_priorities.map((p: any, i: number) => (
                  <div key={i} className="flex items-start gap-2 border rounded-lg p-2.5">
                    <Badge variant={urgencyBadge(p.urgency)} className="text-[9px] shrink-0 mt-0.5">
                      {p.urgency === 'immediate' ? 'NU' : p.urgency === 'today' ? 'Idag' : 'Veckan'}
                    </Badge>
                    <div className="min-w-0">
                      <p className="text-xs font-medium">{p.title}</p>
                      <p className="text-[10px] text-muted-foreground">{p.reason}</p>
                    </div>
                  </div>
                ))}
              </div></ScrollArea></CardContent>
            </Card>
          )}

          {/* All issues */}
          {result.issues?.length > 0 && (
            <Card className="border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Alla problem ({result.issues.length})</CardTitle>
              </CardHeader>
              <ScrollArea className="max-h-[50vh]">
                <CardContent className="space-y-3">
                  {result.issues.map((issue: any, i: number) => (
                    <div key={i} className="border rounded-lg p-3 space-y-2">
                      <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-xs">{issue.title}</span>
                            <Badge variant={issue.severity === 'critical' || issue.severity === 'high' ? 'destructive' : issue.severity === 'medium' ? 'default' : 'secondary'} className="text-[9px]">
                              {issue.severity}
                            </Badge>
                            <Badge variant="outline" className="text-[9px]">{catLabel[issue.category] || issue.category}</Badge>
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-1">{issue.description}</p>
                        </div>
                      </div>
                      <div className="text-[10px] space-y-1 bg-muted/50 rounded p-2">
                        <p><span className="font-medium">Område:</span> {issue.affected_area}</p>
                        <p><span className="font-medium">Bevis:</span> {issue.evidence}</p>
                        <p><span className="font-medium">Fix:</span> {issue.fix_suggestion}</p>
                      </div>
                      <Button size="sm" variant="ghost" className="h-6 text-[10px] gap-1" onClick={() => copyToClipboard(issue.lovable_prompt)}>
                        <Copy className="w-3 h-3" /> Kopiera prompt
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </ScrollArea>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};

// ── AI Autopilot Tab ──
