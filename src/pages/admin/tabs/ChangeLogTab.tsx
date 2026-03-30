import { useState, useEffect } from 'react';
import { Sparkles, Loader2, Bot, Clock, Zap, Database, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { useDetailContext } from './_shared';

export const ChangeLogTab = () => {
  const { openDetail } = useDetailContext();
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sourceFilter, setSourceFilter] = useState<string>('all');

  const loadEntries = async () => {
    setLoading(true);
    let query = supabase.from('change_log' as any).select('*').order('created_at', { ascending: false }).limit(100);
    if (sourceFilter !== 'all') query = query.eq('source', sourceFilter);
    const { data } = await query;
    setEntries(data || []);
    setLoading(false);
  };

  useEffect(() => { loadEntries(); }, [sourceFilter]);

  const sourceIcon = (s: string) => {
    if (s === 'ai') return <Bot className="w-3 h-3 text-primary" />;
    if (s === 'lovable') return <Sparkles className="w-3 h-3 text-purple-500" />;
    if (s === 'automation') return <Zap className="w-3 h-3 text-yellow-500" />;
    if (s === 'system') return <Database className="w-3 h-3 text-blue-500" />;
    return <Wrench className="w-3 h-3 text-muted-foreground" />;
  };

  const typeBadge = (t: string) => {
    if (t === 'fix') return <Badge variant="default" className="text-[10px]">Fix</Badge>;
    if (t === 'deployment') return <Badge className="bg-green-500/10 text-green-600 text-[10px]">Deploy</Badge>;
    if (t === 'scan') return <Badge className="bg-blue-500/10 text-blue-600 text-[10px]">Scan</Badge>;
    return <Badge variant="secondary" className="text-[10px]">{t}</Badge>;
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            Ändringslogg
          </CardTitle>
          <p className="text-xs text-muted-foreground">Alla systemändringar från AI, automation och manuella uppdateringar.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2 flex-wrap">
            {['all', 'ai', 'manual', 'automation', 'lovable', 'system'].map(s => (
              <Button
                key={s}
                size="sm"
                variant={sourceFilter === s ? 'default' : 'outline'}
                className="text-xs h-7"
                onClick={() => setSourceFilter(s)}
              >
                {s === 'all' ? 'Alla' : s.charAt(0).toUpperCase() + s.slice(1)}
              </Button>
            ))}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : entries.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Inga loggposter ännu.</p>
          ) : (
            <ScrollArea className="max-h-[500px]">
              <div className="space-y-2">
                {entries.map((e: any) => (
                  <div key={e.id} className={cn("flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/30 transition-colors", e.work_item_id && "cursor-pointer")} onClick={() => e.work_item_id && openDetail(e.work_item_id)}>
                    <div className="mt-0.5">{sourceIcon(e.source)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        {typeBadge(e.change_type)}
                        <span className="text-xs text-muted-foreground">
                          {new Date(e.created_at).toLocaleString('sv-SE', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-sm">{e.description}</p>
                      {e.affected_components?.length > 0 && (
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {e.affected_components.map((c: string, i: number) => (
                            <Badge key={i} variant="outline" className="text-[10px]">{c}</Badge>
                          ))}
                        </div>
                      )}
                      {(e.work_item_id || e.bug_report_id || e.scan_id || e.prompt_queue_id) && (
                        <div className="flex gap-2 mt-1.5 text-[10px] text-muted-foreground">
                          {e.work_item_id && <span>🔗 Work Item</span>}
                          {e.bug_report_id && <span>🐛 Bugg</span>}
                          {e.scan_id && <span>📡 Scan</span>}
                          {e.prompt_queue_id && <span>📋 Prompt</span>}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

