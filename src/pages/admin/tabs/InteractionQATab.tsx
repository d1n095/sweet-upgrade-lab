import { useState, useEffect } from 'react';
import { Bug, Copy, Loader2, AlertTriangle, RefreshCw, CheckCircle, XCircle, Shield, Zap, Radar, ArrowRight, Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import FailureMemoryPanel from '@/components/admin/FailureMemoryPanel';
import { callAI, copyToClipboard } from './_shared';

export const InteractionQATab = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  // Load last scan on mount
  useEffect(() => {
    (supabase.from('ai_scan_results') as any)
      .select('results, created_at')
      .eq('scan_type', 'interaction_qa')
      .order('created_at', { ascending: false })
      .limit(1)
      .then(({ data }: any) => { if (data?.[0]) setResult(data[0].results); });
  }, []);

  const run = async () => {
    setLoading(true);
    const r = await callAI('interaction_qa');
    if (r) { setResult(r); toast.success(`Interaction QA klar – ${r.dead_elements?.length || 0} döda element, ${r.broken_flows?.length || 0} brutna flöden, ${r.tasks_created || 0} uppgifter`); }
    setLoading(false);
  };

  const sevColor = (s: string) => {
    if (s === 'critical') return 'destructive' as const;
    if (s === 'high') return 'default' as const;
    return 'secondary' as const;
  };

  const scoreColor = (s: number) => s >= 70 ? 'text-green-700 border-green-500' : s >= 40 ? 'text-yellow-700 border-yellow-500' : 'text-red-700 border-red-500';

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-primary" />
          <div>
            <h3 className="text-sm font-bold">Interaction QA Engine</h3>
            <p className="text-[10px] text-muted-foreground">Testar knappar, flöden, state-sync och hittar döda element</p>
          </div>
        </div>
        <Button onClick={run} disabled={loading} className="w-full gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Radar className="w-4 h-4" />}
          {loading ? 'Analyserar interaktioner...' : 'Kör Interaction QA'}
        </Button>
      </Card>

      {result && (
        <div className="space-y-4">
          {/* Scores */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: 'Interaktion', score: result.interaction_score },
              { label: 'Klick-test', score: result.click_test_score },
              { label: 'State Sync', score: result.state_sync_score },
              { label: 'Routes', score: result.route_health_score },
            ].map(s => (
              <div key={s.label} className="border rounded-xl p-3 text-center">
                <div className={cn('text-2xl font-bold border-b-2 pb-1 mb-1 inline-block', scoreColor(s.score))}>{s.score}</div>
                <div className="text-[10px] text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Summary */}
          <Card className="border-border">
            <CardContent className="pt-4">
              <p className="text-sm">{result.executive_summary}</p>
              {result.tasks_created > 0 && (
                <Badge variant="default" className="mt-2 bg-green-600">{result.tasks_created} uppgifter skapade</Badge>
              )}
            </CardContent>
          </Card>

          {/* Dead elements */}
          {result.dead_elements?.length > 0 && (
            <Card className="border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-destructive" /> Döda element ({result.dead_elements.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="max-h-[50vh]">
                  <div className="space-y-2 pr-2">
                    {result.dead_elements.map((el: any, i: number) => (
                      <div key={i} className="border border-border rounded-lg p-3 space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant={sevColor(el.severity)} className="text-[10px]">{el.severity}</Badge>
                          <span className="text-xs font-semibold">{el.element}</span>
                          <span className="text-[10px] text-muted-foreground">({el.page})</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{el.issue}</p>
                        <p className="text-[10px]"><strong>Fix:</strong> {el.fix_suggestion}</p>
                        <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1" onClick={() => copyToClipboard(el.lovable_prompt)}>
                          <Copy className="w-3 h-3" /> Kopiera prompt
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {/* Broken flows */}
          {result.broken_flows?.length > 0 && (
            <Card className="border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-600" /> Brutna flöden ({result.broken_flows.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="max-h-[50vh]">
                  <div className="space-y-2 pr-2">
                    {result.broken_flows.map((flow: any, i: number) => (
                      <div key={i} className="border border-border rounded-lg p-3 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <Badge variant={sevColor(flow.severity)} className="text-[10px]">{flow.severity}</Badge>
                          <span className="text-xs font-semibold">{flow.flow_name}</span>
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground flex-wrap">
                          {flow.steps.map((step: string, si: number) => (
                            <span key={si} className="flex items-center gap-1">
                              {si > 0 && <ArrowRight className="w-2.5 h-2.5" />}
                              <span className={step === flow.broken_at ? 'text-destructive font-bold' : ''}>{step}</span>
                            </span>
                          ))}
                        </div>
                        <p className="text-[10px]"><strong>Bryter vid:</strong> {flow.broken_at}</p>
                        <p className="text-[10px]"><strong>Fix:</strong> {flow.fix_suggestion}</p>
                        <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1" onClick={() => copyToClipboard(flow.lovable_prompt)}>
                          <Copy className="w-3 h-3" /> Kopiera prompt
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {/* State issues */}
          {result.state_issues?.length > 0 && (
            <Card className="border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <RefreshCw className="w-4 h-4" /> State-problem ({result.state_issues.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {result.state_issues.map((si: any, i: number) => (
                    <div key={i} className="border border-border rounded-md p-2 text-xs">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={sevColor(si.severity)} className="text-[10px]">{si.severity}</Badge>
                        <span className="font-mono text-[10px]">{si.affected_component}</span>
                      </div>
                      <p className="text-muted-foreground">{si.description}</p>
                      <p className="mt-1"><strong>Fix:</strong> {si.fix_suggestion}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Data Integrity Issues */}
          {(result as any).integrity_issues?.length > 0 && (
            <Card className="border-destructive/30 bg-destructive/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Shield className="w-4 h-4 text-destructive" /> Dataintegritet ({(result as any).integrity_issues.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1.5 mb-3">
                  {Object.entries((result as any).integrity_summary || {}).map(([type, count]: [string, any]) => (
                    count > 0 && (
                      <Badge key={type} variant="outline" className="text-[10px] mr-1">
                        {type === 'data_loss' ? '💀 Data loss' : type === 'failed_insert' ? '❌ Failed insert' : type === 'stale_state' ? '⏳ Stale state' : '🔍 Incorrect filter'}: {count}
                      </Badge>
                    )
                  ))}
                </div>
                <ScrollArea className="max-h-[50vh]">
                  <div className="space-y-2 pr-2">
                    {(result as any).integrity_issues.map((issue: any, i: number) => (
                      <div key={i} className="border border-border rounded-lg p-3 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant={issue.severity === 'critical' ? 'destructive' : issue.severity === 'high' ? 'default' : 'secondary'} className="text-[10px]">
                            {issue.severity}
                          </Badge>
                          <Badge variant="outline" className="text-[10px]">{issue.type}</Badge>
                          <span className="text-[10px] text-muted-foreground font-mono">{issue.entity}</span>
                        </div>
                        <p className="text-xs font-semibold">{issue.title}</p>
                        {issue.description && <p className="text-[10px] text-muted-foreground">{issue.description}</p>}
                        <div className="flex gap-3 text-[10px] text-muted-foreground">
                          <span>📍 Steg: <code className="bg-muted px-1 rounded">{issue.step}</code></span>
                          <span>🔬 Orsak: {issue.root_cause}</span>
                        </div>
                        {issue.entity_id && (
                          <p className="text-[8px] font-mono text-muted-foreground/60">ID: {issue.entity_id}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {/* Functional Behavior Failures */}
          {(result as any).behavior_failures?.length > 0 && (
            <Card className="border-orange-500/30 bg-orange-500/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Zap className="w-4 h-4 text-orange-600" /> Funktionella beteendefel ({(result as any).behavior_failures.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1.5 mb-3">
                  {Object.entries((result as any).behavior_summary || {}).map(([type, count]: [string, any]) => (
                    count > 0 && (
                      <Badge key={type} variant="outline" className="text-[10px] mr-1">
                        {type === 'action_failed' ? '🚫 Action failed' : type === 'partial_execution' ? '⚡ Partial exec' : type === 'silent_failure' ? '🤫 Silent fail' : type === 'lost_state' ? '💀 Lost state' : '⏳ Stale'}: {count}
                      </Badge>
                    )
                  ))}
                </div>
                <ScrollArea className="max-h-[50vh]">
                  <div className="space-y-2 pr-2">
                    {(result as any).behavior_failures.map((failure: any, i: number) => (
                      <div key={i} className="border border-border rounded-lg p-3 space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant={failure.severity === 'critical' ? 'destructive' : failure.severity === 'high' ? 'default' : 'secondary'} className="text-[10px]">
                            {failure.severity}
                          </Badge>
                          <Badge variant="outline" className="text-[10px]">{failure.failure_type}</Badge>
                          <span className="text-[10px] text-muted-foreground font-mono">{failure.chain}</span>
                        </div>
                        <p className="text-xs font-semibold">{failure.action}</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[10px]">
                          <div className="bg-green-500/10 rounded p-1.5">
                            <span className="text-green-700 dark:text-green-400 font-medium">✓ Förväntat:</span>
                            <p className="text-foreground mt-0.5">{failure.expected}</p>
                          </div>
                          <div className="bg-red-500/10 rounded p-1.5">
                            <span className="text-red-700 dark:text-red-400 font-medium">✗ Faktiskt:</span>
                            <p className="text-foreground mt-0.5">{failure.actual}</p>
                          </div>
                        </div>
                        <div className="flex gap-3 text-[10px] text-muted-foreground">
                          <span>📍 Steg: <code className="bg-muted px-1 rounded">{failure.step}</code></span>
                        </div>
                        {failure.entity_id && (
                          <p className="text-[8px] font-mono text-muted-foreground/60">ID: {failure.entity_id}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {/* Failure Memory — Known Hotspots */}
          <FailureMemoryPanel />

          {result.route_issues?.length > 0 && (
            <Card className="border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Compass className="w-4 h-4" /> Route-status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="max-h-[50vh]"><div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pr-2">
                  {result.route_issues.map((ri: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-xs p-2 rounded bg-muted/50">
                      {ri.status === 'ok' ? <CheckCircle className="w-3.5 h-3.5 text-green-600 shrink-0" /> :
                       ri.status === 'warning' ? <AlertTriangle className="w-3.5 h-3.5 text-yellow-600 shrink-0" /> :
                       <XCircle className="w-3.5 h-3.5 text-destructive shrink-0" />}
                      <span className="font-mono text-[10px]">{ri.route}</span>
                      {ri.issue !== 'OK' && <span className="text-muted-foreground truncate">{ri.issue}</span>}
                    </div>
                  ))}
                </div></ScrollArea>
              </CardContent>
            </Card>
          )}

          {/* Bug reevaluation */}
          {result.bug_reevaluation?.length > 0 && (
            <Card className="border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Bug className="w-4 h-4" /> Bugg-omvärdering ({result.bug_reevaluation.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="max-h-[50vh]"><div className="space-y-1.5 pr-2">
                  {result.bug_reevaluation.map((br: any, i: number) => (
                    <div key={i} className="flex items-start gap-2 text-xs p-2 rounded bg-muted/50">
                      <Badge variant={br.recommended_status === 'likely_fixed' ? 'secondary' : br.recommended_status === 'still_open' ? 'destructive' : 'outline'} className="text-[10px] shrink-0">
                        {br.recommended_status}
                      </Badge>
                      <span className="text-muted-foreground">{br.reason}</span>
                    </div>
                  ))}
                </div></ScrollArea>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};

// ── Verification Engine Tab ──
