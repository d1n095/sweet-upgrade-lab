import { useState } from 'react';
import { Sparkles, Copy, Loader2, Zap, TrendingUp, Package, AlertCircle, Wrench, ArrowRight, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { callAI, copyToClipboard } from './_shared';

// ── AI Action Engine Tab ──
export const ActionEngineTab = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [expandedAction, setExpandedAction] = useState<number | null>(null);

  const run = async () => {
    setLoading(true);
    const res = await callAI('action_engine');
    if (res) setData(res);
    setLoading(false);
  };

  const typeIcon = (t: string) => {
    if (t === 'fix') return <Wrench className="w-3.5 h-3.5 text-destructive" />;
    if (t === 'improvement') return <TrendingUp className="w-3.5 h-3.5 text-blue-600" />;
    if (t === 'revenue') return <TrendingUp className="w-3.5 h-3.5 text-green-600" />;
    if (t === 'campaign') return <Zap className="w-3.5 h-3.5 text-purple-600" />;
    if (t === 'bundle') return <Package className="w-3.5 h-3.5 text-orange-600" />;
    if (t === 'upsell') return <ArrowRight className="w-3.5 h-3.5 text-emerald-600" />;
    return <Sparkles className="w-3.5 h-3.5 text-muted-foreground" />;
  };

  const revenueColor = (r: string) => {
    if (r === 'high') return 'text-green-700 bg-green-100 border-green-200';
    if (r === 'medium') return 'text-yellow-700 bg-yellow-100 border-yellow-200';
    if (r === 'low') return 'text-blue-700 bg-blue-100 border-blue-200';
    return 'text-muted-foreground bg-muted border-border';
  };

  const priorityBadge = (p: string) => {
    if (p === 'critical' || p === 'high') return 'destructive' as const;
    return 'secondary' as const;
  };

  return (
    <div className="space-y-4">
      <div className="border rounded-xl p-4 bg-card space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-green-700" />
          </div>
          <div>
            <h3 className="text-sm font-bold">AI Action & Revenue Engine</h3>
            <p className="text-[10px] text-muted-foreground">Genererar åtgärder, kampanjer, bundles och intäktsmöjligheter</p>
          </div>
        </div>
        <Button onClick={run} disabled={loading} className="w-full gap-2" size="lg">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />}
          {loading ? 'Analyserar...' : 'Generera handlingsplan'}
        </Button>
      </div>

      {data && (
        <div className="space-y-5">
          {/* Summary + Revenue opportunity */}
          <div className="border rounded-xl p-4 bg-green-50/50 border-green-200 space-y-2">
            <p className="text-sm">{data.summary}</p>
            {data.total_estimated_revenue_opportunity && (
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-green-700" />
                <span className="text-sm font-bold text-green-700">Intäktspotential: {data.total_estimated_revenue_opportunity}</span>
              </div>
            )}
          </div>

          {/* Cross-system links */}
          {data.cross_system_links?.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5" /> Systemkopplingar → Intäkt ({data.cross_system_links.length})
              </h4>
              <div className="space-y-1.5">
                {data.cross_system_links.map((link: any, i: number) => (
                  <div key={i} className="border rounded-lg p-2.5 flex items-start gap-2 text-xs">
                    <AlertCircle className="w-3.5 h-3.5 text-orange-600 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="font-medium">{link.issue}</p>
                      <p className="text-muted-foreground">💰 {link.revenue_connection}</p>
                      <p className="text-muted-foreground mt-0.5">{link.impact_description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Smart Action List */}
          {data.actions?.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5" /> AI Rekommenderade Åtgärder ({data.actions.length})
              </h4>
              <ScrollArea className="max-h-[50vh]">
                <div className="space-y-2 pr-2">
                  {data.actions.map((action: any, i: number) => (
                    <div
                      key={i}
                      className="border rounded-lg p-3 space-y-2 cursor-pointer hover:bg-muted/30 transition-colors"
                      onClick={() => setExpandedAction(expandedAction === i ? null : i)}
                    >
                      <div className="flex items-start gap-2">
                        {typeIcon(action.type)}
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium">{action.title}</p>
                          <div className="flex gap-1 mt-1 flex-wrap">
                            <Badge variant={priorityBadge(action.priority)} className="text-[8px]">{action.priority}</Badge>
                            <span className={cn('text-[8px] px-1.5 py-0.5 rounded-full border', revenueColor(action.revenue_impact))}>
                              💰 {action.revenue_impact}
                            </span>
                            <Badge variant="outline" className="text-[8px]">{action.type}</Badge>
                            {action.estimated_revenue_change && (
                              <span className="text-[8px] text-green-700 font-medium">{action.estimated_revenue_change}</span>
                            )}
                          </div>
                        </div>
                        <ArrowRight className={cn('w-3 h-3 text-muted-foreground transition-transform shrink-0', expandedAction === i && 'rotate-90')} />
                      </div>

                      {expandedAction === i && (
                        <div className="pt-2 border-t space-y-2 text-xs">
                          <div>
                            <span className="font-medium text-muted-foreground">🔍 Grundorsak:</span>
                            <p>{action.root_cause}</p>
                          </div>
                          <div>
                            <span className="font-medium text-muted-foreground">🔧 Strategi:</span>
                            <p>{action.fix_strategy}</p>
                          </div>
                          <div>
                            <span className="font-medium text-muted-foreground">📋 Steg:</span>
                            <ol className="list-decimal list-inside mt-0.5 space-y-0.5">
                              {action.implementation_steps.map((s: string, j: number) => <li key={j}>{s}</li>)}
                            </ol>
                          </div>
                          <div>
                            <span className="font-medium text-muted-foreground">✅ Förväntat resultat:</span>
                            <p>{action.expected_result}</p>
                          </div>
                          {action.linked_systems?.length > 0 && (
                            <div className="flex gap-1 flex-wrap">
                              <span className="text-muted-foreground font-medium">🔗</span>
                              {action.linked_systems.map((s: string) => (
                                <span key={s} className="text-[8px] bg-muted px-1.5 py-0.5 rounded-full">{s}</span>
                              ))}
                            </div>
                          )}
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-medium text-muted-foreground">📋 Lovable-prompt:</span>
                              <Button size="sm" variant="ghost" className="h-5 text-[9px] gap-0.5" onClick={(e) => { e.stopPropagation(); copyToClipboard(action.lovable_prompt); }}>
                                <Copy className="w-2.5 h-2.5" /> Kopiera
                              </Button>
                            </div>
                            <div className="bg-muted/50 rounded-md p-2 font-mono text-[10px] whitespace-pre-wrap max-h-32 overflow-y-auto border">{action.lovable_prompt}</div>
                          </div>
                          <Button size="sm" variant="outline" className="w-full h-7 text-[10px] gap-1" onClick={async (e) => {
                            e.stopPropagation();
                            const res = await callAI('create_action', {
                              title: action.title,
                              description: `Grundorsak: ${action.root_cause}\nStrategi: ${action.fix_strategy}\n\nSteg:\n${action.implementation_steps.map((s: string, j: number) => `${j + 1}. ${s}`).join('\n')}\n\n📋 Lovable-prompt:\n${action.lovable_prompt}`,
                              priority: action.priority,
                              category: action.type,
                              source_type: 'ai_action_engine',
                            });
                            if (res?.created) toast.success('Uppgift skapad i Workbench');
                          }}>
                            <Zap className="w-2.5 h-2.5" /> Skapa uppgift i Workbench
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Campaign suggestions */}
          {data.campaigns?.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5" /> Kampanjförslag ({data.campaigns.length})
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {data.campaigns.map((c: any, i: number) => (
                  <Card key={i} className="border-border">
                    <CardContent className="p-3 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold">{c.name}</span>
                        <Badge variant="outline" className="text-[9px]">{c.timing}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{c.description}</p>
                      <div className="flex gap-2 text-[10px]">
                        <span>🏷 {c.discount}</span>
                        <span>🎯 {c.target_audience}</span>
                        <span className="text-green-700 font-medium">💰 {c.expected_revenue}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Bundle suggestions */}
          {data.bundle_suggestions?.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5" /> Bundle-förslag ({data.bundle_suggestions.length})
              </h4>
              <div className="space-y-2">
                {data.bundle_suggestions.map((b: any, i: number) => (
                  <Card key={i} className="border-border">
                    <CardContent className="p-3 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold">{b.name}</span>
                        <Badge variant="outline" className="text-[9px]">-{b.discount_percent}%</Badge>
                      </div>
                      <div className="flex gap-1 flex-wrap">
                        {b.products.map((p: string) => <span key={p} className="text-[9px] bg-muted px-1.5 py-0.5 rounded-full">{p}</span>)}
                      </div>
                      <p className="text-xs text-muted-foreground">{b.reason}</p>
                      <p className="text-[10px] text-green-700 font-medium">📈 AOV: {b.expected_aov_increase}</p>
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

// ── Data Integrity Validator Tab ──
