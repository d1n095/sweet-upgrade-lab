import { useState } from 'react';
import { Sparkles, Copy, Loader2, RefreshCw, CheckCircle, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { logChange } from '@/utils/changeLogger';

// ── Lova Prompts Tab ──
export const LovaPromptsTab = () => {
  const { data: prompts, isLoading, refetch } = useQuery({
    queryKey: ['lova-prompts'],
    queryFn: async () => {
      // Fetch from both prompt_queue AND work_items (legacy ai_chat prompts)
      const [pqRes, wiRes] = await Promise.all([
        supabase.from('prompt_queue').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('work_items' as any).select('id, title, description, priority, status, created_at, source_type, item_type').eq('source_type', 'ai_chat').order('created_at', { ascending: false }).limit(50),
      ]);
      const pqItems = (pqRes.data || []).map((p: any) => ({ ...p, _source: 'pq' }));
      const wiItems = (wiRes.data || []).map((w: any) => ({
        id: w.id,
        title: w.title,
        implementation: w.description || '',
        goal: '',
        priority: w.priority || 'medium',
        status: w.status === 'open' ? 'pending' : w.status === 'done' ? 'done' : w.status,
        created_at: w.created_at,
        source_type: w.source_type,
        _source: 'wi',
      }));
      // Merge, deduplicate, sort newest first
      const all = [...pqItems, ...wiItems].sort((a: any, b: any) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      return all as any[];
    },
  });

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const buildPromptText = (p: any) => {
    const implementation = (p.implementation || '').trim();
    if (implementation) return implementation;

    const title = (p.title || 'Kodändring').trim();
    const goal = (p.goal || '').trim();
    return `Implement the following change.\n\nTitle: ${title}\nGoal: ${goal || 'Improve the feature and ensure production-ready behavior.'}\n\nRequirements:\n1) Analyze existing flow and identify root cause\n2) Implement robust fix with clear edge-case handling\n3) Validate UX and error states\n4) Add/update tests where relevant\n\nExpected result:\nA stable, user-friendly and production-safe implementation.`;
  };

  const copyPrompt = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      toast.success('Prompt kopierad!');
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error('Kunde inte kopiera prompten');
    }
  };

  const priorityColor = (p: string) => {
    if (p === 'critical') return 'destructive' as const;
    if (p === 'high') return 'default' as const;
    return 'secondary' as const;
  };

  return (
    <div className="flex h-full min-h-0 flex-col space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Lova-genererade Prompts</h3>
          <p className="text-xs text-muted-foreground">Färdiga prompts att kopiera till Lovable</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1.5">
          <RefreshCw className="w-3.5 h-3.5" />
          Uppdatera
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : !prompts?.length ? (
        <div className="text-center py-12 text-muted-foreground">
          <Sparkles className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Inga prompts ännu. Be Lova generera en!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {prompts.map((p: any) => {
            const promptText = buildPromptText(p);
            const isExpanded = expandedId === p.id;

            return (
              <Card key={p.id} className="overflow-hidden">
                <CardHeader className="pb-2 pt-3 px-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-sm font-medium">{p.title}</CardTitle>
                      {p.goal && <p className="text-xs text-muted-foreground mt-0.5">{p.goal}</p>}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Badge variant={priorityColor(p.priority)} className="text-[10px]">
                        {p.priority}
                      </Badge>
                      <Badge variant={p.status === 'pending' ? 'outline' : p.status === 'done' ? 'secondary' : 'default'} className="text-[10px]">
                        {p.status === 'pending' ? '⏳ Väntar' : p.status === 'done' ? '✅ Klar' : p.status}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-3 pt-0">
                  <div className={cn(
                    "bg-muted/50 rounded-lg p-3 text-xs font-mono whitespace-pre-wrap overflow-y-auto border border-border/50",
                    isExpanded ? "max-h-[420px]" : "max-h-[120px]"
                  )}>
                    {promptText}
                  </div>
                  <div className="flex items-center justify-between mt-2 gap-2">
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(p.created_at).toLocaleString('sv-SE')}
                      {p.source_type && ` · ${p.source_type}`}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {p.status !== 'done' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1 text-xs text-green-700 hover:text-green-800 hover:bg-green-50"
                          onClick={async () => {
                            const table = p._source === 'wi' ? 'work_items' : 'prompt_queue';
                            const updateData = table === 'work_items'
                              ? { status: 'done', completed_at: new Date().toISOString() }
                              : { status: 'done' };
                            await supabase.from(table as any).update(updateData).eq('id', p.id);
                            logChange({ change_type: 'fix', description: `Prompt klar: ${p.title}`, source: 'ai', affected_components: ['prompt_queue'], prompt_queue_id: p._source === 'pq' ? p.id : undefined, work_item_id: p._source === 'wi' ? p.id : undefined });
                            toast.success('✅ Markerad som klar!');
                            refetch();
                          }}
                        >
                          <CheckCircle className="w-3 h-3" />
                          Klar
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1 text-xs"
                        onClick={() => setExpandedId(isExpanded ? null : p.id)}
                      >
                        <Eye className="w-3 h-3" />
                        {isExpanded ? 'Stäng' : 'Öppna'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 gap-1.5 text-xs"
                        onClick={() => copyPrompt(promptText, p.id)}
                      >
                        {copiedId === p.id ? (
                          <><CheckCircle className="w-3 h-3" /> Kopierad!</>
                        ) : (
                          <><Copy className="w-3 h-3" /> Kopiera</>
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
