import { useState, useEffect } from 'react';
import { Sparkles, Copy, Loader2, Send, RefreshCw, CheckCircle, XCircle, Clock, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { logChange } from '@/utils/changeLogger';
import { copyToClipboard } from './_shared';

export const PromptQueueTab = () => {
  const [prompts, setPrompts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newGoal, setNewGoal] = useState('');
  const [newImpl, setNewImpl] = useState('');
  const [newPriority, setNewPriority] = useState('medium');
  const [showAdd, setShowAdd] = useState(false);

  const loadPrompts = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('prompt_queue' as any)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    setPrompts((data as any[]) || []);
    setLoading(false);
  };

  useEffect(() => { loadPrompts(); }, []);

  const addPrompt = async () => {
    if (!newTitle.trim() || !newImpl.trim()) { toast.error('Titel och implementation krävs'); return; }
    await supabase.from('prompt_queue' as any).insert({
      title: newTitle.trim(),
      goal: newGoal.trim() || null,
      implementation: newImpl.trim(),
      priority: newPriority,
      source_type: 'manual',
    } as any);
    setNewTitle(''); setNewGoal(''); setNewImpl(''); setShowAdd(false);
    toast.success('Prompt tillagd');
    loadPrompts();
  };

  const updateStatus = async (id: string, status: string) => {
    const updates: any = { status, updated_at: new Date().toISOString() };
    if (status === 'completed') updates.completed_at = new Date().toISOString();
    await supabase.from('prompt_queue' as any).update(updates).eq('id', id);
    if (status === 'completed') {
      logChange({ change_type: 'deployment', description: `Prompt slutförd: ${id}`, source: 'ai', affected_components: ['prompt_queue'], prompt_queue_id: id });
    }
    toast.success(`Status: ${status}`);
    loadPrompts();
  };

  const deletePrompt = async (id: string) => {
    await supabase.from('prompt_queue' as any).delete().eq('id', id);
    toast.success('Borttagen');
    loadPrompts();
  };

  const priorityBadge = (p: string) => {
    if (p === 'critical') return 'destructive' as const;
    if (p === 'high') return 'default' as const;
    return 'secondary' as const;
  };

  const statusIcon = (s: string) => {
    if (s === 'completed') return <CheckCircle className="w-3.5 h-3.5 text-green-600" />;
    if (s === 'sent') return <Send className="w-3.5 h-3.5 text-primary" />;
    return <Clock className="w-3.5 h-3.5 text-muted-foreground" />;
  };

  const statusLabel = (s: string) => {
    if (s === 'completed') return 'Klar';
    if (s === 'sent') return 'Skickad';
    return 'Väntande';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-primary" />
          <h3 className="font-bold text-sm">Prompt-kö</h3>
          <Badge variant="secondary">{prompts.filter(p => p.status === 'pending').length} väntande</Badge>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={loadPrompts} disabled={loading} className="h-7 text-xs gap-1">
            <RefreshCw className={cn("w-3 h-3", loading && "animate-spin")} /> Uppdatera
          </Button>
          <Button size="sm" onClick={() => setShowAdd(!showAdd)} className="h-7 text-xs gap-1">
            <Sparkles className="w-3 h-3" /> Ny prompt
          </Button>
        </div>
      </div>

      {showAdd && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <input className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm" placeholder="Titel" value={newTitle} onChange={e => setNewTitle(e.target.value)} />
          <input className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm" placeholder="Mål (valfritt)" value={newGoal} onChange={e => setNewGoal(e.target.value)} />
          <Textarea className="text-sm" placeholder="Implementation / Lovable-prompt..." rows={5} value={newImpl} onChange={e => setNewImpl(e.target.value)} />
          <div className="flex items-center gap-3">
            <select className="bg-background border border-border rounded-lg px-3 py-1.5 text-xs" value={newPriority} onChange={e => setNewPriority(e.target.value)}>
              <option value="critical">Kritisk</option>
              <option value="high">Hög</option>
              <option value="medium">Medium</option>
              <option value="low">Låg</option>
            </select>
            <Button size="sm" onClick={addPrompt} className="text-xs h-7">Spara</Button>
            <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)} className="text-xs h-7">Avbryt</Button>
          </div>
        </div>
      )}

      {loading && prompts.length === 0 && (
        <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      )}

      {prompts.length === 0 && !loading && (
        <div className="text-center py-10 text-sm text-muted-foreground">Inga prompts i kön. AI Governor och manuella tillägg sparas här.</div>
      )}

      <ScrollArea className="h-[500px]">
        <div className="space-y-2">
          {prompts.map((p: any) => (
            <div key={p.id} className={cn("bg-card border border-border rounded-lg p-3", p.status === 'completed' && 'opacity-60')}>
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2 flex-wrap min-w-0">
                  {statusIcon(p.status)}
                  <span className="text-sm font-medium">{p.title}</span>
                  <Badge variant={priorityBadge(p.priority)} className="text-[10px]">{p.priority}</Badge>
                  <span className="text-[10px] text-muted-foreground">{statusLabel(p.status)}</span>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => copyToClipboard(p.implementation)}>
                    <Copy className="w-3 h-3" />
                  </Button>
                  {p.status === 'pending' && (
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => updateStatus(p.id, 'sent')}>
                      <Send className="w-3 h-3" />
                    </Button>
                  )}
                  {p.status === 'sent' && (
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => updateStatus(p.id, 'completed')}>
                      <CheckCircle className="w-3 h-3" />
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive" onClick={() => deletePrompt(p.id)}>
                    <XCircle className="w-3 h-3" />
                  </Button>
                </div>
              </div>
              {p.goal && <p className="text-xs text-muted-foreground mb-1">🎯 {p.goal}</p>}
              <pre className="text-xs text-muted-foreground whitespace-pre-wrap max-h-20 overflow-y-auto bg-muted/30 rounded p-2">{p.implementation}</pre>
              <div className="flex items-center gap-2 mt-1.5 text-[10px] text-muted-foreground">
                <span>{new Date(p.created_at).toLocaleDateString('sv-SE')}</span>
                {p.source_type !== 'manual' && <Badge variant="outline" className="text-[9px] h-4">{p.source_type}</Badge>}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};

// ── Change Log Tab ──
