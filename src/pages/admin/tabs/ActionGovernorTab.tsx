import { useState } from 'react';
import { Sparkles, Copy, Loader2, Info, CheckCircle, XCircle, Clock, AlertCircle, Play, Gavel } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { callAI, copyToClipboard } from './_shared';

export const ActionGovernorTab = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [executingId, setExecutingId] = useState<string | null>(null);
  const [actionLog, setActionLog] = useState<any[]>([]);

  const runGovernor = async () => {
    setLoading(true);
    const res = await callAI('action_governor');
    if (res) {
      setResult(res);
      // Load action log
      const { data: logs } = await supabase
        .from('activity_logs')
        .select('*')
        .eq('category', 'ai')
        .in('log_type', ['ai_governor', 'ai_governor_execute', 'ai_governor_blocked'])
        .order('created_at', { ascending: false })
        .limit(20);
      setActionLog(logs || []);
    }
    setLoading(false);
  };

  const executeAction = async (actionId: string) => {
    setExecutingId(actionId);
    const res = await callAI('governor_execute', { action_id: actionId, action_classification: 'auto_fix' });
    if (res) {
      toast.success(res.executed ? `Utfört: ${res.action_taken}` : res.action_taken);
      runGovernor();
    }
    setExecutingId(null);
  };

  const classificationBadge = (c: string) => {
    if (c === 'auto_fix') return 'default' as const;
    if (c === 'assist') return 'secondary' as const;
    return 'destructive' as const;
  };

  const classificationLabel = (c: string) => {
    if (c === 'auto_fix') return '🟢 Auto-Fix';
    if (c === 'assist') return '🟡 Assist';
    return '🔴 Lovable';
  };

  const riskColor = (r: string) => {
    if (r === 'high') return 'text-destructive';
    if (r === 'medium') return 'text-yellow-600';
    return 'text-muted-foreground';
  };

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <Gavel className="w-5 h-5 text-primary" />
          <h3 className="font-bold text-sm">AI Action Governor (Lovable 0.5)</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-3">Klassificerar alla väntande åtgärder som AUTO_FIX, ASSIST eller LOVABLE_REQUIRED med konfliktdetektering.</p>
        <Button onClick={runGovernor} disabled={loading} className="w-full gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gavel className="w-4 h-4" />}
          Kör Governor-analys
        </Button>
      </div>

      {result && (
        <div className="space-y-4">
          {/* Summary */}
          {result.summary && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {[
                { label: 'Totalt', value: result.summary.total, color: 'text-foreground' },
                { label: 'Auto-Fix', value: result.summary.auto_fix_count, color: 'text-green-600' },
                { label: 'Assist', value: result.summary.assist_count, color: 'text-yellow-600' },
                { label: 'Lovable', value: result.summary.lovable_required_count, color: 'text-destructive' },
                { label: 'Risk', value: result.summary.system_risk_level, color: result.summary.system_risk_level === 'high' ? 'text-destructive' : 'text-muted-foreground' },
              ].map((m) => (
                <div key={m.label} className="bg-card border border-border rounded-lg p-3 text-center">
                  <div className={cn('text-lg font-bold', m.color)}>{m.value}</div>
                  <div className="text-[10px] text-muted-foreground">{m.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Actions list */}
          {result.actions?.length > 0 && (
            <ScrollArea className="h-[400px]">
              <div className="space-y-2">
                {result.actions.map((action: any, i: number) => (
                  <div key={i} className="bg-card border border-border rounded-lg p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <Badge variant={classificationBadge(action.classification)}>{classificationLabel(action.classification)}</Badge>
                          <span className="text-[10px] text-muted-foreground">{action.confidence}% säkerhet</span>
                          {action.conflict_risk !== 'none' && (
                            <span className={cn('text-[10px] font-medium', riskColor(action.conflict_risk))}>
                              ⚠ Konflikt: {action.conflict_risk}
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-medium">{action.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{action.fix_description}</p>
                        {action.capability && (
                          <div className={cn("text-xs mt-1 flex items-center gap-1", action.capability.can_fix ? 'text-green-600' : 'text-destructive')}>
                            {action.capability.can_fix ? <CheckCircle className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                            <span>{action.capability.explanation}</span>
                            {action.capability.fix_type && <Badge variant="outline" className="text-[9px] h-4 ml-1">{action.capability.fix_type}</Badge>}
                          </div>
                        )}
                        {action.conflict_detail && action.conflict_risk !== 'none' && (
                          <p className="text-xs text-yellow-600 mt-1">Konfliktdetalj: {action.conflict_detail}</p>
                        )}
                      </div>
                      <div className="flex flex-col gap-1.5 shrink-0">
                        {action.classification === 'auto_fix' && (
                          <Button size="sm" variant="default" className="text-xs h-7 gap-1" onClick={() => executeAction(action.id)} disabled={executingId === action.id}>
                            {executingId === action.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                            Kör
                          </Button>
                        )}
                        {action.lovable_prompt && (
                          <Button size="sm" variant="outline" className="text-xs h-7 gap-1" onClick={() => copyToClipboard(action.lovable_prompt)}>
                            <Copy className="w-3 h-3" /> Prompt
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}

          {/* Prompt Queue */}
          {result.prompt_queue?.length > 0 && (
            <div>
              <h4 className="font-semibold text-sm mb-2 flex items-center gap-1.5"><Sparkles className="w-4 h-4 text-primary" /> Prompt-kö ({result.prompt_queue.length})</h4>
              <div className="space-y-2">
                {result.prompt_queue.map((p: any, i: number) => (
                  <div key={i} className="bg-muted/30 border border-border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">{p.title}</span>
                      <Badge variant={p.priority === 'critical' ? 'destructive' : p.priority === 'high' ? 'default' : 'secondary'}>{p.priority}</Badge>
                    </div>
                    <pre className="text-xs text-muted-foreground whitespace-pre-wrap max-h-24 overflow-y-auto">{p.prompt}</pre>
                    <Button size="sm" variant="outline" className="mt-2 text-xs h-7 gap-1" onClick={() => copyToClipboard(p.prompt)}>
                      <Copy className="w-3 h-3" /> Kopiera prompt
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Log */}
          {actionLog.length > 0 && (
            <div>
              <h4 className="font-semibold text-sm mb-2 flex items-center gap-1.5"><Clock className="w-4 h-4" /> Åtgärdslogg</h4>
              <ScrollArea className="h-[200px]">
                <div className="space-y-1">
                  {actionLog.map((log: any) => (
                    <div key={log.id} className="flex items-start gap-2 text-xs py-1.5 border-b border-border/50">
                      {log.log_type === 'ai_governor_execute' ? <CheckCircle className="w-3 h-3 text-green-600 mt-0.5 shrink-0" /> :
                       log.log_type === 'ai_governor_blocked' ? <XCircle className="w-3 h-3 text-destructive mt-0.5 shrink-0" /> :
                       <Info className="w-3 h-3 text-muted-foreground mt-0.5 shrink-0" />}
                      <span className="text-muted-foreground">{log.message}</span>
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

// ── Prompt Queue Tab ──
