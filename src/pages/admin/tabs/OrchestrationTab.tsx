import { useState } from 'react';
import { Copy, Loader2, Clock, Zap, ArrowRight, GitMerge, Play, Gavel } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { callAI } from './_shared';

// ── Orchestration Tab (Double-Pass Multi-AI) ──
export const OrchestrationTab = () => {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [context, setContext] = useState('general');

  const runOrchestration = async () => {
    setLoading(true);
    setResult(null);
    const data = await callAI('double_pass', { context });
    if (data) setResult(data);
    setLoading(false);
  };

  const passStatusBadge = (score: number) => {
    if (score >= 80) return <Badge className="bg-green-500/10 text-green-600">Stark</Badge>;
    if (score >= 50) return <Badge className="bg-yellow-500/10 text-yellow-600">Godkänd</Badge>;
    return <Badge className="bg-red-500/10 text-red-600">Svag</Badge>;
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <GitMerge className="w-4 h-4 text-primary" />
            Double-Pass Multi-AI Orchestration
          </CardTitle>
          <p className="text-xs text-muted-foreground">Två-stegs AI-cykel: Generator → Validator → Executor → Governor</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <select
              value={context}
              onChange={(e) => setContext(e.target.value)}
              className="text-xs border rounded px-2 py-1.5 bg-background"
            >
              <option value="general">Generell analys</option>
              <option value="checkout">Checkout-flöde</option>
              <option value="admin">Admin-panel</option>
              <option value="products">Produkter & Kategorier</option>
              <option value="orders">Ordrar & Leverans</option>
              <option value="security">Säkerhet</option>
            </select>
            <Button size="sm" onClick={runOrchestration} disabled={loading}>
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Play className="w-3.5 h-3.5 mr-1" />}
              Kör Orchestration
            </Button>
          </div>
          {loading && (
            <div className="space-y-2 p-4 border rounded-lg bg-muted/30">
              <p className="text-xs font-medium">Kör multi-AI orchestration...</p>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="w-3 h-3 animate-spin" /> Pass 1: Generator → Validator → Executor
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" /> Pass 2: Refinement → Final Review → Governor
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground">Detta kan ta 30–60 sekunder (5 AI-anrop)</p>
            </div>
          )}
        </CardContent>
      </Card>

      {result && (
        <>
          {/* Governor Decision */}
          <Card className={cn("border-2", result.governor_decision?.ready ? "border-green-500/30" : "border-yellow-500/30")}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Gavel className="w-4 h-4" />
                Governor-beslut
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-3 flex-wrap">
                <Badge variant={result.governor_decision?.ready ? "default" : "secondary"}>
                  {result.governor_decision?.ready ? "✅ Redo för exekvering" : "⚠️ Behöver granskning"}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  Använde Pass {result.governor_decision?.use_pass} — Score: {result.governor_decision?.final_score}/100
                </span>
                {result.governor_decision?.early_stop && (
                  <Badge className="bg-blue-500/10 text-blue-600 text-[10px]">⚡ Early Stop</Badge>
                )}
                <Badge variant="outline" className="text-[10px]">
                  {result.governor_decision?.passes_run || 2} pass(es) körda
                </Badge>
                {result.prompts_queued > 0 && (
                  <Badge variant="outline" className="text-xs">{result.prompts_queued} prompts köade</Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{result.governor_decision?.reason}</p>
              {result.governor_decision?.stop_reason && (
                <div className="p-2 rounded border border-blue-500/20 bg-blue-500/5 text-xs text-blue-700">
                  <span className="font-medium">Stop-villkor:</span> {result.governor_decision.stop_reason}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pass 1 */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <ArrowRight className="w-4 h-4 text-blue-500" />
                Pass 1 — Initial
                {passStatusBadge(result.pass1?.generator?.confidence || 0)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-[50vh]">
                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-semibold mb-1">🔧 Generator</p>
                    <p className="text-xs text-muted-foreground">{result.pass1?.generator?.solution_v1?.analysis || 'N/A'}</p>
                    {result.pass1?.generator?.solution_v1?.recommendations?.map((r: string, i: number) => (
                      <Badge key={i} variant="outline" className="text-[10px] mr-1 mt-1">{r}</Badge>
                    ))}
                  </div>
                  <Separator />
                  <div>
                    <p className="text-xs font-semibold mb-1">🔍 Validator — Score: {result.pass1?.validator?.approval_score}/100</p>
                    <div className="space-y-1">
                      {result.pass1?.validator?.issues_found?.map((issue: any, i: number) => (
                        <div key={i} className="text-xs flex items-start gap-1">
                          <Badge variant="outline" className={cn("text-[10px]",
                            issue.severity === 'critical' ? 'border-red-500 text-red-600' :
                            issue.severity === 'high' ? 'border-orange-500 text-orange-600' : ''
                          )}>{issue.severity}</Badge>
                          <span className="text-muted-foreground">{issue.issue}</span>
                        </div>
                      ))}
                      {(!result.pass1?.validator?.issues_found?.length) && <p className="text-xs text-muted-foreground">Inga problem hittade</p>}
                    </div>
                  </div>
                  <Separator />
                  <div>
                    <p className="text-xs font-semibold mb-1">⚡ Executor</p>
                    {result.pass1?.refiner?.improvements?.map((imp: any, i: number) => (
                      <div key={i} className="text-xs text-muted-foreground mb-1">
                        <span className="font-medium">{imp.area}:</span> {imp.before} → {imp.after}
                      </div>
                    ))}
                    <p className="text-[10px] text-muted-foreground">{result.pass1?.refiner?.optimization_notes}</p>
                  </div>
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Pass 2 */}
          {result.pass2 ? (
           <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <ArrowRight className="w-4 h-4 text-green-500" />
                Pass 2 — Refinement
                {passStatusBadge(result.pass2?.generator?.pass2_confidence || 0)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-[50vh]">
                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-semibold mb-1">🔧 Generator v2</p>
                    <p className="text-xs text-muted-foreground">{result.pass2?.generator?.solution_v2?.final_analysis || 'N/A'}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">Delta: {result.pass2?.generator?.improvement_delta}</p>
                  </div>
                  <Separator />
                  <div>
                    <p className="text-xs font-semibold mb-1">
                      {result.pass2?.validator?.skipped_critical_review ? '🟡' : '🔴'} Critical Validator — Score: {result.pass2?.validator?.final_approval_score}/100
                    </p>
                    {result.pass2?.validator?.skipped_critical_review && (
                      <Badge className="bg-yellow-500/10 text-yellow-600 text-[10px] mb-1">Förenklad granskning (minimal förbättring)</Badge>
                    )}
                    <p className="text-xs text-muted-foreground">{result.pass2?.validator?.final_verdict}</p>
                    {result.pass2?.validator?.must_fix_before_deploy?.length > 0 && (
                      <div className="mt-2 p-2 rounded border border-destructive/30 bg-destructive/5">
                        <p className="text-[10px] font-semibold text-destructive mb-1">⚠️ Måste fixas före deploy:</p>
                        {result.pass2?.validator?.must_fix_before_deploy?.map((fix: string, i: number) => (
                          <p key={i} className="text-[10px] text-destructive/80">• {fix}</p>
                        ))}
                      </div>
                    )}
                    {result.pass2?.validator?.remaining_issues?.map((issue: any, i: number) => (
                      <div key={i} className="flex items-center gap-1 mt-1">
                        <Badge variant="outline" className={cn("text-[10px]",
                          issue.severity === 'critical' ? 'border-red-500 text-red-600' :
                          issue.severity === 'high' ? 'border-orange-500 text-orange-600' : ''
                        )}>{issue.severity}</Badge>
                        {issue.category && <Badge variant="outline" className="text-[10px]">{issue.category}</Badge>}
                        <span className="text-[10px] text-muted-foreground">{issue.issue}</span>
                      </div>
                    ))}
                  </div>
                  {result.pass2?.validator?.edge_cases_tested?.length > 0 && (
                    <>
                      <Separator />
                      <div>
                        <p className="text-xs font-semibold mb-1">🧪 Edge Cases</p>
                        {result.pass2?.validator?.edge_cases_tested?.map((ec: any, i: number) => (
                          <div key={i} className="flex items-center gap-1 mt-1">
                            <Badge variant="outline" className={cn("text-[10px]",
                              ec.result === 'fail' ? 'border-red-500 text-red-600' :
                              ec.result === 'pass' ? 'border-green-500 text-green-600' : ''
                            )}>{ec.result}</Badge>
                            <span className="text-[10px] text-muted-foreground">{ec.scenario}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                  {result.pass2?.validator?.security_audit && (
                    <>
                      <Separator />
                      <div>
                        <p className="text-xs font-semibold mb-1">🔒 Säkerhetsaudit — Risk: {result.pass2?.validator?.security_audit?.risk_level}</p>
                        {result.pass2?.validator?.security_audit?.vulnerabilities?.map((v: string, i: number) => (
                          <p key={i} className="text-[10px] text-muted-foreground">• {v}</p>
                        ))}
                      </div>
                    </>
                  )}
                  {result.pass2?.validator?.stress_test_results && (
                    <>
                      <Separator />
                      <div>
                        <p className="text-xs font-semibold mb-1">📈 Stress Test — Scalability: {result.pass2?.validator?.stress_test_results?.scalability_score}/100</p>
                        <p className="text-[10px] text-muted-foreground">Breaking point: {result.pass2?.validator?.stress_test_results?.breaking_point}</p>
                        {result.pass2?.validator?.stress_test_results?.bottlenecks?.map((b: string, i: number) => (
                          <Badge key={i} variant="outline" className="text-[10px] mr-1 mt-1">{b}</Badge>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
           </Card>
          ) : (
           <Card className="border-blue-500/20 bg-blue-500/5">
            <CardContent className="py-4">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-blue-500" />
                <p className="text-xs font-medium">Pass 2 hoppades över — lösningen var redan stabil</p>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">{result.governor_decision?.stop_reason}</p>
            </CardContent>
           </Card>
          )}

          {/* Final Actions */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Slutgiltiga åtgärder</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-[250px]">
                <div className="space-y-2">
                  {(result.governor_decision?.use_pass === 2
                    ? result.pass2?.generator?.solution_v2?.final_actions
                    : result.pass1?.refiner?.refined_actions || result.pass1?.generator?.solution_v1?.priority_actions
                  )?.map((action: any, i: number) => (
                    <div key={i} className="flex items-start gap-2 p-2 rounded border text-xs">
                      <Badge variant="outline" className={cn("text-[10px] shrink-0",
                        action.type === 'auto_fix' ? 'border-green-500 text-green-600' :
                        action.type === 'lovable_required' ? 'border-red-500 text-red-600' : 'border-yellow-500 text-yellow-600'
                      )}>{action.type === 'auto_fix' ? '🟢' : action.type === 'lovable_required' ? '🔴' : '🟡'} {action.priority}</Badge>
                      <div className="flex-1">
                        <p className="text-muted-foreground">{action.action}</p>
                        {action.rationale && <p className="text-[10px] text-muted-foreground/60 mt-0.5">{action.rationale}</p>}
                      </div>
                      {action.type === 'lovable_required' && (
                        <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => {
                          navigator.clipboard.writeText(action.action);
                          toast.success('Kopierat!');
                        }}>
                          <Copy className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};
