import { useState } from 'react';
import { BarChart3, Loader2, Send, AlertTriangle, Bot, CheckCircle, XCircle, Shield, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { triggerAiReviewForWorkItem } from '@/lib/workItemAiReview';
import { callTaskManager, useDetailContext } from './_shared';

// ── Task AI Tab ──
export const TaskAITab = () => {
  const [running, setRunning] = useState<string | null>(null);
  const [lastResults, setLastResults] = useState<any>(null);
  const queryClient = useQueryClient();
  const { openDetail } = useDetailContext();

  const { data: aiItems, isLoading: loadingItems, refetch: refetchItems } = useQuery({
    queryKey: ['ai-managed-items'],
    queryFn: async () => {
      const { data } = await supabase
        .from('work_items' as any)
        .select('id, title, status, priority, item_type, ai_confidence, ai_detected, ai_category, ai_resolution_notes, ai_assigned, assigned_to, created_at, updated_at')
        .or('ai_detected.eq.true,ai_confidence.neq.none')
        .order('created_at', { ascending: false })
        .limit(50);
      return (data || []) as any[];
    },
    refetchInterval: 30000,
  });

  const runAction = async (action: string) => {
    setRunning(action);
    const results = await callTaskManager(action);
    if (results) {
      setLastResults(results);
      refetchItems();
      const total = Object.values(results).reduce((s: number, v: any) => s + (v || 0), 0);
      toast.success(`AI slutfört: ${total} åtgärder`);
    }
    setRunning(null);
  };

  const overrideItem = async (itemId: string, updates: Record<string, any>) => {
    await supabase.from('work_items' as any).update({
      ...updates,
      updated_at: new Date().toISOString(),
    } as any).eq('id', itemId);

    if (updates.status === 'done') {
      const reviewResult = await triggerAiReviewForWorkItem(itemId, { context: 'admin_ai_override_done' });
      if (!reviewResult.ok) {
        toast.warning('AI-granskning misslyckades — satt till manuell granskning');
      }
    }

    refetchItems();
    toast.success('Uppgift uppdaterad');
  };

  const confidenceColor = (c: string) => {
    if (c === 'high') return 'text-green-700 bg-green-100 border-green-200';
    if (c === 'medium') return 'text-yellow-700 bg-yellow-100 border-yellow-200';
    return 'text-muted-foreground bg-muted border-border';
  };

  const activeItems = aiItems?.filter(i => !['done', 'cancelled'].includes(i.status)) || [];
  const resolvedItems = aiItems?.filter(i => ['done', 'cancelled'].includes(i.status)) || [];
  const detectedCount = aiItems?.filter(i => i.ai_detected && !['done', 'cancelled'].includes(i.status)).length || 0;
  const flaggedCount = aiItems?.filter(i => i.ai_resolution_notes && !['done', 'cancelled'].includes(i.status)).length || 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        {[
          { action: 'full_cycle', label: 'Kör full cykel', icon: Zap, desc: 'Alla steg' },
          { action: 'prioritize', label: 'Prioritera', icon: BarChart3, desc: 'AI-prio' },
          { action: 'assign', label: 'Tilldela', icon: Send, desc: 'Auto-assign' },
          { action: 'detect', label: 'Detektera', icon: Shield, desc: 'Sök anomalier' },
          { action: 'resolve', label: 'Verifiera', icon: CheckCircle, desc: 'Kolla lösningar' },
        ].map(a => (
          <Button
            key={a.action}
            variant={a.action === 'full_cycle' ? 'default' : 'outline'}
            className="h-auto py-2 flex flex-col items-center gap-0.5 text-xs"
            disabled={running !== null}
            onClick={() => runAction(a.action)}
          >
            {running === a.action ? <Loader2 className="w-4 h-4 animate-spin" /> : <a.icon className="w-4 h-4" />}
            <span className="font-medium">{a.label}</span>
            <span className="text-[9px] text-muted-foreground">{a.desc}</span>
          </Button>
        ))}
      </div>

      {lastResults && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {[
            { key: 'prioritized', label: 'Prioriterade', icon: BarChart3 },
            { key: 'assigned', label: 'Tilldelade', icon: Send },
            { key: 'detected', label: 'Detekterade', icon: Shield },
            { key: 'resolved', label: 'Lösta', icon: CheckCircle },
            { key: 'flagged', label: 'Flaggade', icon: AlertTriangle },
          ].map(s => (
            <Card key={s.key} className="border-border">
              <CardContent className="py-2 px-3 flex items-center gap-2">
                <s.icon className="w-3.5 h-3.5 text-muted-foreground" />
                <div>
                  <p className="text-lg font-bold leading-none">{lastResults[s.key] || 0}</p>
                  <p className="text-[9px] text-muted-foreground">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="flex gap-3 text-xs text-muted-foreground">
        <span>🤖 AI-detekterade: <strong className="text-foreground">{detectedCount}</strong></span>
        <span>🚩 Flaggade: <strong className="text-foreground">{flaggedCount}</strong></span>
        <span>✅ Lösta: <strong className="text-foreground">{resolvedItems.length}</strong></span>
      </div>

      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
          <Bot className="w-3.5 h-3.5" /> Aktiva AI-hanterade uppgifter ({activeItems.length})
        </h4>
        <ScrollArea className="max-h-[50vh]">
          <div className="space-y-2 pr-2">
            {loadingItems && <p className="text-sm text-muted-foreground py-4 text-center">Laddar...</p>}
            {!loadingItems && activeItems.length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">Inga aktiva AI-uppgifter</p>
            )}
            {activeItems.map(item => (
              <div key={item.id} className="border rounded-lg p-3 space-y-2 cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => openDetail(item.id)}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      {item.ai_detected && <Bot className="w-3.5 h-3.5 text-primary shrink-0" />}
                      <p className="text-sm font-medium line-clamp-1">{item.title}</p>
                    </div>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      <Badge variant={item.priority === 'critical' || item.priority === 'high' ? 'destructive' : 'secondary'} className="text-[9px]">
                        {item.priority}
                      </Badge>
                      {item.ai_category && <Badge variant="outline" className="text-[9px]">{item.ai_category}</Badge>}
                      {item.ai_confidence && item.ai_confidence !== 'none' && (
                        <span className={cn('text-[9px] px-1.5 py-0.5 rounded-full border', confidenceColor(item.ai_confidence))}>
                          Konfidens: {item.ai_confidence}
                        </span>
                      )}
                      <Badge variant="outline" className="text-[9px]">{item.status}</Badge>
                      {item.ai_assigned && <span className="text-[9px] text-primary">🤖 AI-tilldelad</span>}
                    </div>
                  </div>
                </div>

                {item.ai_resolution_notes && (
                  <div className="bg-muted/50 rounded-md p-2 text-xs">
                    <span className="font-medium text-muted-foreground">AI-notering:</span>
                    <p>{item.ai_resolution_notes}</p>
                  </div>
                )}

                <div className="flex gap-1.5 pt-1" onClick={e => e.stopPropagation()}>
                  {item.status !== 'done' && (
                    <>
                      <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1" onClick={() => overrideItem(item.id, { status: 'done', completed_at: new Date().toISOString() })}>
                        <CheckCircle className="w-2.5 h-2.5" /> Stäng
                      </Button>
                      <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1" onClick={() => overrideItem(item.id, { priority: 'critical' })}>
                        <AlertTriangle className="w-2.5 h-2.5" /> Eskalera
                      </Button>
                      <Button size="sm" variant="ghost" className="h-6 text-[10px] gap-1" onClick={() => overrideItem(item.id, { status: 'cancelled' })}>
                        <XCircle className="w-2.5 h-2.5" /> Avfärda
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {resolvedItems.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground">Nyligen AI-lösta ({resolvedItems.length})</h4>
          <div className="space-y-1">
            {resolvedItems.slice(0, 5).map(item => (
              <div key={item.id} className="border rounded-md p-2 flex items-center justify-between gap-2 opacity-60 cursor-pointer hover:opacity-80" onClick={() => openDetail(item.id)}>
                <div className="min-w-0">
                  <p className="text-xs truncate">{item.title}</p>
                  <p className="text-[9px] text-muted-foreground">{item.ai_resolution_notes?.substring(0, 80)}</p>
                </div>
                <Button size="sm" variant="ghost" className="h-5 text-[9px] shrink-0" onClick={(e) => { e.stopPropagation(); overrideItem(item.id, { status: 'open', completed_at: null }); }}>
                  Återöppna
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
