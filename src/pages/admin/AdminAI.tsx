import { useState, useEffect, useRef, createContext, useContext, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Sparkles, Bug, BarChart3, Copy, Loader2, Send, AlertTriangle, Lightbulb, Info, RefreshCw, Bot, CheckCircle, XCircle, Shield, Clock, Zap, Activity, TrendingUp, Package, AlertCircle, Database, Wrench, Radar, ArrowRight, Layers, Monitor, Smartphone, Tablet, Eye, Compass, LayoutGrid, GitMerge, ArrowRightLeft, ShieldCheck, Play, Settings2, ToggleRight, Maximize2, Gavel } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger, ScrollableTabs } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { triggerAiReviewForWorkItem } from '@/lib/workItemAiReview';
import WorkItemDetail from '@/components/admin/workbench/WorkItemDetail';
import { useNavigate } from 'react-router-dom';
import { useScannerStore, SCAN_STEPS } from '@/stores/scannerStore';
import type { ScanStepResult } from '@/stores/scannerStore';

// Context to allow any tab to open a work item detail view
const DetailContext = createContext<{
  openDetail: (itemId: string) => void;
}>({ openDetail: () => {} });

const useDetailContext = () => useContext(DetailContext);

interface GeneratedPrompt {
  title: string;
  goal: string;
  problem?: string;
  steps: string[];
  expected_result: string;
  tags: string[];
  category: string;
  priority: string;
  full_prompt: string;
}

interface DataInsight {
  type: 'warning' | 'opportunity' | 'info';
  title: string;
  description: string;
  action: string;
}

interface DataAnalysis {
  insights: DataInsight[];
  summary: string;
  health_score: number;
  raw_metrics?: Record<string, number>;
  work_items_created?: number;
}

interface UnifiedArea {
  name: string;
  score: number;
  status: 'healthy' | 'warning' | 'critical';
  summary: string;
  actions: string[];
}

interface UnifiedReport {
  overall_score: number;
  overall_status: 'healthy' | 'warning' | 'critical';
  executive_summary: string;
  areas: UnifiedArea[];
  top_priorities: { title: string; urgency: 'now' | 'today' | 'this_week'; reason: string }[];
  raw_metrics?: Record<string, number>;
}

const callAI = async (type: string, payload: Record<string, any> = {}) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { toast.error('Ej inloggad'); return null; }

  const resp = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ type, ...payload }),
    }
  );

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    if (resp.status === 429) toast.error('AI är överbelastad, försök igen om en stund');
    else if (resp.status === 402) toast.error('AI-krediter slut');
    else toast.error(err.error || 'AI-fel');
    return null;
  }

  const data = await resp.json();
  return data.result;
};

const callTaskManager = async (action: string) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { toast.error('Ej inloggad'); return null; }

  const resp = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-task-manager`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ action }),
    }
  );

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    toast.error(err.error || 'AI Task Manager-fel');
    return null;
  }

  const data = await resp.json();
  return data.results;
};

const copyToClipboard = (text: string) => {
  navigator.clipboard.writeText(text);
  toast.success('Kopierat till urklipp');
};

// ── Lova 0.5 Chat Tab ──
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  metadata?: any;
  created_at: string;
}

const LOVA_SUGGESTIONS = [
  // Analys & data
  '📊 Analysera all data i databasen',
  '📈 Visa intäkter och orderstatus',
  '🔍 Kör full systemskanning',
  '🧹 Rensa gamla/döda uppgifter',
  // Scanningar
  '🛡️ Kör säkerhetsskanning',
  '🐛 Visa alla öppna buggar',
  '📦 Kolla lagerstatus',
  '⚡ Kör prestandaanalys',
  // Tillväxt & insikter
  '🚀 Ge tillväxtförslag',
  '💡 Föreslå nya funktioner',
  '🎯 Analysera konverteringsgrad',
  '👥 Visa användarstatistik',
  // Utseende & UX
  '🎨 Föreslå designförbättringar',
  '📱 Kolla mobilanpassning',
  // Underhåll
  '🔗 Hitta trasiga kopplingar',
  '📧 Kolla e-postsystem',
  '💰 Analysera ekonomin',
  '📋 Skapa uppgift',
];

const LovaChatTab = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to top of messages (newest first) when messages change
  const scrollToTop = useCallback(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  // Load most recent conversation
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('ai_chat_messages' as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (data?.[0]) {
        const cid = (data[0] as any).conversation_id;
        setConversationId(cid);
        const { data: history } = await supabase
          .from('ai_chat_messages' as any)
          .select('*')
          .eq('conversation_id', cid)
          .order('created_at', { ascending: true })
          .limit(100);
        if (history) setMessages(history as any);
      }
      setLoadingHistory(false);
    })();
  }, []);

  useEffect(() => {
    scrollToTop();
  }, [messages, sending, scrollToTop]);

  const sendMessage = async (overrideText?: string) => {
    const text = (overrideText || input).trim();
    if (!text || sending) return;
    setInput('');
    setSending(true);

    const tempMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: text, created_at: new Date().toISOString() };
    setMessages(prev => [...prev, tempMsg]);

    try {
      const res = await callAI('lova_chat', { message: text, conversation_id: conversationId });
      if (res) {
        if (!conversationId) setConversationId(res.conversation_id);
        const assistantMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: res.response,
          metadata: res.actions?.length ? { actions: res.actions } : undefined,
          created_at: new Date().toISOString(),
        };
        setMessages(prev => [...prev, assistantMsg]);
      }
    } catch {
      toast.error('Kunde inte skicka meddelande');
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const startNewConversation = () => {
    setMessages([]);
    setConversationId(null);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Randomize 4 suggestions each render cycle
  const [suggestions] = useState(() => {
    const shuffled = [...LOVA_SUGGESTIONS].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 4);
  });

  return (
    <div className="flex flex-col h-[calc(100vh-320px)] sm:h-[calc(100vh-280px)] min-h-[300px] sm:min-h-[400px]">
      {/* Header + Input at TOP */}
      <div className="pb-3 border-b border-border space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Bot className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-xs sm:text-sm truncate">Lova 0.5</h3>
              <p className="text-[10px] sm:text-xs text-muted-foreground truncate hidden sm:block">AI-operatör · full systemåtkomst</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={startNewConversation} className="gap-1 sm:gap-1.5 text-xs h-7 sm:h-8 px-2 sm:px-3 shrink-0">
            <RefreshCw className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            <span className="hidden sm:inline">Ny</span>
          </Button>
        </div>

        {/* Input area */}
        <div className="flex gap-1.5 sm:gap-2">
          <Textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Skriv till Lova..."
            className="min-h-[40px] sm:min-h-[44px] max-h-[100px] sm:max-h-[120px] resize-none text-xs sm:text-sm"
            rows={1}
          />
          <Button onClick={() => sendMessage()} disabled={!input.trim() || sending} size="icon" className="shrink-0 h-[40px] w-[40px] sm:h-[44px] sm:w-[44px]">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>

        {/* Quick suggestion chips */}
        {messages.length === 0 && (
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map(q => (
              <Button key={q} variant="outline" size="sm" className="text-xs h-7" onClick={() => sendMessage(q)}>
                {q}
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* Messages - scrollable area */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto py-4 px-1">
        {loadingHistory ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-12 space-y-3">
            <Bot className="w-12 h-12 mx-auto text-muted-foreground/40" />
            <div>
              <p className="font-medium text-foreground">Hej! Jag är Lova 0.5</p>
              <p className="text-sm text-muted-foreground mt-1">
                Jag kan analysera data, köra skanningar, skapa uppgifter, fixa databasfel, ge tillväxtförslag och mycket mer.
                <br />
                Om något kräver kodändringar genererar jag en prompt till Lovable.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 max-w-md mx-auto mt-4">
              <div className="text-left p-2.5 rounded-lg bg-muted/50 border border-border">
                <p className="text-xs font-medium">🔍 Skanningar</p>
                <p className="text-xs text-muted-foreground">System, säkerhet, prestanda, data, SEO</p>
              </div>
              <div className="text-left p-2.5 rounded-lg bg-muted/50 border border-border">
                <p className="text-xs font-medium">📊 Analys</p>
                <p className="text-xs text-muted-foreground">Intäkter, ordrar, konvertering, användare</p>
              </div>
              <div className="text-left p-2.5 rounded-lg bg-muted/50 border border-border">
                <p className="text-xs font-medium">🛠️ Åtgärder</p>
                <p className="text-xs text-muted-foreground">Rensa, fixa, skapa uppgifter, optimera</p>
              </div>
              <div className="text-left p-2.5 rounded-lg bg-muted/50 border border-border">
                <p className="text-xs font-medium">💡 Förslag</p>
                <p className="text-xs text-muted-foreground">Tillväxt, design, funktioner, tillägg</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {sending && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-xl px-4 py-2.5 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Lova tänker...</span>
                </div>
              </div>
            )}
            {/* Follow-up suggestions at top */}
            {messages.length > 0 && !sending && (
              <div className="flex flex-wrap gap-1.5 pb-2 border-b border-border/50">
                {['📊 Analysera mer', '🔍 Skanna systemet', '🧹 Kör cleanup', '💡 Ge förslag'].map(q => (
                  <Button key={q} variant="ghost" size="sm" className="text-xs h-7" onClick={() => sendMessage(q)}>
                    {q}
                  </Button>
                ))}
              </div>
            )}
            {[...messages].reverse().map((msg) => (
              <div key={msg.id} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                <div className={cn(
                  'max-w-[90%] sm:max-w-[80%] rounded-xl px-3 py-2 sm:px-4 sm:py-2.5 text-xs sm:text-sm',
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-foreground'
                )}>
                  <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                  {msg.metadata?.actions?.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-border/30 space-y-1">
                      {msg.metadata.actions.map((a: any, i: number) => (
                        <div key={i} className="flex items-center gap-1.5 text-xs opacity-80">
                          <Zap className="w-3 h-3" />
                          <span>{a.action}: {a.error ? `❌ ${a.error}` : '✅ Utfört'}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ── Lova Prompts Tab ──
const LovaPromptsTab = () => {
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
    <div className="space-y-4">
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

// ── Unified Dashboard Tab (NEW) ──
const UnifiedDashboardTab = () => {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<UnifiedReport | null>(null);

  const runReport = async () => {
    setLoading(true);
    const res = await callAI('unified_report');
    if (res) setReport(res);
    setLoading(false);
  };

  const statusColor = (s: string) => {
    if (s === 'healthy') return 'text-green-700 bg-green-100 border-green-300';
    if (s === 'warning') return 'text-yellow-700 bg-yellow-100 border-yellow-300';
    return 'text-red-700 bg-red-100 border-red-300';
  };

  const statusIcon = (s: string) => {
    if (s === 'healthy') return <CheckCircle className="w-4 h-4 text-green-600" />;
    if (s === 'warning') return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
    return <AlertCircle className="w-4 h-4 text-red-600" />;
  };

  const urgencyBadge = (u: string) => {
    if (u === 'now') return 'destructive' as const;
    if (u === 'today') return 'default' as const;
    return 'secondary' as const;
  };

  const urgencyLabel = (u: string) => {
    if (u === 'now') return 'NU';
    if (u === 'today') return 'Idag';
    return 'Denna vecka';
  };

  return (
    <div className="space-y-4">
      <Button onClick={runReport} disabled={loading} className="w-full gap-2">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
        Kör systemanalys (alla datakällor)
      </Button>

      {report && (
        <div className="space-y-4">
          {/* Overall score */}
          <div className={cn('border rounded-xl p-5 flex items-center gap-5', statusColor(report.overall_status))}>
            <div className={cn(
              'w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold border-2',
              report.overall_score >= 70 ? 'border-green-500 text-green-700' :
              report.overall_score >= 40 ? 'border-yellow-500 text-yellow-700' :
              'border-red-500 text-red-700'
            )}>
              {report.overall_score}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                {statusIcon(report.overall_status)}
                <h3 className="font-bold text-base">Systemstatus</h3>
              </div>
              <p className="text-sm mt-1">{report.executive_summary}</p>
            </div>
          </div>

          {/* Raw metrics grid */}
          {report.raw_metrics && (
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {[
                { key: 'revenue', label: 'Intäkter', fmt: (v: number) => `${v} kr` },
                { key: 'orders', label: 'Ordrar', fmt: (v: number) => String(v) },
                { key: 'conversion', label: 'Konvertering', fmt: (v: number) => `${v}%` },
                { key: 'openBugs', label: 'Öppna buggar', fmt: (v: number) => String(v) },
                { key: 'openItems', label: 'Öppna tasks', fmt: (v: number) => String(v) },
                { key: 'lowStock', label: 'Lågt lager', fmt: (v: number) => String(v) },
                { key: 'unresolvedIncidents', label: 'Ärenden', fmt: (v: number) => String(v) },
                { key: 'slaRate', label: 'SLA %', fmt: (v: number) => `${v}%` },
                { key: 'errorLogs', label: 'Fel (7d)', fmt: (v: number) => String(v) },
                { key: 'pendingRefunds', label: 'Refunds', fmt: (v: number) => String(v) },
              ].map(m => (
                <Card key={m.key} className="border-border">
                  <CardContent className="py-2 px-3 text-center">
                    <p className="text-lg font-bold leading-tight">{m.fmt(report.raw_metrics![m.key] || 0)}</p>
                    <p className="text-[9px] text-muted-foreground leading-tight">{m.label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Top priorities */}
          {report.top_priorities?.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5" /> Topprioriteter
              </h4>
              <div className="space-y-1.5">
                {report.top_priorities.map((p, i) => (
                  <div key={i} className="border rounded-lg p-3 flex items-start gap-3">
                    <Badge variant={urgencyBadge(p.urgency)} className="text-[9px] shrink-0 mt-0.5">
                      {urgencyLabel(p.urgency)}
                    </Badge>
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{p.title}</p>
                      <p className="text-xs text-muted-foreground">{p.reason}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Area breakdown */}
          {report.areas?.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground">Systemområden</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {report.areas.map((area, i) => (
                  <Card key={i} className="border-border">
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {statusIcon(area.status)}
                          <span className="text-sm font-semibold">{area.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={cn('text-xs font-mono font-bold', 
                            area.score >= 70 ? 'text-green-700' : area.score >= 40 ? 'text-yellow-700' : 'text-red-700'
                          )}>
                            {area.score}
                          </span>
                        </div>
                      </div>
                      <Progress value={area.score} className="h-1.5" />
                      <p className="text-xs text-muted-foreground">{area.summary}</p>
                      {area.actions.length > 0 && (
                        <ul className="text-[10px] space-y-0.5">
                          {area.actions.map((a, j) => (
                            <li key={j} className="flex items-start gap-1">
                              <span className="text-primary mt-0.5">→</span>
                              <span>{a}</span>
                            </li>
                          ))}
                        </ul>
                      )}
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

// ── Task AI Tab ──
const TaskAITab = () => {
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
        <ScrollArea className="max-h-[40vh]">
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

// ── Prompt Generator Tab ──
const PromptGeneratorTab = () => {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GeneratedPrompt | null>(null);
  const [history, setHistory] = useState<GeneratedPrompt[]>([]);

  const generate = async () => {
    if (!input.trim() || input.trim().length < 5) { toast.error('Skriv minst 5 tecken'); return; }
    setLoading(true);
    const res = await callAI('generate_prompt', { input: input.trim() });
    if (res) {
      setResult(res);
      setHistory(prev => [res, ...prev].slice(0, 20));
    }
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Textarea placeholder="Beskriv ett problem, en idé eller en bugg..." value={input} onChange={e => setInput(e.target.value)} rows={4} className="text-sm" />
        <Button onClick={generate} disabled={loading} className="w-full gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          Generera prompt
        </Button>
      </div>

      {result && (
        <div className="border rounded-lg p-4 space-y-3 bg-card">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-semibold text-sm">{result.title}</h3>
              <div className="flex gap-1.5 mt-1 flex-wrap">
                <Badge variant="outline" className="text-[10px]">{result.category}</Badge>
                <Badge variant={result.priority === 'critical' || result.priority === 'high' ? 'destructive' : 'secondary'} className="text-[10px]">{result.priority}</Badge>
                {result.tags.map(t => <span key={t} className="text-[9px] bg-muted px-1.5 py-0.5 rounded-full">{t}</span>)}
              </div>
            </div>
            <Button size="sm" variant="outline" className="gap-1 h-7 text-xs shrink-0" onClick={() => copyToClipboard(result.full_prompt)}>
              <Copy className="w-3 h-3" /> Kopiera
            </Button>
          </div>
          <Separator />
          <div className="space-y-2 text-sm">
            <div><span className="text-xs font-semibold text-muted-foreground">🎯 MÅL</span><p className="text-sm">{result.goal}</p></div>
            {result.problem && <div><span className="text-xs font-semibold text-muted-foreground">⚠️ PROBLEM</span><p className="text-sm">{result.problem}</p></div>}
            <div><span className="text-xs font-semibold text-muted-foreground">📋 STEG</span><ol className="list-decimal list-inside text-sm space-y-0.5 mt-0.5">{result.steps.map((s, i) => <li key={i}>{s}</li>)}</ol></div>
            <div><span className="text-xs font-semibold text-muted-foreground">✅ FÖRVÄNTAT RESULTAT</span><p className="text-sm">{result.expected_result}</p></div>
          </div>
          <Separator />
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-muted-foreground">Full prompt</span>
              <Button size="sm" variant="ghost" className="h-5 text-[9px] gap-0.5 px-1" onClick={() => copyToClipboard(result.full_prompt)}><Copy className="w-2.5 h-2.5" /> Kopiera</Button>
            </div>
            <div className="text-xs bg-muted/50 rounded-md p-3 whitespace-pre-wrap border font-mono max-h-60 overflow-y-auto">{result.full_prompt}</div>
          </div>
        </div>
      )}

      {history.length > 1 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground">Historik</h4>
          {history.slice(1).map((h, i) => (
            <div key={i} className="border rounded-md p-2 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-medium truncate">{h.title}</p>
                <div className="flex gap-1 mt-0.5">
                  <Badge variant="outline" className="text-[9px]">{h.category}</Badge>
                  <Badge variant="secondary" className="text-[9px]">{h.priority}</Badge>
                </div>
              </div>
              <Button size="sm" variant="ghost" className="h-6 text-[9px] shrink-0" onClick={() => { setResult(h); copyToClipboard(h.full_prompt); }}>
                <Copy className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Data Insights Tab ──
const DataInsightsTab = () => {
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<DataAnalysis | null>(null);
  const [autoAction, setAutoAction] = useState(false);

  const analyze = async () => {
    setLoading(true);
    const res = await callAI('data_insights', { auto_action: autoAction });
    if (res) {
      setAnalysis(res);
      if (res.work_items_created > 0) {
        toast.success(`${res.work_items_created} uppgifter skapade från varningar`);
      }
    }
    setLoading(false);
  };

  const createTaskFromInsight = async (insight: DataInsight) => {
    const res = await callAI('create_action', {
      title: insight.title,
      description: `${insight.description}\n\nRekommenderad åtgärd: ${insight.action}`,
      priority: insight.type === 'warning' ? 'high' : 'medium',
      category: 'business',
      source_type: 'insight',
    });
    if (res?.created) toast.success('Uppgift skapad i Workbench');
  };

  const INSIGHT_ICONS: Record<string, any> = { warning: AlertTriangle, opportunity: Lightbulb, info: Info };
  const INSIGHT_COLORS: Record<string, string> = {
    warning: 'text-destructive bg-destructive/10 border-destructive/20',
    opportunity: 'text-green-700 bg-green-50 border-green-200',
    info: 'text-blue-700 bg-blue-50 border-blue-200',
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 items-end">
        <Button onClick={analyze} disabled={loading} className="flex-1 gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <BarChart3 className="w-4 h-4" />}
          Analysera hela systemet
        </Button>
        <Button variant={autoAction ? 'default' : 'outline'} size="sm" className="gap-1 text-xs h-9" onClick={() => setAutoAction(!autoAction)}>
          <Zap className="w-3.5 h-3.5" />
          {autoAction ? 'Auto-action PÅ' : 'Auto-action AV'}
        </Button>
      </div>
      {autoAction && <p className="text-[10px] text-muted-foreground">⚡ Varningar skapar automatiskt uppgifter i Workbench</p>}

      {analysis && (
        <div className="space-y-4">
          <div className="border rounded-lg p-4 flex items-center gap-4">
            <div className={cn(
              'w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold border-2',
              analysis.health_score >= 70 ? 'border-green-500 text-green-700 bg-green-50' :
              analysis.health_score >= 40 ? 'border-yellow-500 text-yellow-700 bg-yellow-50' :
              'border-red-500 text-red-700 bg-red-50'
            )}>
              {analysis.health_score}
            </div>
            <div>
              <h3 className="text-sm font-semibold">Systemhälsa</h3>
              <p className="text-xs text-muted-foreground">{analysis.summary}</p>
            </div>
          </div>

          <div className="space-y-2">
            {analysis.insights.map((insight, i) => {
              const Icon = INSIGHT_ICONS[insight.type] || Info;
              return (
                <div key={i} className={cn('border rounded-lg p-3 space-y-1', INSIGHT_COLORS[insight.type])}>
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 shrink-0" />
                    <h4 className="text-sm font-semibold">{insight.title}</h4>
                  </div>
                  <p className="text-xs">{insight.description}</p>
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-1">
                      <Send className="w-3 h-3" />
                      <span className="text-xs font-medium">{insight.action}</span>
                    </div>
                    <Button size="sm" variant="outline" className="h-5 text-[9px] gap-0.5" onClick={() => createTaskFromInsight(insight)}>
                      <Zap className="w-2.5 h-2.5" /> Skapa uppgift
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Bug AI Tab ──
const BugAITab = () => {
  const [bugs, setBugs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState<string | null>(null);
  const [fixes, setFixes] = useState<Record<string, any>>({});

  const loadBugs = async () => {
    setLoading(true);
    const { data } = await supabase.from('bug_reports').select('id, description, page_url, status, ai_summary, ai_severity, ai_category, created_at').eq('status', 'open').order('created_at', { ascending: false }).limit(20);
    setBugs(data || []);
    setLoading(false);
  };

  const analyzeBug = async (bugId: string) => {
    setAnalyzing(bugId);
    const res = await callAI('bug_fix_suggestion', { bug_id: bugId });
    if (res) setFixes(prev => ({ ...prev, [bugId]: res }));
    setAnalyzing(null);
  };

  return (
    <div className="space-y-4">
      <Button onClick={loadBugs} disabled={loading} variant="outline" className="w-full gap-2">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        Ladda öppna buggar
      </Button>

      {bugs.length === 0 && !loading && (
        <p className="text-sm text-muted-foreground text-center py-6">Inga öppna buggar 🎉</p>
      )}

      <ScrollArea className="max-h-[60vh]">
        <div className="space-y-3 pr-2">
          {bugs.map(bug => (
            <div key={bug.id} className="border rounded-lg p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium line-clamp-2">{bug.ai_summary || bug.description}</p>
                  <div className="flex gap-1.5 mt-1 flex-wrap">
                    {bug.ai_severity && <Badge variant={bug.ai_severity === 'critical' || bug.ai_severity === 'high' ? 'destructive' : 'secondary'} className="text-[10px]">{bug.ai_severity}</Badge>}
                    {bug.ai_category && <Badge variant="outline" className="text-[10px]">{bug.ai_category}</Badge>}
                    <span className="text-[10px] text-muted-foreground">{bug.page_url}</span>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="sm" variant="outline" className="gap-1 h-7 text-xs" disabled={analyzing === bug.id} onClick={() => analyzeBug(bug.id)}>
                    {analyzing === bug.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                    Analysera
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1 h-7 text-xs" disabled={analyzing === bug.id} onClick={async () => {
                    setAnalyzing(bug.id);
                    const res = await callAI('bug_deep_analysis', { bug_id: bug.id });
                    if (res) setFixes(prev => ({ ...prev, [bug.id]: { ...res, _deep: true } }));
                    setAnalyzing(null);
                  }}>
                    {analyzing === bug.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Activity className="w-3 h-3" />}
                    Djupanalys
                  </Button>
                </div>
              </div>

              {fixes[bug.id] && fixes[bug.id]._deep ? (
                /* Deep analysis view */
                <div className="border-t pt-2 space-y-3 mt-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                    <Activity className="w-3.5 h-3.5" />
                    AI Djupanalys
                    <Badge variant="outline" className="text-[9px] ml-auto">Risk: {fixes[bug.id].overall_risk}</Badge>
                    {fixes[bug.id].is_recurring && <Badge variant="destructive" className="text-[9px]">Återkommande</Badge>}
                  </div>

                  {/* Diagnosis */}
                  {fixes[bug.id].diagnosis && (
                    <div className="bg-muted/50 rounded-md p-2 space-y-1">
                      <p className="text-xs font-medium">Diagnos (konfidens: {fixes[bug.id].diagnosis.confidence}%)</p>
                      <p className="text-xs">{fixes[bug.id].diagnosis.summary}</p>
                      <p className="text-xs text-muted-foreground"><strong>Trolig orsak:</strong> {fixes[bug.id].diagnosis.likely_cause}</p>
                      {fixes[bug.id].diagnosis.evidence?.length > 0 && (
                        <div className="text-xs space-y-0.5 mt-1">
                          <span className="text-muted-foreground font-medium">Bevis:</span>
                          {fixes[bug.id].diagnosis.evidence.map((e: string, i: number) => (
                            <p key={i} className="text-[11px] text-muted-foreground pl-2">• {e}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Log Analysis */}
                  {fixes[bug.id].log_analysis && (
                    <div className="space-y-1">
                      <p className="text-xs font-medium flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Logganalys</p>
                      {fixes[bug.id].log_analysis.error_pattern && <p className="text-xs text-muted-foreground">{fixes[bug.id].log_analysis.error_pattern}</p>}
                      {fixes[bug.id].log_analysis.relevant_errors?.length > 0 && (
                        <div className="text-[11px] bg-muted rounded p-1.5 space-y-0.5 font-mono max-h-24 overflow-y-auto">
                          {fixes[bug.id].log_analysis.relevant_errors.slice(0, 5).map((e: string, i: number) => <p key={i}>{e}</p>)}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Historical Matches */}
                  {fixes[bug.id].historical_matches?.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs font-medium flex items-center gap-1"><Clock className="w-3 h-3" /> Historiska matchningar</p>
                      {fixes[bug.id].historical_matches.slice(0, 3).map((m: any, i: number) => (
                        <div key={i} className="text-xs border border-border rounded p-1.5">
                          <div className="flex items-center gap-1.5">
                            <Badge variant="outline" className="text-[9px]">{m.similarity}% match</Badge>
                            {m.was_resolved ? <CheckCircle className="w-3 h-3 text-green-600" /> : <XCircle className="w-3 h-3 text-destructive" />}
                            <span className="truncate">{m.bug_summary}</span>
                          </div>
                          {m.lesson && <p className="text-[11px] text-muted-foreground mt-0.5">💡 {m.lesson}</p>}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Recurring Pattern */}
                  {fixes[bug.id].is_recurring && fixes[bug.id].recurring_info && (
                    <div className="bg-destructive/5 border border-destructive/20 rounded-md p-2 space-y-1">
                      <p className="text-xs font-medium text-destructive">⚠️ Återkommande problem</p>
                      <p className="text-xs">{fixes[bug.id].recurring_info.pattern}</p>
                      {fixes[bug.id].recurring_info.prevention && (
                        <p className="text-xs text-muted-foreground"><strong>Förebyggande:</strong> {fixes[bug.id].recurring_info.prevention}</p>
                      )}
                    </div>
                  )}

                  {/* Fix Suggestions */}
                  {fixes[bug.id].fix_suggestions?.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium">Fix-förslag</p>
                      {fixes[bug.id].fix_suggestions.map((f: any, i: number) => (
                        <div key={i} className="border border-border rounded p-2 space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-medium">{f.title}</span>
                            <Badge variant="outline" className="text-[9px]">Effort: {f.effort}</Badge>
                            <Badge variant="outline" className="text-[9px]">Risk: {f.risk}</Badge>
                          </div>
                          <p className="text-[11px] text-muted-foreground">{f.description}</p>
                          {f.based_on && <p className="text-[10px] text-muted-foreground italic">Baserat på: {f.based_on}</p>}
                          <Button size="sm" variant="ghost" className="h-5 text-[10px] gap-1 p-0 px-1" onClick={() => copyToClipboard(f.lovable_prompt)}>
                            <Copy className="w-2.5 h-2.5" /> Kopiera prompt
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : fixes[bug.id] ? (
                /* Standard analysis view */
                <div className="border-t pt-2 space-y-2 mt-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                    <Sparkles className="w-3.5 h-3.5" />
                    AI Fix-förslag
                    <Badge variant="outline" className="text-[9px] ml-auto">Risk: {fixes[bug.id].overall_risk}</Badge>
                    {fixes[bug.id].is_recurring && <Badge variant="destructive" className="text-[9px]">Återkommande</Badge>}
                  </div>
                  {fixes[bug.id].log_insights && (
                    <p className="text-[11px] text-muted-foreground bg-muted/50 rounded p-1.5">📊 {fixes[bug.id].log_insights}</p>
                  )}
                  {fixes[bug.id].root_causes?.map((rc: any, i: number) => (
                    <div key={i} className="border border-border rounded p-2 space-y-1">
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className="text-[9px]">{rc.confidence}%</Badge>
                        <span className="text-xs font-medium">{rc.cause}</span>
                        <Badge variant="outline" className="text-[9px] ml-auto">{rc.risk_level}</Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground">{rc.fix_strategy}</p>
                      {rc.historical_match && <p className="text-[10px] text-muted-foreground italic">📜 {rc.historical_match}</p>}
                      <div className="flex gap-1 flex-wrap">{rc.affected_areas?.map((a: string) => <span key={a} className="text-[9px] bg-muted px-1.5 py-0.5 rounded-full">{a}</span>)}</div>
                      <Button size="sm" variant="ghost" className="h-5 text-[10px] gap-1 p-0 px-1" onClick={() => copyToClipboard(rc.lovable_prompt)}>
                        <Copy className="w-2.5 h-2.5" /> Kopiera prompt
                      </Button>
                    </div>
                  )) || (
                    /* Fallback for old format */
                    <div className="space-y-1.5 text-xs">
                      <div><span className="text-muted-foreground font-medium">Trolig orsak:</span><p>{fixes[bug.id].possible_cause}</p></div>
                      <div><span className="text-muted-foreground font-medium">Fix-strategi:</span><p>{fixes[bug.id].fix_strategy}</p></div>
                    </div>
                  )}
                  <div className="flex gap-1.5 pt-1">
                    <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1 flex-1" onClick={() => copyToClipboard(fixes[bug.id].lovable_prompt || fixes[bug.id].root_causes?.[0]?.lovable_prompt || '')}>
                      <Copy className="w-2.5 h-2.5" /> Kopiera prompt
                    </Button>
                    <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1 flex-1" onClick={async () => {
                      const topCause = fixes[bug.id].root_causes?.[0];
                      const res = await callAI('create_action', {
                        title: `Fix: ${bug.ai_summary || bug.description.substring(0, 80)}`,
                        description: topCause ? `Orsak: ${topCause.cause}\nStrategi: ${topCause.fix_strategy}\n\n${topCause.lovable_prompt}` : fixes[bug.id].summary,
                        priority: bug.ai_severity === 'critical' ? 'critical' : bug.ai_severity === 'high' ? 'high' : 'medium',
                        category: bug.ai_category || 'bug',
                        source_type: 'bug_fix',
                        source_id: bug.id,
                      });
                      if (res?.created) toast.success('Uppgift skapad i Workbench');
                    }}>
                      <Zap className="w-2.5 h-2.5" /> Skapa uppgift
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};

// ── Product Suggestions Tab ──
const ProductSuggestionsTab = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);

  const run = async () => {
    setLoading(true);
    const res = await callAI('product_suggestions');
    if (res) setData(res);
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      <Button onClick={run} disabled={loading} className="w-full gap-2">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Package className="w-4 h-4" />}
        Analysera produkter & försäljning
      </Button>

      {data && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{data.summary}</p>

          {data.new_products?.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5"><Lightbulb className="w-3.5 h-3.5" /> Nya produktförslag</h4>
              {data.new_products.map((p: any, i: number) => (
                <Card key={i} className="border-border">
                  <CardContent className="p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold">{p.name}</span>
                      <Badge variant="outline" className="text-[9px]">{p.category}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{p.reason}</p>
                    <p className="text-xs font-medium">Uppskattat pris: {p.estimated_price}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {data.bundles?.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5"><Package className="w-3.5 h-3.5" /> Bundle-förslag</h4>
              {data.bundles.map((b: any, i: number) => (
                <Card key={i} className="border-border">
                  <CardContent className="p-3 space-y-1">
                    <span className="text-sm font-semibold">{b.name}</span>
                    <div className="flex gap-1 flex-wrap">{b.products.map((p: string) => <span key={p} className="text-[9px] bg-muted px-1.5 py-0.5 rounded-full">{p}</span>)}</div>
                    <p className="text-xs text-muted-foreground">{b.reason}</p>
                    <Badge variant="secondary" className="text-[9px]">Rabatt: {b.discount}</Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {data.pricing_suggestions?.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5" /> Prisförslag</h4>
              {data.pricing_suggestions.map((p: any, i: number) => (
                <div key={i} className="border rounded-lg p-3 space-y-1">
                  <span className="text-sm font-medium">{p.product}</span>
                  {p.current_price && <span className="text-xs text-muted-foreground ml-2">({p.current_price})</span>}
                  <p className="text-xs"><span className="font-medium">Åtgärd:</span> {p.suggested_action}</p>
                  <p className="text-xs text-muted-foreground">{p.reason}</p>
                </div>
              ))}
            </div>
          )}

          {data.campaign_ideas?.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5"><Zap className="w-3.5 h-3.5" /> Kampanjidéer</h4>
              {data.campaign_ideas.map((c: any, i: number) => (
                <div key={i} className="border rounded-lg p-3 space-y-1">
                  <span className="text-sm font-semibold">{c.title}</span>
                  <p className="text-xs text-muted-foreground">{c.description}</p>
                  <Badge variant="outline" className="text-[9px]">Målgrupp: {c.target}</Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── System Health Tab ──
const SystemHealthTab = () => {
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
          )}

          {data.duplicate_bugs?.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5"><Bug className="w-3.5 h-3.5" /> Duplicerade buggar ({data.duplicate_bugs.length})</h4>
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
          )}
        </div>
      )}
    </div>
  );
};

// ── Trend Analysis Panel ──
const TrendAnalysisPanel = () => {
  const [loading, setLoading] = useState(false);
  const [trends, setTrends] = useState<any>(null);
  const [expanded, setExpanded] = useState(false);

  const runTrends = async () => {
    setLoading(true);
    const res = await callAI('memory_trends');
    if (res) {
      setTrends(res);
      if (!res.trend_available) toast.info(res.message);
      else toast.success('Trendanalys klar');
    }
    setLoading(false);
  };

  const trendIcon = (dir: string) => {
    if (dir === 'improving' || dir === 'up' || dir === 'decreasing') return <TrendingUp className="w-4 h-4 text-accent" />;
    if (dir === 'stable' || dir === 'unchanged') return <Activity className="w-4 h-4 text-muted-foreground" />;
    return <AlertTriangle className="w-4 h-4 text-destructive" />;
  };

  const trendLabel = (dir: string) => {
    if (dir === 'improving' || dir === 'up' || dir === 'decreasing') return 'Förbättras';
    if (dir === 'stable' || dir === 'unchanged') return 'Stabilt';
    return 'Försämras';
  };

  const trendColor = (dir: string) => {
    if (dir === 'improving' || dir === 'up' || dir === 'decreasing') return 'text-accent';
    if (dir === 'stable' || dir === 'unchanged') return 'text-muted-foreground';
    return 'text-destructive';
  };

  const changeIcon = (c: string) => {
    if (c === 'improved') return <CheckCircle className="w-3.5 h-3.5 text-accent" />;
    if (c === 'unchanged') return <Activity className="w-3.5 h-3.5 text-muted-foreground" />;
    return <XCircle className="w-3.5 h-3.5 text-destructive" />;
  };

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" />
          <h4 className="text-sm font-bold">AI Minne & Trendanalys</h4>
        </div>
        <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={runTrends} disabled={loading}>
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Compass className="w-3.5 h-3.5" />}
          {loading ? 'Analyserar...' : 'Kör trendanalys'}
        </Button>
      </div>

      {!trends && !loading && (
        <p className="text-xs text-muted-foreground text-center py-2">Klicka för att analysera systemets utveckling över tid</p>
      )}

      {trends?.trend_available === false && (
        <div className="text-center py-4">
          <Info className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">{trends.message}</p>
        </div>
      )}

      {trends?.trend_available && (
        <div className="space-y-3">
          {/* Overall trend */}
          <div className={cn('border rounded-lg p-3 flex items-center gap-3',
            trends.overall_trend === 'improving' ? 'border-accent/30 bg-accent/5' :
            trends.overall_trend === 'stable' ? 'border-border bg-muted/20' :
            'border-destructive/30 bg-destructive/5'
          )}>
            {trendIcon(trends.overall_trend)}
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className={cn('text-xs font-bold', trendColor(trends.overall_trend))}>
                  {trendLabel(trends.overall_trend)}
                </span>
                <Badge variant="secondary" className="text-[9px]">{trends.scan_count} skanningar</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{trends.trend_summary}</p>
            </div>
          </div>

          {/* Metric trends */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Systempoäng', data: trends.score_trend, extra: trends.score_trend?.change != null ? `${trends.score_trend.change > 0 ? '+' : ''}${trends.score_trend.change}` : '' },
              { label: 'Buggar', data: trends.bug_trend },
              { label: 'Prestanda', data: trends.performance_trend },
            ].map(t => (
              <div key={t.label} className="border rounded-lg p-2.5 space-y-1">
                <div className="flex items-center gap-1.5">
                  {trendIcon(t.data?.direction)}
                  <span className="text-[10px] font-medium text-muted-foreground">{t.label}</span>
                </div>
                <p className={cn('text-xs font-bold', trendColor(t.data?.direction))}>
                  {trendLabel(t.data?.direction)} {t.extra && <span className="text-[10px] font-normal">({t.extra})</span>}
                </p>
                <p className="text-[10px] text-muted-foreground line-clamp-2">{t.data?.message}</p>
              </div>
            ))}
          </div>

          {/* Score timeline mini chart */}
          {trends.scan_timeline?.length > 1 && (
            <div className="border rounded-lg p-3">
              <h5 className="text-[10px] font-semibold text-muted-foreground mb-2">Poängutveckling</h5>
              <div className="flex items-end gap-1 h-12">
                {trends.scan_timeline.map((s: any, i: number) => {
                  const score = s.score || 0;
                  const height = Math.max(4, (score / 100) * 48);
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-0.5" title={`${new Date(s.date).toLocaleDateString('sv-SE')}: ${score}`}>
                      <div
                        className={cn('w-full rounded-sm min-w-[4px]',
                          score >= 70 ? 'bg-accent' : score >= 40 ? 'bg-yellow-400' : 'bg-destructive'
                        )}
                        style={{ height: `${height}px` }}
                      />
                      <span className="text-[8px] text-muted-foreground">{score}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Key changes */}
          <Button variant="ghost" size="sm" className="w-full text-xs gap-1.5" onClick={() => setExpanded(!expanded)}>
            {expanded ? 'Dölj detaljer' : 'Visa förändringar & rekommendationer'}
          </Button>

          {expanded && (
            <>
              {trends.key_changes?.length > 0 && (
                <div className="space-y-1.5">
                  <h5 className="text-[10px] font-semibold text-muted-foreground">Nyckelförändringar</h5>
                  {trends.key_changes.map((kc: any, i: number) => (
                    <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-secondary/20">
                      {changeIcon(kc.change)}
                      <div>
                        <span className="text-xs font-medium">{kc.area}</span>
                        <p className="text-[10px] text-muted-foreground">{kc.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {trends.recommendations?.length > 0 && (
                <div className="space-y-1.5">
                  <h5 className="text-[10px] font-semibold text-muted-foreground">AI-rekommendationer</h5>
                  {trends.recommendations.map((rec: string, i: number) => (
                    <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-primary/5 border border-primary/10">
                      <Lightbulb className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                      <p className="text-xs">{rec}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Raw stats */}
              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div className="border rounded p-2">
                  <p className="text-muted-foreground">Buggar öppna / lösta</p>
                  <p className="font-bold">{trends.bug_stats?.open} / {trends.bug_stats?.resolved}</p>
                </div>
                <div className="border rounded p-2">
                  <p className="text-muted-foreground">Uppgifter öppna / klara</p>
                  <p className="font-bold">{trends.work_stats?.open} / {trends.work_stats?.done}</p>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </Card>
  );
};

// ── System Scan Tab (MASTER ENGINE) ──
const SystemScanTab = () => {
  const [loading, setLoading] = useState(false);
  const [scanResult, setScanResult] = useState<any>(null);
  const [expandedIssue, setExpandedIssue] = useState<number | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [compareId, setCompareId] = useState<string | null>(null);
  const [compareData, setCompareData] = useState<any>(null);
  const { openDetail } = useDetailContext();
  const queryClient = useQueryClient();

  // Load last scan on mount
  const { data: lastScan } = useQuery({
    queryKey: ['last-scan-result'],
    queryFn: async () => {
      const { data } = await supabase
        .from('ai_scan_results' as any)
        .select('*')
        .eq('scan_type', 'system_scan')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as any;
    },
  });

  // Load scan history
  const { data: scanHistory = [] } = useQuery({
    queryKey: ['scan-history'],
    queryFn: async () => {
      const { data } = await supabase
        .from('ai_scan_results' as any)
        .select('id, scan_type, overall_score, overall_status, executive_summary, issues_count, tasks_created, created_at')
        .eq('scan_type', 'system_scan')
        .order('created_at', { ascending: false })
        .limit(20);
      return (data || []) as any[];
    },
  });

  // Set last scan as current if no active result
  useEffect(() => {
    if (!scanResult && lastScan?.results) {
      setScanResult(lastScan.results);
    }
  }, [lastScan, scanResult]);

  const runScan = async () => {
    setLoading(true);
    const res = await callAI('system_scan');
    if (res) {
      setScanResult(res);
      // Persist to DB
      const { data: { session } } = await supabase.auth.getSession();
      await supabase.from('ai_scan_results' as any).insert({
        scan_type: 'system_scan',
        results: res,
        overall_score: res.system_score || null,
        overall_status: res.system_score >= 70 ? 'healthy' : res.system_score >= 40 ? 'warning' : 'critical',
        executive_summary: res.executive_summary || null,
        issues_count: res.issues_found || 0,
        tasks_created: res.tasks_created || 0,
        scanned_by: session?.user?.id || null,
      } as any);
      queryClient.invalidateQueries({ queryKey: ['last-scan-result'] });
      queryClient.invalidateQueries({ queryKey: ['scan-history'] });
    }
    setLoading(false);
  };

  const loadHistoryScan = async (id: string) => {
    const { data } = await supabase.from('ai_scan_results' as any).select('*').eq('id', id).maybeSingle();
    if (data) {
      if (compareId === id) {
        setCompareData((data as any).results);
      } else {
        setScanResult((data as any).results);
        setShowHistory(false);
      }
    }
  };

  const typeIcon = (t: string) => {
    if (t === 'bug') return <Bug className="w-3.5 h-3.5 text-destructive" />;
    if (t === 'improvement') return <TrendingUp className="w-3.5 h-3.5 text-blue-600" />;
    if (t === 'feature') return <Sparkles className="w-3.5 h-3.5 text-purple-600" />;
    if (t === 'upgrade') return <Shield className="w-3.5 h-3.5 text-orange-600" />;
    return <Wrench className="w-3.5 h-3.5 text-muted-foreground" />;
  };

  const urgencyStyle = (u: string) => {
    if (u === 'now') return 'bg-destructive/10 text-destructive border-destructive/20';
    if (u === 'today') return 'bg-orange-50 text-orange-700 border-orange-200';
    if (u === 'this_week') return 'bg-blue-50 text-blue-700 border-blue-200';
    return 'bg-muted text-muted-foreground border-border';
  };

  const urgencyLabel = (u: string) => {
    if (u === 'now') return '🔴 NU';
    if (u === 'today') return '🟠 Idag';
    if (u === 'this_week') return '🔵 Denna vecka';
    return '⚪ Backlog';
  };

  const renderTaskGroup = (title: string, items: any[], color: string) => {
    if (!items?.length) return null;
    return (
      <div className="space-y-2">
        <h4 className={cn('text-xs font-bold flex items-center gap-1.5', color)}>
          <Layers className="w-3.5 h-3.5" /> {title} ({items.length})
        </h4>
        <div className="space-y-1.5">
          {items.map((task: any, i: number) => (
            <div
              key={task.id || i}
              className={cn(
                "border rounded-lg p-2.5 flex items-start gap-2 transition-colors",
                task.id && "cursor-pointer hover:bg-muted/40"
              )}
              onClick={() => task.id && openDetail(task.id)}
            >
              <span className="text-[10px] font-mono text-muted-foreground mt-0.5 w-5 shrink-0">#{task.execution_order || '—'}</span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium line-clamp-1">{task.title}</p>
                <div className="flex gap-1 mt-0.5 flex-wrap">
                  <Badge variant={task.priority === 'critical' || task.priority === 'high' ? 'destructive' : 'secondary'} className="text-[8px]">{task.priority}</Badge>
                  {task.ai_type_classification && <Badge variant="outline" className="text-[8px]">{task.ai_type_classification}</Badge>}
                  {task.ai_category && <span className="text-[8px] bg-muted px-1 py-0.5 rounded">{task.ai_category}</span>}
                  {task.conflict_flag && <span className="text-[8px] text-destructive">⚠️ konflikt</span>}
                  {task.duplicate_of && <span className="text-[8px] text-muted-foreground">📎 dubblett</span>}
                </div>
              </div>
              {task.id && <ArrowRight className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderScoreComparison = () => {
    if (!compareData || !scanResult) return null;
    const diff = (scanResult.system_score || 0) - (compareData.system_score || 0);
    return (
      <div className="border rounded-xl p-4 bg-card space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold flex items-center gap-1.5">
            <ArrowRightLeft className="w-4 h-4" /> Jämförelse
          </h4>
          <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => { setCompareId(null); setCompareData(null); }}>
            Stäng
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-[10px] text-muted-foreground">Nuvarande</p>
            <p className={cn('text-2xl font-bold', (scanResult.system_score || 0) >= 70 ? 'text-green-700' : (scanResult.system_score || 0) >= 40 ? 'text-yellow-700' : 'text-destructive')}>
              {scanResult.system_score || 0}
            </p>
          </div>
          <div className="flex items-center justify-center">
            <span className={cn('text-sm font-bold', diff > 0 ? 'text-green-700' : diff < 0 ? 'text-destructive' : 'text-muted-foreground')}>
              {diff > 0 ? `+${diff}` : diff}
            </span>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground">Tidigare</p>
            <p className={cn('text-2xl font-bold', (compareData.system_score || 0) >= 70 ? 'text-green-700' : (compareData.system_score || 0) >= 40 ? 'text-yellow-700' : 'text-destructive')}>
              {compareData.system_score || 0}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="border rounded p-2">
            <p className="text-muted-foreground text-[10px]">Issues nu</p>
            <p className="font-bold">{scanResult.issues_found || 0}</p>
          </div>
          <div className="border rounded p-2">
            <p className="text-muted-foreground text-[10px]">Issues förr</p>
            <p className="font-bold">{compareData.issues_found || 0}</p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="border rounded-xl p-4 bg-card space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Radar className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold">Full Systemskanning</h3>
            <p className="text-[10px] text-muted-foreground">Skannar → Detekterar → Skapar uppgifter → Prioriterar → Ordnar</p>
          </div>
          <Button size="sm" variant="outline" className="gap-1 text-xs shrink-0" onClick={() => setShowHistory(!showHistory)}>
            <Clock className="w-3.5 h-3.5" />
            Historik ({scanHistory.length})
          </Button>
        </div>
        <Button onClick={runScan} disabled={loading} className="w-full gap-2" size="lg">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Radar className="w-4 h-4" />}
          {loading ? 'Skannar hela systemet...' : 'Kör full systemskanning'}
        </Button>
        {loading && (
          <p className="text-[10px] text-center text-muted-foreground animate-pulse">
            AI analyserar alla datakällor, skapar uppgifter och prioriterar...
          </p>
        )}
        {lastScan?.created_at && !loading && (
          <p className="text-[10px] text-muted-foreground text-center">
            Senaste skanning: {new Date(lastScan.created_at).toLocaleString('sv-SE')}
          </p>
        )}
      </div>

      {/* Scan History Panel */}
      {showHistory && (
        <div className="border rounded-xl p-4 bg-card space-y-3">
          <h4 className="text-xs font-bold flex items-center gap-1.5">
            <Clock className="w-4 h-4" /> Skanningshistorik
          </h4>
          {scanHistory.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-3">Ingen historik ännu</p>
          )}
          <ScrollArea className="max-h-[30vh]">
            <div className="space-y-1.5 pr-2">
              {scanHistory.map((scan: any) => (
                <div
                  key={scan.id}
                  className={cn(
                    "border rounded-lg p-2.5 flex items-center gap-3 cursor-pointer hover:bg-muted/40 transition-colors",
                    compareId === scan.id && "border-primary bg-primary/5"
                  )}
                  onClick={() => loadHistoryScan(scan.id)}
                >
                  <div className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border',
                    (scan.overall_score || 0) >= 70 ? 'border-green-400 text-green-700 bg-green-50' :
                    (scan.overall_score || 0) >= 40 ? 'border-yellow-400 text-yellow-700 bg-yellow-50' :
                    'border-red-400 text-destructive bg-red-50'
                  )}>
                    {scan.overall_score || '—'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium truncate">{scan.executive_summary || 'Systemskanning'}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(scan.created_at).toLocaleString('sv-SE')} · {scan.issues_count} issues · {scan.tasks_created} uppgifter
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 text-[9px] shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      setCompareId(scan.id);
                      loadHistoryScan(scan.id);
                    }}
                  >
                    Jämför
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Score Comparison */}
      {renderScoreComparison()}

      {/* Trend Analysis */}
      <TrendAnalysisPanel />

      {scanResult && (
        <div className="space-y-4">
          {/* Score + Summary */}
          <div className={cn('border rounded-xl p-4 flex items-center gap-4',
            scanResult.system_score >= 70 ? 'border-green-300 bg-green-50/50' :
            scanResult.system_score >= 40 ? 'border-yellow-300 bg-yellow-50/50' :
            'border-red-300 bg-red-50/50'
          )}>
            <div className={cn(
              'w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold border-2',
              scanResult.system_score >= 70 ? 'border-green-500 text-green-700' :
              scanResult.system_score >= 40 ? 'border-yellow-500 text-yellow-700' :
              'border-red-500 text-red-700'
            )}>
              {scanResult.system_score}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-bold">Systemhälsa</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{scanResult.executive_summary}</p>
              <div className="flex gap-2 mt-2 text-[10px]">
                <span>⏱ {Math.round(scanResult.scan_duration_ms / 1000)}s</span>
                <span>🔍 {scanResult.issues_found} issues</span>
                <span>✅ {scanResult.tasks_created} skapade</span>
                <span>📎 {scanResult.tasks_skipped_duplicate} dubbletter</span>
              </div>
            </div>
          </div>

          {/* Risk areas */}
          {scanResult.risk_areas?.length > 0 && (
            <div className="flex gap-1.5 flex-wrap">
              {scanResult.risk_areas.map((r: string, i: number) => (
                <Badge key={i} variant="destructive" className="text-[9px]">{r}</Badge>
              ))}
            </div>
          )}

          {/* Stats grid */}
          {scanResult.task_manager && (
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {[
                { key: 'prioritized', label: 'Prioriterade', icon: BarChart3 },
                { key: 'assigned', label: 'Tilldelade', icon: Send },
                { key: 'detected', label: 'Detekterade', icon: Shield },
                { key: 'orchestrated', label: 'Orkestrerade', icon: Layers },
                { key: 'resolved', label: 'Lösta', icon: CheckCircle },
              ].map(s => (
                <Card key={s.key} className="border-border">
                  <CardContent className="py-2 px-3 flex items-center gap-2">
                    <s.icon className="w-3.5 h-3.5 text-muted-foreground" />
                    <div>
                      <p className="text-lg font-bold leading-none">{scanResult.task_manager[s.key] || 0}</p>
                      <p className="text-[9px] text-muted-foreground">{s.label}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* AI-detected issues */}
          {scanResult.issues?.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <Radar className="w-3.5 h-3.5" /> Detekterade issues ({scanResult.issues.length})
              </h4>
              <ScrollArea className="max-h-[40vh]">
                <div className="space-y-1.5 pr-2">
                  {scanResult.issues.map((issue: any, i: number) => (
                    <div key={i} className="border rounded-lg p-2.5 space-y-1.5 cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => setExpandedIssue(expandedIssue === i ? null : i)}>
                      <div className="flex items-start gap-2">
                        {typeIcon(issue.type)}
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium">{issue.title}</p>
                          <div className="flex gap-1 mt-0.5 flex-wrap">
                            <span className={cn('text-[8px] px-1.5 py-0.5 rounded-full border', urgencyStyle(issue.urgency))}>
                              {urgencyLabel(issue.urgency)}
                            </span>
                            <Badge variant={issue.severity === 'critical' || issue.severity === 'high' ? 'destructive' : 'secondary'} className="text-[8px]">{issue.severity}</Badge>
                            <Badge variant="outline" className="text-[8px]">{issue.category}</Badge>
                          </div>
                        </div>
                        <ArrowRight className={cn('w-3 h-3 text-muted-foreground transition-transform shrink-0', expandedIssue === i && 'rotate-90')} />
                      </div>
                      {expandedIssue === i && (
                        <div className="pt-2 border-t space-y-2 text-xs">
                          <p className="text-muted-foreground">{issue.description}</p>
                          <div>
                            <span className="font-medium text-muted-foreground">🔧 Fix-förslag:</span>
                            <p>{issue.fix_suggestion}</p>
                          </div>
                          {issue.lovable_prompt && (
                            <div>
                              <div className="flex items-center justify-between">
                                <span className="font-medium text-muted-foreground">📋 Lovable-prompt:</span>
                                <Button size="sm" variant="ghost" className="h-5 text-[9px] gap-0.5" onClick={(e) => { e.stopPropagation(); copyToClipboard(issue.lovable_prompt); }}>
                                  <Copy className="w-2.5 h-2.5" /> Kopiera
                                </Button>
                              </div>
                              <div className="bg-muted/50 rounded-md p-2 font-mono text-[10px] whitespace-pre-wrap max-h-32 overflow-y-auto mt-1 border">{issue.lovable_prompt}</div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Master Task List */}
          {scanResult.master_list && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Layers className="w-4 h-4" /> Master Task List ({scanResult.master_list.total})
              </h4>
              {renderTaskGroup('🔴 MÅSTE GÖRAS NU', scanResult.master_list.must_do, 'text-destructive')}
              {renderTaskGroup('🟡 NÄSTA', scanResult.master_list.next_up, 'text-yellow-700')}
              {renderTaskGroup('🟢 VALFRITT', scanResult.master_list.optional, 'text-muted-foreground')}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
// ── AI Action Engine Tab ──
const ActionEngineTab = () => {
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
const DataIntegrityTab = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const runScan = async () => {
    setLoading(true);
    try {
      const data = await callAI('data_integrity');
      if (data) setResult(data);
    } catch { toast.error('Integrity scan misslyckades'); }
    finally { setLoading(false); }
  };

  const sevColor = (s: string) => {
    if (s === 'critical') return 'bg-destructive/15 text-destructive border-destructive/30';
    if (s === 'high') return 'bg-destructive/10 text-destructive border-destructive/20';
    return 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-primary" /> Data Integrity Validator</h3>
          <p className="text-sm text-muted-foreground">Skannar systemet efter datainkonsekvenser, brutna relationer och felaktiga tillstånd.</p>
        </div>
        <Button onClick={runScan} disabled={loading} size="sm">
          {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Radar className="w-4 h-4 mr-1" />}
          Kör skanning
        </Button>
      </div>

      {result && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Card className="border-border">
              <CardContent className="pt-4 pb-4 text-center">
                <p className="text-3xl font-bold" style={{ color: result.score >= 80 ? 'hsl(var(--primary))' : result.score >= 50 ? 'hsl(45,100%,40%)' : 'hsl(var(--destructive))' }}>{result.score}</p>
                <p className="text-xs text-muted-foreground">Health Score</p>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardContent className="pt-4 pb-4 text-center">
                <p className="text-3xl font-bold">{result.issues?.length || 0}</p>
                <p className="text-xs text-muted-foreground">Problem hittade</p>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardContent className="pt-4 pb-4 text-center">
                <p className="text-3xl font-bold text-primary">{result.tasks_created || 0}</p>
                <p className="text-xs text-muted-foreground">Tasks skapade</p>
              </CardContent>
            </Card>
          </div>

          {result.issues?.length > 0 && (
            <Card className="border-border">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Hittade problem</CardTitle></CardHeader>
              <CardContent>
                <ScrollArea className="max-h-[400px]">
                  <div className="space-y-2">
                    {result.issues.map((issue: any, i: number) => (
                      <div key={i} className="flex items-start gap-2 p-2 rounded-lg border border-border bg-card">
                        <Badge variant="outline" className={cn('text-[10px] shrink-0', sevColor(issue.severity))}>{issue.severity}</Badge>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{issue.title}</p>
                          <p className="text-xs text-muted-foreground">{issue.detail}</p>
                          <Badge variant="secondary" className="text-[10px] mt-1">{issue.type}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {result.issues?.length === 0 && (
            <Card className="border-border">
              <CardContent className="py-8 text-center">
                <CheckCircle className="w-10 h-10 text-primary mx-auto mb-2" />
                <p className="font-medium">Allt ser bra ut!</p>
                <p className="text-sm text-muted-foreground">Inga datainkonsekvenser hittade.</p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
};

// ── Content Validation Tab ──
const ContentValidationTab = () => {
  const [loading, setLoading] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [result, setResult] = useState<any>(null);

  const runScan = async (autoFix = false) => {
    if (autoFix) setFixing(true); else setLoading(true);
    try {
      const data = await callAI('content_validation', { auto_fix: autoFix });
      if (data) {
        setResult(data);
        if (autoFix && data.auto_fixed > 0) toast.success(`${data.auto_fixed} problem åtgärdade automatiskt`);
      }
    } catch { toast.error('Content validation misslyckades'); }
    finally { setLoading(false); setFixing(false); }
  };

  const sevColor = (s: string) => {
    if (s === 'critical') return 'bg-destructive/15 text-destructive border-destructive/30';
    if (s === 'high') return 'bg-destructive/10 text-destructive border-destructive/20';
    return 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20';
  };

  const fixableCount = result?.mismatches?.filter((m: any) => m.auto_fixable && !m.fixed)?.length || 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold flex items-center gap-2"><Eye className="w-5 h-5 text-primary" /> Content Validation Engine</h3>
          <p className="text-sm text-muted-foreground">Verifierar att alla påståenden i UI:t matchar verklig systemdata.</p>
        </div>
        <div className="flex gap-2">
          {fixableCount > 0 && (
            <Button onClick={() => runScan(true)} disabled={fixing} size="sm" variant="default">
              {fixing ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Wrench className="w-4 h-4 mr-1" />}
              Auto-fix ({fixableCount})
            </Button>
          )}
          <Button onClick={() => runScan(false)} disabled={loading} size="sm" variant="outline">
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Radar className="w-4 h-4 mr-1" />}
            Validera
          </Button>
        </div>
      </div>

      {result && (
        <>
          <div className="grid grid-cols-4 gap-3">
            <Card className="border-border">
              <CardContent className="pt-4 pb-4 text-center">
                <p className="text-3xl font-bold" style={{ color: result.score >= 80 ? 'hsl(var(--primary))' : result.score >= 50 ? 'hsl(45,100%,40%)' : 'hsl(var(--destructive))' }}>{result.score}</p>
                <p className="text-xs text-muted-foreground">Content Score</p>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardContent className="pt-4 pb-4 text-center">
                <p className="text-3xl font-bold">{result.mismatches?.length || 0}</p>
                <p className="text-xs text-muted-foreground">Mismatches</p>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardContent className="pt-4 pb-4 text-center">
                <p className="text-3xl font-bold text-primary">{result.auto_fixed || 0}</p>
                <p className="text-xs text-muted-foreground">Auto-fixade</p>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardContent className="pt-4 pb-4 text-center">
                <p className="text-3xl font-bold">{result.tasks_created || 0}</p>
                <p className="text-xs text-muted-foreground">Tasks skapade</p>
              </CardContent>
            </Card>
          </div>

          {result.fixes?.length > 0 && (
            <Card className="border-border">
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><CheckCircle className="w-4 h-4 text-primary" /> Automatiskt åtgärdat</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {result.fixes.map((f: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-sm p-2 rounded bg-primary/5 border border-primary/10">
                      <CheckCircle className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span className="font-medium">{f.target}</span>
                      <span className="text-muted-foreground">— {f.result}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {result.mismatches?.length > 0 && (
            <Card className="border-border">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Innehållsavvikelser</CardTitle></CardHeader>
              <CardContent>
                <ScrollArea className="max-h-[400px]">
                  <div className="space-y-2">
                    {result.mismatches.map((m: any, i: number) => (
                      <div key={i} className={cn('p-3 rounded-lg border border-border bg-card space-y-1', m.fixed && 'opacity-50')}>
                        <div className="flex items-start gap-2">
                          <Badge variant="outline" className={cn('text-[10px] shrink-0', sevColor(m.severity))}>{m.severity}</Badge>
                          {m.fixed && <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">Fixad</Badge>}
                          {m.auto_fixable && !m.fixed && <Badge variant="outline" className="text-[10px] bg-accent/10 text-accent-foreground border-accent/20">Auto-fixbar</Badge>}
                          <p className="text-sm font-medium">{m.claim}</p>
                        </div>
                        <p className="text-xs text-muted-foreground"><span className="font-medium">Verklighet:</span> {m.reality}</p>
                        <p className="text-xs text-muted-foreground"><span className="font-medium">Källa:</span> {m.source}</p>
                        <div className="flex items-center gap-1 mt-1">
                          <Lightbulb className="w-3 h-3 text-yellow-500" />
                          <p className="text-xs text-foreground/70">{m.suggestion}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {result.mismatches?.length === 0 && (
            <Card className="border-border">
              <CardContent className="py-8 text-center">
                <CheckCircle className="w-10 h-10 text-primary mx-auto mb-2" />
                <p className="font-medium">Allt stämmer!</p>
                <p className="text-sm text-muted-foreground">Inga innehållsavvikelser hittade.</p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
};


// ── Pattern Detection Tab ──
const PatternDetectionTab = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const { openDetail } = useDetailContext();

  const runScan = async () => {
    setLoading(true);
    try {
      const data = await callAI('pattern_detection');
      if (data) setResult(data);
    } catch { toast.error('Pattern detection misslyckades'); }
    finally { setLoading(false); }
  };

  const prioColor = (p: string) => {
    if (p === 'critical') return 'bg-destructive/15 text-destructive border-destructive/30';
    if (p === 'high') return 'bg-destructive/10 text-destructive border-destructive/20';
    if (p === 'medium') return 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20';
    return 'bg-muted text-muted-foreground border-border';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold flex items-center gap-2"><GitMerge className="w-5 h-5 text-primary" /> Pattern Detection Engine</h3>
          <p className="text-sm text-muted-foreground">AI analyserar likheter, grupperar problem och identifierar rotorsaker.</p>
        </div>
        <Button onClick={runScan} disabled={loading} size="sm">
          {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Radar className="w-4 h-4 mr-1" />}
          Analysera mönster
        </Button>
      </div>

      {result && (
        <>
          <div className="grid grid-cols-4 gap-3">
            <Card className="border-border">
              <CardContent className="pt-4 pb-4 text-center">
                <p className="text-3xl font-bold">{result.total_items_analyzed || 0}</p>
                <p className="text-xs text-muted-foreground">Analyserade</p>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardContent className="pt-4 pb-4 text-center">
                <p className="text-3xl font-bold text-primary">{result.clusters?.length || 0}</p>
                <p className="text-xs text-muted-foreground">Kluster</p>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardContent className="pt-4 pb-4 text-center">
                <p className="text-3xl font-bold">{result.links_created || 0}</p>
                <p className="text-xs text-muted-foreground">Länkar skapade</p>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardContent className="pt-4 pb-4 text-center">
                <p className="text-3xl font-bold">{result.master_tasks_created || 0}</p>
                <p className="text-xs text-muted-foreground">Root tasks</p>
              </CardContent>
            </Card>
          </div>

          {result.clusters?.length > 0 && (
            <div className="space-y-3">
              {result.clusters.map((c: any, i: number) => (
                <Card key={i} className="border-border">
                  <CardContent className="pt-4 pb-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-semibold text-sm">{c.label}</h4>
                        <Badge variant="outline" className={cn('text-[10px]', prioColor(c.priority))}>{c.priority}</Badge>
                        <Badge variant="secondary" className="text-[10px]">{c.category}</Badge>
                        <Badge variant="outline" className="text-[10px]">{c.affected_count} issues</Badge>
                      </div>
                      {c.master_id && (
                        <Button size="sm" variant="ghost" className="text-xs shrink-0" onClick={() => openDetail(c.master_id)}>
                          <ArrowRight className="w-3 h-3 mr-1" /> Visa
                        </Button>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Rotorsak</p>
                        <p className="text-sm">{c.root_cause}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Föreslagen fix</p>
                        <p className="text-sm">{c.fix_suggestion}</p>
                      </div>
                    </div>
                    {c.lovable_prompt && (
                      <div className="relative">
                        <pre className="text-xs bg-muted/50 border border-border rounded-lg p-3 whitespace-pre-wrap max-h-32 overflow-auto">{c.lovable_prompt}</pre>
                        <Button
                          size="sm" variant="ghost"
                          className="absolute top-1 right-1 h-6 w-6 p-0"
                          onClick={() => { navigator.clipboard.writeText(c.lovable_prompt); toast.success('Kopierad'); }}
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {result.clusters?.length === 0 && (
            <Card className="border-border">
              <CardContent className="py-8 text-center">
                <CheckCircle className="w-10 h-10 text-primary mx-auto mb-2" />
                <p className="font-medium">Inga mönster hittade</p>
                <p className="text-sm text-muted-foreground">Alla problem verkar vara unika.</p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
};

const DataHealthTab = () => {
  const [scanning, setScanning] = useState(false);
  const [repairing, setRepairing] = useState(false);
  const [results, setResults] = useState<any>(null);

  const run = async (mode: 'scan' | 'repair') => {
    const isRepair = mode === 'repair';
    if (isRepair) setRepairing(true); else setScanning(true);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { toast.error('Ej inloggad'); setScanning(false); setRepairing(false); return; }

    const resp = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/data-sync`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ mode }),
      }
    );

    if (resp.ok) {
      const data = await resp.json();
      setResults(data.results);
      if (isRepair) toast.success(`${data.results.total_fixed} problem åtgärdade`);
    } else {
      toast.error('Fel vid datasync');
    }

    setScanning(false);
    setRepairing(false);
  };

  const healthScore = results
    ? Math.max(0, 100 - (results.total_issues * 5))
    : null;

  const issueCategories = results ? [
    { key: 'orphan_work_items', label: 'Föräldralösa uppgifter', icon: AlertTriangle, fixed: results.orphan_work_items_fixed },
    { key: 'bugs_without_work_items', label: 'Buggar utan uppgift', icon: Bug, fixed: results.bugs_without_work_items_fixed },
    { key: 'status_mismatches', label: 'Statusmismatch', icon: RefreshCw, fixed: results.status_mismatches_fixed },
    { key: 'deleted_order_tasks', label: 'Raderade order-tasks', icon: XCircle, fixed: results.deleted_order_tasks_fixed },
    { key: 'completed_order_tasks', label: 'Klara order-tasks', icon: CheckCircle, fixed: results.completed_order_tasks_fixed || 0 },
    { key: 'cancelled_order_tasks', label: 'Avbrutna order-tasks', icon: XCircle, fixed: results.cancelled_order_tasks_fixed || 0 },
    { key: 'sourceless_items', label: 'Utan källa', icon: AlertCircle, fixed: results.sourceless_items_fixed || 0 },
    { key: 'duplicate_work_items', label: 'Dubbletter', icon: Copy, fixed: 0 },
    { key: 'stale_claimed', label: 'Inaktiva claims', icon: Clock, fixed: results.stale_claimed_fixed },
  ] : [];

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button onClick={() => run('scan')} disabled={scanning || repairing} className="flex-1 gap-2" variant="outline">
          {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
          Skanna data
        </Button>
        <Button onClick={() => run('repair')} disabled={scanning || repairing} className="flex-1 gap-2">
          {repairing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wrench className="w-4 h-4" />}
          Skanna & reparera
        </Button>
      </div>

      {results && (
        <div className="space-y-4">
          {/* Health score */}
          <div className="border rounded-xl p-4 flex items-center gap-4">
            <div className={cn(
              'w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold border-2',
              (healthScore ?? 0) >= 80 ? 'border-green-500 text-green-700 bg-green-50' :
              (healthScore ?? 0) >= 50 ? 'border-yellow-500 text-yellow-700 bg-yellow-50' :
              'border-red-500 text-red-700 bg-red-50'
            )}>
              {healthScore}
            </div>
            <div>
              <h3 className="text-sm font-semibold">Data Health Score</h3>
              <p className="text-xs text-muted-foreground">
                {results.total_issues === 0 ? 'Inga problem hittade! 🎉' : `${results.total_issues} problem hittade, ${results.total_fixed} åtgärdade`}
              </p>
            </div>
          </div>

          {/* Issue breakdown */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {issueCategories.map(cat => {
              const count = results[cat.key] || 0;
              return (
                <Card key={cat.key} className="border-border">
                  <CardContent className="py-2 px-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <cat.icon className={cn('w-3.5 h-3.5', count > 0 ? 'text-destructive' : 'text-green-600')} />
                      <span className="text-[10px] text-muted-foreground">{cat.label}</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-lg font-bold">{count}</span>
                      {cat.fixed > 0 && <span className="text-[9px] text-green-600">({cat.fixed} fixade)</span>}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Details */}
          {results.details?.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground">Detaljer ({results.details.length})</h4>
              <ScrollArea className="max-h-[40vh]">
                <div className="space-y-1.5 pr-2">
                  {results.details.map((d: any, i: number) => (
                    <div key={i} className={cn(
                      'border rounded-md p-2 flex items-start gap-2 text-xs',
                      d.fixed ? 'border-green-200 bg-green-50/50' : 'border-border'
                    )}>
                      {d.fixed ? <CheckCircle className="w-3.5 h-3.5 text-green-600 shrink-0 mt-0.5" /> : <AlertCircle className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />}
                      <div className="min-w-0">
                        <Badge variant="outline" className="text-[8px] mr-1">{d.type}</Badge>
                        <span>{d.message}</span>
                      </div>
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

// ── Focused Scan (Adaptive Scan Zones) Tab ──
const FocusedScanTab = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const { openDetail } = useDetailContext();

  // Load last scan on mount
  useEffect(() => {
    (supabase.from('ai_scan_results') as any)
      .select('results, created_at, overall_score, overall_status, executive_summary')
      .eq('scan_type', 'focused_scan')
      .order('created_at', { ascending: false })
      .limit(1)
      .then(({ data }: any) => {
        if (data?.[0]) setResult({ ...(data[0].results as any), _stored_at: data[0].created_at, _score: data[0].overall_score });
      });
  }, []);

  const runScan = async () => {
    setLoading(true);
    try {
      const data = await callAI('focused_scan');
      if (data) setResult(data);
    } catch { toast.error('Fokusscan misslyckades'); }
    finally { setLoading(false); }
  };

  const statusColor = (s: string) => {
    if (s === 'critical') return 'bg-destructive/15 text-destructive border-destructive/30';
    if (s === 'warning') return 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20';
    if (s === 'improving') return 'bg-green-500/10 text-green-700 border-green-500/20';
    return 'bg-muted text-muted-foreground border-border';
  };

  const trendIcon = (t: string) => {
    if (t === 'worsening') return <TrendingUp className="w-3.5 h-3.5 text-destructive rotate-0" />;
    if (t === 'improving') return <TrendingUp className="w-3.5 h-3.5 text-green-600 rotate-180" />;
    if (t === 'new') return <AlertCircle className="w-3.5 h-3.5 text-yellow-600" />;
    return <Activity className="w-3.5 h-3.5 text-muted-foreground" />;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold flex items-center gap-2"><Radar className="w-5 h-5 text-primary" /> Adaptive Scan Zones</h3>
          <p className="text-sm text-muted-foreground">AI identifierar hot zones med hög problemkoncentration och djupanalyserar dem.</p>
        </div>
        <Button onClick={runScan} disabled={loading} size="sm">
          {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Radar className="w-4 h-4 mr-1" />}
          Kör fokusscan
        </Button>
      </div>

      {result?._stored_at && !loading && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Clock className="w-3 h-3" /> Senaste scan: {new Date(result._stored_at).toLocaleString('sv-SE')}
        </p>
      )}

      {result && (
        <>
          {/* Summary */}
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline" className={cn('text-xs', statusColor(result.overall_risk || 'medium'))}>
                  Risk: {result.overall_risk || 'medium'}
                </Badge>
                {result.tasks_created > 0 && (
                  <Badge variant="secondary" className="text-xs">{result.tasks_created} uppgifter skapade</Badge>
                )}
              </div>
              <p className="text-sm">{result.summary}</p>
            </CardContent>
          </Card>

          {/* Hot Zones Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {result.hot_zones?.length > 0 && (
              <Card className="border-border md:col-span-2">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">🔥 Hot Zones ({result.hot_zones.length})</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {result.hot_zones.map((hz: any, i: number) => (
                    <div key={i} className="border border-border rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm capitalize">{hz.area}</span>
                          <Badge variant="outline" className={cn('text-[10px]', statusColor(hz.status))}>{hz.status}</Badge>
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            {trendIcon(hz.trend)} {hz.trend}
                          </span>
                        </div>
                        {hz.heat_score > 0 && (
                          <span className="text-xs font-mono text-muted-foreground">heat: {hz.heat_score}</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{hz.diagnosis}</p>
                      {hz.actions?.length > 0 && (
                        <div className="space-y-1">
                          {hz.actions.map((a: string, j: number) => (
                            <div key={j} className="text-xs flex items-start gap-1.5">
                              <ArrowRight className="w-3 h-3 mt-0.5 text-primary shrink-0" />
                              <span>{a}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {hz.related_areas?.length > 0 && (
                        <div className="flex gap-1 flex-wrap">
                          {hz.related_areas.map((ra: string, k: number) => (
                            <Badge key={k} variant="secondary" className="text-[10px]">{ra}</Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Cold Zones + Next Scan Recommendations */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {result.cold_zones?.length > 0 && (
              <Card className="border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-600" /> Stabila zoner</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-1.5">
                    {result.cold_zones.map((z: string, i: number) => (
                      <Badge key={i} variant="outline" className="text-xs bg-green-500/5 text-green-700 border-green-500/20">{z}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {result.recommended_next_scan_areas?.length > 0 && (
              <Card className="border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><Radar className="w-4 h-4 text-primary" /> Nästa fokusområden</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-1.5">
                    {result.recommended_next_scan_areas.map((a: string, i: number) => (
                      <Badge key={i} variant="outline" className="text-xs">{a}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </>
      )}

      {!result && !loading && (
        <Card className="border-dashed border-border">
          <CardContent className="py-12 text-center">
            <Radar className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">Kör en fokusscan för att identifiera problemområden</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};


const NavBugScanTab = () => {
  const [navResult, setNavResult] = useState<any>(null);
  const [bugResult, setBugResult] = useState<any>(null);
  const [loadingNav, setLoadingNav] = useState(false);
  const [loadingBug, setLoadingBug] = useState(false);

  const runNav = async () => {
    setLoadingNav(true);
    const r = await callAI('nav_scan');
    if (r) { setNavResult(r); toast.success(`Nav-scan klar – ${r.issues?.length || 0} problem, ${r.tasks_created || 0} uppgifter`); }
    setLoadingNav(false);
  };

  const runBugRescan = async () => {
    setLoadingBug(true);
    const r = await callAI('bug_rescan');
    if (r) { setBugResult(r); toast.success(`Bugg-rescan klar – ${r.applied?.bugs_updated || 0} uppdaterade`); }
    setLoadingBug(false);
  };

  const routeIcon = (s: string) => {
    if (s === 'ok') return <CheckCircle className="w-3.5 h-3.5 text-green-600" />;
    if (s === 'warning') return <AlertTriangle className="w-3.5 h-3.5 text-yellow-600" />;
    if (s === 'broken') return <XCircle className="w-3.5 h-3.5 text-destructive" />;
    return <AlertCircle className="w-3.5 h-3.5 text-muted-foreground" />;
  };

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      not_started: '🔴', in_progress: '🟡', review: '🔵', done: '🟢',
      ready_for_publish: '🚀', ignored: '⚫', open: '🔴', resolved: '🟢', duplicate: '📎',
    };
    return `${map[s] || '⚪'} ${s}`;
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Nav Scanner */}
        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Compass className="w-5 h-5 text-primary" />
            <div>
              <h3 className="text-sm font-bold">Navigationsscanner</h3>
              <p className="text-[10px] text-muted-foreground">Skannar alla routes, länkar och knappar</p>
            </div>
          </div>
          <Button onClick={runNav} disabled={loadingNav} className="w-full gap-2">
            {loadingNav ? <Loader2 className="w-4 h-4 animate-spin" /> : <Radar className="w-4 h-4" />}
            {loadingNav ? 'Skannar navigation...' : 'Kör navigationsscan'}
          </Button>
        </Card>

        {/* Bug Rescan */}
        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Bug className="w-5 h-5 text-primary" />
            <div>
              <h3 className="text-sm font-bold">Bugg-omvärdering</h3>
              <p className="text-[10px] text-muted-foreground">Omvärderar alla buggar, uppdaterar status</p>
            </div>
          </div>
          <Button onClick={runBugRescan} disabled={loadingBug} className="w-full gap-2">
            {loadingBug ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {loadingBug ? 'Analyserar buggar...' : 'Kör bugg-rescan'}
          </Button>
        </Card>
      </div>

      {/* Nav Results */}
      {navResult && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className={cn(
              'w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold border-2',
              navResult.nav_score >= 80 ? 'border-green-500 text-green-700 bg-green-50' :
              navResult.nav_score >= 50 ? 'border-yellow-500 text-yellow-700 bg-yellow-50' :
              'border-red-500 text-red-700 bg-red-50'
            )}>
              {navResult.nav_score}
            </div>
            <div>
              <h3 className="text-sm font-bold">Navigationspoäng</h3>
              <p className="text-xs text-muted-foreground">{navResult.summary}</p>
              {navResult.tasks_created > 0 && <Badge variant="secondary" className="mt-1 text-[10px]">{navResult.tasks_created} uppgifter skapade</Badge>}
            </div>
          </div>

          {/* Route status */}
          <Card className="p-4">
            <h4 className="text-xs font-semibold mb-2">Route-status</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
              {navResult.route_status?.map((r: any, i: number) => (
                <div key={i} className="flex items-center gap-2 p-1.5 rounded text-xs">
                  {routeIcon(r.status)}
                  <span className="font-mono text-[10px] text-muted-foreground w-32 shrink-0">{r.path}</span>
                  <span className="truncate">{r.notes}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Nav issues */}
          {navResult.issues?.length > 0 && (
            <Card className="p-4">
              <h4 className="text-xs font-semibold mb-2">Navigationsproblem ({navResult.issues.length})</h4>
              <ScrollArea className="max-h-[40vh]">
                <div className="space-y-2 pr-2">
                  {navResult.issues.map((issue: any, i: number) => (
                    <div key={i} className="border rounded-lg p-3 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-medium">{issue.title}</p>
                          <div className="flex gap-1 mt-0.5">
                            <Badge variant={issue.severity === 'critical' || issue.severity === 'high' ? 'destructive' : 'secondary'} className="text-[8px]">{issue.severity}</Badge>
                            <Badge variant="outline" className="text-[8px]">{issue.issue_type}</Badge>
                            <span className="text-[9px] text-muted-foreground">{issue.page}</span>
                          </div>
                        </div>
                        <Button size="sm" variant="ghost" className="h-5 text-[9px] gap-0.5 shrink-0" onClick={() => copyToClipboard(issue.lovable_prompt)}>
                          <Copy className="w-2.5 h-2.5" /> Prompt
                        </Button>
                      </div>
                      <p className="text-[10px] text-muted-foreground">{issue.description}</p>
                      <p className="text-[10px] text-accent">Fix: {issue.fix_suggestion}</p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </Card>
          )}
        </div>
      )}

      {/* Bug Rescan Results */}
      {bugResult && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className={cn(
              'w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold border-2',
              bugResult.health_score >= 80 ? 'border-green-500 text-green-700 bg-green-50' :
              bugResult.health_score >= 50 ? 'border-yellow-500 text-yellow-700 bg-yellow-50' :
              'border-red-500 text-red-700 bg-red-50'
            )}>
              {bugResult.health_score}
            </div>
            <div>
              <h3 className="text-sm font-bold">Bugghälsa</h3>
              <p className="text-xs text-muted-foreground">{bugResult.summary}</p>
              <div className="flex gap-2 mt-1 text-[10px]">
                <span>📊 {bugResult.total_evaluated} utvärderade</span>
                <span>🐛 {bugResult.applied?.bugs_updated || 0} buggar uppdaterade</span>
                <span>📋 {bugResult.applied?.work_items_updated || 0} tasks uppdaterade</span>
                <span>✅ {bugResult.applied?.tasks_created || 0} nya tasks</span>
              </div>
            </div>
          </div>

          {/* Status changes */}
          {bugResult.status_changes?.length > 0 && (
            <Card className="p-4">
              <h4 className="text-xs font-semibold mb-2">Statusändringar ({bugResult.status_changes.length})</h4>
              <ScrollArea className="max-h-[30vh]">
                <div className="space-y-1.5 pr-2">
                  {bugResult.status_changes.map((c: any, i: number) => (
                    <div key={i} className={cn(
                      'border rounded-md p-2 flex items-start gap-2 text-xs',
                      c.confidence >= 80 ? 'border-green-200 bg-green-50/50' : 'border-border'
                    )}>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono text-[9px] text-muted-foreground">{c.bug_id.slice(0, 8)}</span>
                          <span className="text-[9px]">{statusBadge(c.current_status)}</span>
                          <ArrowRight className="w-3 h-3 text-muted-foreground" />
                          <span className="text-[9px] font-medium">{statusBadge(c.recommended_status)}</span>
                          <span className={cn('text-[8px] px-1 rounded', c.confidence >= 80 ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground')}>
                            {c.confidence}%
                          </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{c.reason}</p>
                      </div>
                      {c.confidence >= 80 && <CheckCircle className="w-3.5 h-3.5 text-green-600 shrink-0" />}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </Card>
          )}

          {/* Duplicates */}
          {bugResult.duplicates?.length > 0 && (
            <Card className="p-4">
              <h4 className="text-xs font-semibold mb-2">Dubbletter ({bugResult.duplicates.length})</h4>
              {bugResult.duplicates.map((d: any, i: number) => (
                <div key={i} className="border rounded-md p-2 mb-1.5 text-xs">
                  <div className="flex gap-1 flex-wrap mb-0.5">
                    {d.bug_ids.map((id: string) => <span key={id} className="font-mono text-[9px] bg-muted px-1.5 py-0.5 rounded">{id.slice(0, 8)}</span>)}
                  </div>
                  <p className="text-[10px] text-muted-foreground">{d.reason}</p>
                </div>
              ))}
            </Card>
          )}

          {/* Missing work items */}
          {bugResult.missing_work_items?.length > 0 && (
            <Card className="p-4">
              <h4 className="text-xs font-semibold mb-2">Skapade saknade uppgifter ({bugResult.missing_work_items.length})</h4>
              {bugResult.missing_work_items.map((m: any, i: number) => (
                <div key={i} className="border rounded-md p-2 mb-1.5 flex items-center gap-2 text-xs">
                  <Badge variant={m.priority === 'critical' || m.priority === 'high' ? 'destructive' : 'secondary'} className="text-[8px]">{m.priority}</Badge>
                  <span>{m.title}</span>
                </div>
              ))}
            </Card>
          )}
        </div>
      )}
    </div>
  );
};

// ── Visual QA Tab ──
interface QAIssue { title: string; page: string; severity: string; category: string; breakpoint: string; description: string; fix_suggestion: string; lovable_prompt: string }
interface FlowTest { flow_name: string; status: string; issues: string[] }
interface PageScore { page: string; score: number; status: string; notes: string }
interface VisualQAResult {
  overall_ui_score: number; mobile_score: number; desktop_score: number; usability_score: number; accessibility_score: number;
  executive_summary: string; issues: QAIssue[]; flow_tests: FlowTest[]; page_scores: PageScore[]; tasks_created: number;
}

const VisualQATab = () => {
  const [result, setResult] = useState<VisualQAResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<string>('all');

  const run = async () => {
    setLoading(true);
    const r = await callAI('visual_qa');
    if (r) { setResult(r); toast.success(`QA klar – ${r.issues?.length || 0} problem, ${r.tasks_created || 0} uppgifter skapade`); }
    setLoading(false);
  };

  const sevColor = (s: string) => s === 'critical' ? 'text-destructive' : s === 'high' ? 'text-orange-500' : s === 'medium' ? 'text-yellow-500' : 'text-muted-foreground';
  const scoreColor = (s: number) => s >= 80 ? 'text-accent' : s >= 50 ? 'text-yellow-500' : 'text-destructive';
  const flowIcon = (s: string) => s === 'pass' ? <CheckCircle className="w-4 h-4 text-accent" /> : s === 'warning' ? <AlertTriangle className="w-4 h-4 text-yellow-500" /> : <XCircle className="w-4 h-4 text-destructive" />;
  const breakpointIcon = (bp: string) => bp === 'mobile' ? <Smartphone className="w-3.5 h-3.5" /> : bp === 'tablet' ? <Tablet className="w-3.5 h-3.5" /> : bp === 'desktop' ? <Monitor className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />;

  const filteredIssues = result?.issues?.filter(i => filter === 'all' || i.severity === filter || i.breakpoint === filter || i.category === filter) || [];

  const createTaskFromIssue = async (issue: QAIssue) => {
    try {
      const { error } = await supabase.from('work_items' as any).insert({
        title: `[Visual QA] ${issue.title}`,
        description: `${issue.description}\n\nSida: ${issue.page}\nBreakpoint: ${issue.breakpoint}\nFix: ${issue.fix_suggestion}`,
        type: 'visual_qa_issue',
        priority: issue.severity === 'critical' ? 'urgent' : issue.severity === 'high' ? 'high' : 'medium',
        status: 'todo',
        source: 'ai_visual_qa',
        ai_review_status: 'needs_review',
        ai_review_result: { lovable_prompt: issue.lovable_prompt, category: issue.category, breakpoint: issue.breakpoint },
      } as any);
      if (error) throw error;
      toast.success(`Uppgift skapad: ${issue.title}`);
    } catch (err: any) {
      toast.error('Kunde inte skapa uppgift');
    }
  };

  const impactText = (sev: string) => {
    if (sev === 'critical') return 'Blockerar användare eller skapar förlorad konvertering';
    if (sev === 'high') return 'Påverkar användarupplevelsen negativt';
    if (sev === 'medium') return 'Märkbart men inte kritiskt';
    return 'Mindre förbättringsmöjlighet';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2"><Monitor className="w-5 h-5 text-primary" /> Visual QA & Responsive Testing</h2>
          <p className="text-sm text-muted-foreground">AI analyserar alla sidor, flöden och breakpoints</p>
        </div>
        <Button onClick={run} disabled={loading} className="gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Radar className="w-4 h-4" />}
          {loading ? 'Analyserar...' : 'Kör Visual QA'}
        </Button>
      </div>

      {!result && !loading && (
        <Card className="p-8 flex flex-col items-center justify-center text-center gap-3">
          <Monitor className="w-10 h-10 text-muted-foreground/40" />
          <h3 className="font-semibold text-muted-foreground">Ingen skanning har körts ännu</h3>
          <p className="text-sm text-muted-foreground/70 max-w-md">Klicka på "Kör Visual QA" för att analysera alla sidor, responsivitet, tillgänglighet och användarflöden.</p>
        </Card>
      )}

      {loading && (
        <Card className="p-8 flex flex-col items-center justify-center text-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Analyserar UI, flöden och breakpoints...</p>
        </Card>
      )}

      {result && (
        <>
          {/* Score cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: 'UI Total', score: result.overall_ui_score, icon: <Eye className="w-4 h-4" /> },
              { label: 'Mobil', score: result.mobile_score, icon: <Smartphone className="w-4 h-4" /> },
              { label: 'Desktop', score: result.desktop_score, icon: <Monitor className="w-4 h-4" /> },
              { label: 'Användbarhet', score: result.usability_score, icon: <Zap className="w-4 h-4" /> },
              { label: 'Tillgänglighet', score: result.accessibility_score, icon: <Shield className="w-4 h-4" /> },
            ].map(s => (
              <Card key={s.label} className="p-3">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">{s.icon}{s.label}</div>
                <div className={cn('text-2xl font-bold', scoreColor(s.score))}>{s.score}</div>
                <Progress value={s.score} className="h-1.5 mt-1" />
              </Card>
            ))}
          </div>

          {/* Summary */}
          <Card className="p-4">
            <p className="text-sm">{result.executive_summary}</p>
            {result.tasks_created > 0 && (
              <Badge variant="secondary" className="mt-2">{result.tasks_created} uppgifter skapade i Workbench</Badge>
            )}
          </Card>

          {/* Flow tests */}
          {result.flow_tests?.length > 0 && (
            <Card className="p-4">
              <h3 className="font-semibold text-sm mb-3">Flödestester</h3>
              <div className="space-y-2">
                {result.flow_tests.map((ft: FlowTest, i: number) => (
                  <div key={i} className="flex items-start gap-3 p-2 rounded-lg bg-secondary/30">
                    {flowIcon(ft.status)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{ft.flow_name}</p>
                      {ft.issues.length > 0 && <ul className="text-xs text-muted-foreground mt-1 space-y-0.5">{ft.issues.map((iss, j) => <li key={j}>• {iss}</li>)}</ul>}
                    </div>
                    <Badge variant={ft.status === 'pass' ? 'secondary' : ft.status === 'warning' ? 'outline' : 'destructive'} className="text-[10px] shrink-0">{ft.status}</Badge>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Page scores */}
          {result.page_scores?.length > 0 && (
            <Card className="p-4">
              <h3 className="font-semibold text-sm mb-3">Sidbetyg</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {result.page_scores.map((ps: PageScore, i: number) => (
                  <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-secondary/20">
                    <span className={cn('text-lg font-bold w-10 text-center', scoreColor(ps.score))}>{ps.score}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{ps.page}</p>
                      <p className="text-xs text-muted-foreground truncate">{ps.notes}</p>
                    </div>
                    <Badge variant={ps.status === 'good' ? 'secondary' : ps.status === 'warning' ? 'outline' : 'destructive'} className="text-[10px]">{ps.status}</Badge>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Issues */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm">Problem ({filteredIssues.length})</h3>
              <div className="flex gap-1 flex-wrap">
                {['all', 'critical', 'high', 'mobile', 'responsive', 'broken_flow'].map(f => (
                  <Badge key={f} variant={filter === f ? 'default' : 'outline'} className="text-[10px] cursor-pointer" onClick={() => setFilter(f)}>
                    {f === 'all' ? 'Alla' : f}
                  </Badge>
                ))}
              </div>
            </div>

            {filteredIssues.length === 0 ? (
              <div className="flex flex-col items-center py-8 gap-2 text-center">
                <CheckCircle className="w-8 h-8 text-accent" />
                <p className="font-medium text-sm">Inga problem hittades!</p>
                <p className="text-xs text-muted-foreground">Alla sidor och flöden ser bra ut med vald filtrering.</p>
              </div>
            ) : (
              <ScrollArea className="max-h-[500px]">
                <div className="space-y-3">
                  {filteredIssues.map((issue, i) => (
                    <div key={i} className="p-3 rounded-lg border border-border/50 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {breakpointIcon(issue.breakpoint)}
                          <span className="text-sm font-medium">{issue.title}</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Badge variant="outline" className="text-[10px]">{issue.category}</Badge>
                          <Badge variant={issue.severity === 'critical' ? 'destructive' : 'outline'} className={cn('text-[10px]', sevColor(issue.severity))}>{issue.severity}</Badge>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">{issue.description}</p>
                      <div className="text-xs"><span className="font-medium">Sida:</span> {issue.page} · <span className="font-medium">Breakpoint:</span> {issue.breakpoint}</div>
                      <div className="text-xs text-muted-foreground italic flex items-center gap-1"><AlertTriangle className="w-3 h-3 shrink-0" /> {impactText(issue.severity)}</div>
                      <div className="text-xs text-accent"><span className="font-medium">Fix:</span> {issue.fix_suggestion}</div>
                      <div className="flex items-center gap-2 pt-1">
                        <Button variant="outline" size="sm" className="text-xs gap-1.5 h-7" onClick={() => createTaskFromIssue(issue)}>
                          <Wrench className="w-3 h-3" /> Skapa uppgift
                        </Button>
                        <Button variant="ghost" size="sm" className="text-xs gap-1.5 h-7" onClick={() => { navigator.clipboard.writeText(issue.lovable_prompt); toast.success('Prompt kopierad'); }}>
                          <Copy className="w-3 h-3" /> Kopiera prompt
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </Card>
        </>
      )}
    </div>
  );
};

// ── Structure Analysis Tab ──
const StructureAnalysisTab = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const runAnalysis = async () => {
    setLoading(true);
    const res = await callAI('structure_analysis');
    if (res) setResult(res);
    setLoading(false);
  };

  const typeIcon = (t: string) => {
    switch (t) {
      case 'misplaced': return <ArrowRightLeft className="w-3.5 h-3.5" />;
      case 'duplicated': return <Copy className="w-3.5 h-3.5" />;
      case 'fragmented': return <Layers className="w-3.5 h-3.5" />;
      case 'merge_candidate': return <GitMerge className="w-3.5 h-3.5" />;
      default: return <LayoutGrid className="w-3.5 h-3.5" />;
    }
  };

  const severityVariant = (s: string) => {
    if (s === 'critical' || s === 'high') return 'destructive' as const;
    if (s === 'medium') return 'default' as const;
    return 'secondary' as const;
  };

  return (
    <div className="space-y-4">
      <Button onClick={runAnalysis} disabled={loading} className="w-full gap-2">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LayoutGrid className="w-4 h-4" />}
        Kör strukturanalys
      </Button>

      {result && (
        <div className="space-y-4">
          {/* Score */}
          <Card className="border-border">
            <CardContent className="py-4 flex items-center gap-4">
              <div className={cn(
                'w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold border-2',
                result.overall_score >= 70 ? 'border-green-500 text-green-700' :
                result.overall_score >= 40 ? 'border-yellow-500 text-yellow-700' :
                'border-red-500 text-red-700'
              )}>
                {result.overall_score}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-sm">Strukturhälsa</h3>
                <p className="text-xs text-muted-foreground mt-1">{result.summary}</p>
              </div>
            </CardContent>
          </Card>

          {/* Issues */}
          {result.issues?.length > 0 && (
            <Card className="border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-warning" /> Strukturproblem ({result.issues.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {result.issues.map((issue: any, i: number) => (
                  <div key={i} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-start gap-2">
                      {typeIcon(issue.issue_type)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-xs">{issue.title}</span>
                          <Badge variant={severityVariant(issue.severity)} className="text-[9px]">{issue.severity}</Badge>
                          <Badge variant="outline" className="text-[9px]">{issue.issue_type}</Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-1">{issue.explanation}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-[10px]">
                      <span className="text-muted-foreground">Nuvarande:</span>
                      <code className="bg-muted px-1.5 py-0.5 rounded text-[10px]">{issue.current_location}</code>
                      <ArrowRight className="w-3 h-3 text-muted-foreground" />
                      <span className="text-muted-foreground">Förslag:</span>
                      <code className="bg-primary/10 text-primary px-1.5 py-0.5 rounded text-[10px]">{issue.suggested_location}</code>
                    </div>
                    {issue.affected_routes?.length > 0 && (
                      <div className="flex gap-1 flex-wrap">
                        {issue.affected_routes.map((r: string, j: number) => (
                          <Badge key={j} variant="outline" className="text-[8px]">{r}</Badge>
                        ))}
                      </div>
                    )}
                    <Button size="sm" variant="ghost" className="h-6 text-[10px] gap-1" onClick={() => copyToClipboard(issue.lovable_prompt)}>
                      <Copy className="w-3 h-3" /> Kopiera prompt
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Merge suggestions */}
          {result.merge_suggestions?.length > 0 && (
            <Card className="border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <GitMerge className="w-4 h-4 text-primary" /> Sammanslagningsförslag ({result.merge_suggestions.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {result.merge_suggestions.map((ms: any, i: number) => (
                  <div key={i} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      {ms.modules.map((m: string, j: number) => (
                        <Badge key={j} variant="outline" className="text-[10px]">{m}</Badge>
                      ))}
                      <ArrowRight className="w-3 h-3 text-muted-foreground" />
                      <Badge className="text-[10px]">{ms.merged_name}</Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground">{ms.reason}</p>
                    <Button size="sm" variant="ghost" className="h-6 text-[10px] gap-1" onClick={() => copyToClipboard(ms.lovable_prompt)}>
                      <Copy className="w-3 h-3" /> Kopiera prompt
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Ideal structure */}
          {result.ideal_structure?.length > 0 && (
            <Card className="border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <LayoutGrid className="w-4 h-4 text-primary" /> Ideal struktur
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2">
                  {result.ideal_structure.map((g: any, i: number) => (
                    <div key={i} className="border rounded-lg p-2.5">
                      <h4 className="text-xs font-semibold mb-1.5">{g.group}</h4>
                      <div className="flex flex-wrap gap-1">
                        {g.modules.map((m: string, j: number) => (
                          <Badge key={j} variant="secondary" className="text-[9px]">{m}</Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};

// ── Development Guardian Tab ──
const DevGuardianTab = () => {
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
            <div className="grid grid-cols-3 gap-2">
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
              <CardContent className="space-y-2">
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
              </CardContent>
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
type AiMode = 'manual' | 'assisted' | 'autonomous';

interface ExecutionAction {
  action_type: string;
  target_id: string;
  target_title?: string;
  description: string;
  auto_executable: boolean;
  new_value?: string;
  reason?: string;
}

interface ExecutionResult {
  summary: string;
  total_actions: number;
  auto_executed: number;
  needs_approval: number;
  actions: ExecutionAction[];
  duplicates: { ids: string[]; reason: string; suggested_action: string }[];
  health_summary: string;
  mode: string;
  execution_log: { action: string; target: string; success: boolean; description: string }[];
  executed_count: number;
}

// SCAN_STEPS and ScanStepResult imported from @/stores/scannerStore
// Icon mapping for scan steps (icons can't be stored in zustand)
const SCAN_STEP_ICONS: Record<string, any> = {
  system_scan: Radar,
  data_integrity: ShieldCheck,
  content_validation: Eye,
  sync_scan: ArrowRightLeft,
  interaction_qa: Zap,
  visual_qa: Monitor,
  nav_scan: Compass,
  ux_scan: Eye,
  action_governor: Gavel,
};


const AiAutopilotTab = () => {
  const [mode, setMode] = useState<AiMode>('assisted');
  const { scanning, steps, selectedSteps, toggleStep: storeToggleStep, selectAll, selectNone, runAllScans } = useScannerStore();
  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);
  const [executionLoading, setExecutionLoading] = useState(false);
  const [showResults, setShowResults] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { openDetail } = useDetailContext();

  // Invalidate queries when scanning finishes
  useEffect(() => {
    if (!scanning && steps.length > 0 && steps.every(s => s.status === 'done' || s.status === 'error')) {
      queryClient.invalidateQueries({ queryKey: ['autopilot-scan-runs'] });
      queryClient.invalidateQueries({ queryKey: ['last-scan-result'] });
      queryClient.invalidateQueries({ queryKey: ['scan-history'] });
    }
  }, [scanning, steps]);

  // Load past full-scan runs
  const { data: scanRuns = [] } = useQuery({
    queryKey: ['autopilot-scan-runs'],
    queryFn: async () => {
      const { data } = await supabase
        .from('ai_scan_results' as any)
        .select('id, scan_type, overall_score, overall_status, executive_summary, issues_count, tasks_created, created_at')
        .order('created_at', { ascending: false })
        .limit(50);
      return (data || []) as any[];
    },
  });

  const toggleStep = storeToggleStep;


  const runExecution = async () => {
    setExecutionLoading(true);
    const res = await callAI('ai_execute', { mode });
    if (res) {
      setExecutionResult(res);
      if (res.executed_count > 0) {
        toast.success(`AI utförde ${res.executed_count} åtgärder`);
        queryClient.invalidateQueries({ queryKey: ['work-items'] });
      }
    }
    setExecutionLoading(false);
  };

  const modeConfig = {
    manual: { label: 'Manuell', desc: 'AI föreslår — du utför', color: 'border-blue-500 bg-blue-50 text-blue-800' },
    assisted: { label: 'Assisterad', desc: 'AI utför säkra åtgärder automatiskt', color: 'border-yellow-500 bg-yellow-50 text-yellow-800' },
    autonomous: { label: 'Autonom', desc: 'AI utför allt utom raderingar', color: 'border-red-500 bg-red-50 text-red-800' },
  };

  const completedCount = steps.filter(s => s.status === 'done').length;
  const errorCount = steps.filter(s => s.status === 'error').length;
  const totalIssues = steps.reduce((sum, s) => {
    if (!s.result) return sum;
    return sum + (s.result.issues_found || s.result.issues?.length || s.result.dead_elements?.length || s.result.mismatches?.length || 0);
  }, 0);
  const totalTasks = steps.reduce((sum, s) => sum + (s.result?.tasks_created || 0), 0);
  const avgScore = (() => {
    const scores = steps.filter(s => s.result).map(s => s.result.system_score || s.result.score || s.result.interaction_score || s.result.overall_score).filter(Boolean);
    return scores.length > 0 ? Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length) : null;
  })();

  return (
    <div className="space-y-4">
      {/* Scan Selector */}
      <Card className="border-border">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Radar className="w-4 h-4 text-primary" /> Full AI-skanning
            </CardTitle>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={selectAll}>Alla</Button>
              <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={selectNone}>Ingen</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-3 gap-1.5">
            {SCAN_STEPS.map(step => {
              const active = selectedSteps.has(step.type);
              const Icon = SCAN_STEP_ICONS[step.type] || Radar;
              return (
                <button
                  key={step.type}
                  onClick={() => !scanning && toggleStep(step.type)}
                  className={cn(
                    'border rounded-lg p-2 text-left transition-all text-xs',
                    active ? 'border-primary bg-primary/5' : 'border-border opacity-50',
                    scanning && 'pointer-events-none'
                  )}
                >
                  <div className="flex items-center gap-1.5">
                    <Icon className="w-3 h-3 shrink-0" />
                    <span className="font-medium text-[10px] truncate">{step.label}</span>
                  </div>
                </button>
              );
            })}
          </div>

          <Button onClick={runAllScans} disabled={scanning || selectedSteps.size === 0} className="w-full gap-2" size="lg">
            {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {scanning ? `Skannar... (${completedCount + errorCount}/${steps.length})` : `Kör ${selectedSteps.size} skanningar`}
          </Button>

          {scanning && steps.length > 0 && (() => {
            const pct = Math.round(((completedCount + errorCount) / steps.length) * 100);
            const currentStep = steps.find(s => s.status === 'running');
            return (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground truncate max-w-[60%]">
                    {currentStep ? `Kör: ${currentStep.label}` : 'Väntar...'}
                  </span>
                  <span className="font-bold text-primary">{pct}%</span>
                </div>
                <Progress value={pct} className="h-2.5" />
                <p className="text-[10px] text-muted-foreground text-center">
                  {completedCount + errorCount} av {steps.length} klara — {steps.length - completedCount - errorCount} kvar
                </p>
              </div>
            );
          })()}
        </CardContent>
      </Card>

      {/* Live scan progress */}
      {steps.length > 0 && (
        <Card className="border-border">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Skanningsresultat</CardTitle>
              {avgScore !== null && (
                <div className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2',
                  avgScore >= 70 ? 'border-green-500 text-green-700' : avgScore >= 40 ? 'border-yellow-500 text-yellow-700' : 'border-red-500 text-red-700'
                )}>
                  {avgScore}
                </div>
              )}
            </div>
            {(completedCount > 0 || errorCount > 0) && (
              <div className="flex gap-3 text-[10px] text-muted-foreground mt-1">
                <span>✅ {completedCount} klara</span>
                {errorCount > 0 && <span>❌ {errorCount} fel</span>}
                <span>🔍 {totalIssues} issues</span>
                <span>📋 {totalTasks} uppgifter skapade</span>
              </div>
            )}
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {steps.map((step, i) => {
                const stepConfig = SCAN_STEPS.find(s => s.type === step.type);
                const Icon = SCAN_STEP_ICONS[step.type] || Radar;
                const score = step.result?.system_score || step.result?.score || step.result?.interaction_score || step.result?.overall_score;

                return (
                  <div key={step.type}>
                    <div
                      className={cn(
                        'flex items-center gap-2 p-2 rounded-lg transition-colors',
                        step.status === 'running' && 'bg-primary/5 border border-primary/20',
                        step.status === 'done' && 'bg-muted/30 cursor-pointer hover:bg-muted/50',
                        step.status === 'error' && 'bg-destructive/5',
                      )}
                      onClick={() => step.status === 'done' && setShowResults(showResults === step.type ? null : step.type)}
                    >
                      {step.status === 'pending' && <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/20 shrink-0" />}
                      {step.status === 'running' && <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />}
                      {step.status === 'done' && <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />}
                      {step.status === 'error' && <XCircle className="w-4 h-4 text-destructive shrink-0" />}

                      <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span className={cn('text-xs font-medium flex-1', step.status === 'pending' && 'text-muted-foreground')}>
                        {step.label}
                      </span>

                      {step.duration_ms != null && (
                        <span className="text-[9px] text-muted-foreground">{(step.duration_ms / 1000).toFixed(1)}s</span>
                      )}

                      {score != null && (
                        <span className={cn(
                          'text-[10px] font-bold',
                          score >= 70 ? 'text-green-700' : score >= 40 ? 'text-yellow-700' : 'text-red-700'
                        )}>
                          {score}
                        </span>
                      )}

                      {step.result && (
                        <span className="text-[9px] text-muted-foreground">
                          {step.result.issues_found || step.result.issues?.length || step.result.dead_elements?.length || step.result.mismatches?.length || 0} issues
                        </span>
                      )}

                      {step.status === 'done' && (
                        <ArrowRight className={cn('w-3 h-3 text-muted-foreground transition-transform', showResults === step.type && 'rotate-90')} />
                      )}
                    </div>

                    {/* Expanded result preview */}
                    {showResults === step.type && step.result && (
                      <div className="ml-8 mt-1 mb-2 border rounded-lg p-3 bg-card space-y-2 text-xs">
                        {step.result.executive_summary && (
                          <p className="text-muted-foreground">{step.result.executive_summary}</p>
                        )}
                        {step.result.summary && !step.result.executive_summary && (
                          <p className="text-muted-foreground">{typeof step.result.summary === 'string' ? step.result.summary : ''}</p>
                        )}

                        {/* Issues list */}
                        {(step.result.issues || step.result.dead_elements || step.result.mismatches || step.result.critical_issues)?.slice(0, 5).map((issue: any, j: number) => (
                          <div key={j} className="flex items-start gap-2 p-1.5 rounded bg-muted/30">
                            <AlertTriangle className="w-3 h-3 text-destructive shrink-0 mt-0.5" />
                            <div className="min-w-0">
                              <p className="text-[11px] font-medium">{issue.title || issue.element || issue.field || 'Issue'}</p>
                              <p className="text-[10px] text-muted-foreground line-clamp-1">{issue.description || issue.issue || issue.detail || ''}</p>
                            </div>
                          </div>
                        ))}

                        {step.result.tasks_created > 0 && (
                          <Badge variant="default" className="bg-green-600 text-[9px]">{step.result.tasks_created} uppgifter skapade</Badge>
                        )}

                        {step.result.risk_areas?.length > 0 && (
                          <div className="flex gap-1 flex-wrap">
                            {step.result.risk_areas.map((r: string, j: number) => (
                              <Badge key={j} variant="destructive" className="text-[8px]">{r}</Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI Execution mode */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Settings2 className="w-4 h-4" /> AI Execution
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            {(Object.entries(modeConfig) as [AiMode, typeof modeConfig.manual][]).map(([key, cfg]) => (
              <button
                key={key}
                onClick={() => setMode(key)}
                className={cn(
                  'border-2 rounded-lg p-2.5 text-left transition-all',
                  mode === key ? cfg.color : 'border-border bg-background hover:border-muted-foreground/30'
                )}
              >
                <div className="font-semibold text-[11px]">{cfg.label}</div>
                <div className="text-[9px] mt-0.5 opacity-80">{cfg.desc}</div>
              </button>
            ))}
          </div>
          <Button onClick={runExecution} disabled={executionLoading || scanning} className="w-full gap-2" variant="outline">
            {executionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Kör AI Execution ({modeConfig[mode].label})
          </Button>
        </CardContent>
      </Card>

      {executionResult && (
        <Card className="border-border">
          <CardContent className="pt-4 space-y-3">
            <p className="text-sm font-medium">{executionResult.summary}</p>
            <div className="flex gap-3 text-xs flex-wrap">
              <Badge variant="outline">{executionResult.total_actions} åtgärder</Badge>
              <Badge variant="default" className="bg-green-600">{executionResult.executed_count} utförda</Badge>
              <Badge variant="secondary">{executionResult.needs_approval} kräver godkännande</Badge>
            </div>
            {executionResult.execution_log.length > 0 && (
              <div className="space-y-1">
                {executionResult.execution_log.map((log, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs p-1.5 rounded bg-muted/50">
                    {log.success ? <CheckCircle className="w-3 h-3 text-green-600 shrink-0" /> : <XCircle className="w-3 h-3 text-red-600 shrink-0" />}
                    <span className="font-mono text-[10px] text-muted-foreground">{log.action}</span>
                    <span className="truncate text-[11px]">{log.description}</span>
                  </div>
                ))}
              </div>
            )}
            {executionResult.actions.filter(a => !a.auto_executable).length > 0 && (
              <div className="space-y-1.5 border-t pt-2">
                <p className="text-[10px] font-semibold text-muted-foreground">Kräver godkännande:</p>
                {executionResult.actions.filter(a => !a.auto_executable).map((action, i) => (
                  <div key={i} className="border rounded-lg p-2 space-y-0.5 cursor-pointer hover:bg-muted/30" onClick={() => action.target_id && openDetail(action.target_id)}>
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline" className="text-[9px]">{action.action_type}</Badge>
                      <span className="text-[11px] font-medium truncate">{action.target_title || action.target_id}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">{action.description}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Recent scan history */}
      {scanRuns.length > 0 && (
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="w-4 h-4" /> Skanningshistorik
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-[30vh]">
              <div className="space-y-1 pr-2">
                {scanRuns.slice(0, 30).map((run: any) => (
                  <div key={run.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/30 text-xs">
                    <div className={cn(
                      'w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold border shrink-0',
                      (run.overall_score || 0) >= 70 ? 'border-green-400 text-green-700 bg-green-50' :
                      (run.overall_score || 0) >= 40 ? 'border-yellow-400 text-yellow-700 bg-yellow-50' :
                      run.overall_score ? 'border-red-400 text-red-700 bg-red-50' : 'border-border text-muted-foreground bg-muted'
                    )}>
                      {run.overall_score || '—'}
                    </div>
                    <Badge variant="outline" className="text-[8px] shrink-0">{run.scan_type.replace(/_/g, ' ')}</Badge>
                    <span className="truncate text-muted-foreground flex-1">{run.executive_summary || '—'}</span>
                    <span className="text-[9px] text-muted-foreground shrink-0">{new Date(run.created_at).toLocaleDateString('sv-SE')}</span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

// ── Interaction QA Tab ──
const InteractionQATab = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

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
                <ScrollArea className="max-h-[40vh]">
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
                <ScrollArea className="max-h-[40vh]">
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

          {/* Route issues */}
          {result.route_issues?.length > 0 && (
            <Card className="border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Compass className="w-4 h-4" /> Route-status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {result.route_issues.map((ri: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-xs p-2 rounded bg-muted/50">
                      {ri.status === 'ok' ? <CheckCircle className="w-3.5 h-3.5 text-green-600 shrink-0" /> :
                       ri.status === 'warning' ? <AlertTriangle className="w-3.5 h-3.5 text-yellow-600 shrink-0" /> :
                       <XCircle className="w-3.5 h-3.5 text-destructive shrink-0" />}
                      <span className="font-mono text-[10px]">{ri.route}</span>
                      {ri.issue !== 'OK' && <span className="text-muted-foreground truncate">{ri.issue}</span>}
                    </div>
                  ))}
                </div>
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
                <div className="space-y-1.5">
                  {result.bug_reevaluation.map((br: any, i: number) => (
                    <div key={i} className="flex items-start gap-2 text-xs p-2 rounded bg-muted/50">
                      <Badge variant={br.recommended_status === 'likely_fixed' ? 'secondary' : br.recommended_status === 'still_open' ? 'destructive' : 'outline'} className="text-[10px] shrink-0">
                        {br.recommended_status}
                      </Badge>
                      <span className="text-muted-foreground">{br.reason}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};

// ── Verification Engine Tab ──
const VerificationEngineTab = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const run = async () => {
    setLoading(true);
    const r = await callAI('verification_engine');
    if (r) {
      setResult(r);
      toast.success(`Verifiering klar – ${r.false_done_items?.length || 0} falska done, ${r.auto_closed_items?.length || 0} auto-stängda, ${r.tasks_created || 0} nya`);
    }
    setLoading(false);
  };

  const scoreColor = (s: number) => s >= 70 ? 'text-green-700' : s >= 40 ? 'text-yellow-700' : 'text-red-700';

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">AI Verification Engine</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Verifierar avslutade uppgifter, hittar falska "done", auto-stänger lösta, föreslår förbättringar.
        </p>
        <Button onClick={run} disabled={loading} className="gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Kör verifiering
        </Button>
      </Card>

      {result && (
        <div className="space-y-4">
          {/* Score */}
          <Card className="p-4">
            <div className="flex items-center gap-4">
              <div className={cn('text-3xl font-bold', scoreColor(result.verification_score || 0))}>
                {result.verification_score || 0}
              </div>
              <div>
                <p className="font-medium">Verification Score</p>
                <p className="text-xs text-muted-foreground">{result.summary}</p>
              </div>
            </div>
          </Card>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3">
            <Card className="p-3 text-center">
              <p className="text-2xl font-bold text-destructive">{result.false_done_items?.length || 0}</p>
              <p className="text-xs text-muted-foreground">Falska "done" återöppnade</p>
            </Card>
            <Card className="p-3 text-center">
              <p className="text-2xl font-bold text-primary">{result.auto_closed_items?.length || 0}</p>
              <p className="text-xs text-muted-foreground">Auto-stängda</p>
            </Card>
            <Card className="p-3 text-center">
              <p className="text-2xl font-bold">{result.tasks_created || 0}</p>
              <p className="text-xs text-muted-foreground">Nya förbättringar</p>
            </Card>
          </div>

          {/* False done items */}
          {result.false_done_items?.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><XCircle className="w-4 h-4 text-destructive" /> Falska "done" (återöppnade)</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {result.false_done_items.map((item: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-sm border-b border-border pb-2">
                    <Badge variant="destructive" className="text-[9px]">Återöppnad</Badge>
                    <span className="font-medium">{item.title}</span>
                    <span className="text-muted-foreground text-xs">— {item.reason}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Auto-closed items */}
          {result.auto_closed_items?.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><CheckCircle className="w-4 h-4 text-primary" /> Auto-stängda</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {result.auto_closed_items.map((item: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-sm border-b border-border pb-2">
                    <Badge variant="secondary" className="text-[9px]">Stängd</Badge>
                    <span>{item.title}</span>
                    <span className="text-muted-foreground text-xs">— {item.reason}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Post-fix suggestions */}
          {result.post_fix_suggestions?.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Lightbulb className="w-4 h-4 text-yellow-500" /> Post-fix förbättringar</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {result.post_fix_suggestions.map((s: any, i: number) => (
                  <div key={i} className="border border-border rounded-lg p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge variant={s.priority === 'high' ? 'destructive' : 'secondary'} className="text-[9px]">{s.priority}</Badge>
                      <Badge variant="outline" className="text-[9px]">{s.type}</Badge>
                      <span className="text-sm font-medium">{s.suggestion}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Relaterad: {s.related_task}</p>
                    {s.lovable_prompt && (
                      <div className="bg-muted/50 rounded p-2 text-xs">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium">Lovable Prompt</span>
                          <Button size="sm" variant="ghost" className="h-5 px-1.5 text-[9px]" onClick={() => copyToClipboard(s.lovable_prompt)}>
                            <Copy className="w-3 h-3" />
                          </Button>
                        </div>
                        <p className="whitespace-pre-wrap">{s.lovable_prompt}</p>
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Recategorizations */}
          {result.recategorizations?.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><ArrowRightLeft className="w-4 h-4" /> Omkategoriseringar</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {result.recategorizations.map((r: any, i: number) => (
                  <div key={i} className="text-sm border-b border-border pb-2">
                    <span className="font-medium">{r.task_title}</span>
                    <div className="flex items-center gap-1 mt-1">
                      <Badge variant="outline" className="text-[9px]">{r.current_type}</Badge>
                      <ArrowRight className="w-3 h-3" />
                      <Badge variant="default" className="text-[9px]">{r.suggested_type}</Badge>
                      <span className="text-xs text-muted-foreground ml-1">{r.reason}</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Merge suggestions */}
          {result.merge_suggestions?.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><GitMerge className="w-4 h-4" /> Merge-förslag</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {result.merge_suggestions.map((m: any, i: number) => (
                  <div key={i} className="text-sm border-b border-border pb-2 space-y-1">
                    {m.tasks.map((t: string, j: number) => <p key={j} className="text-xs">• {t}</p>)}
                    <p className="text-xs text-muted-foreground">{m.reason}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};

// ── Data Cleanup Tab ──
const DataCleanupTab = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const run = async () => {
    setLoading(true);
    const r = await callAI('data_cleanup');
    if (r) {
      setResult(r);
      toast.success(`Cleanup klar – ${r.total_cleaned || 0} objekt rensade`);
    }
    setLoading(false);
  };

  const scoreColor = (s: number) => s >= 70 ? 'text-green-700' : s >= 40 ? 'text-yellow-700' : 'text-red-700';

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">AI Data Cleanup & Deduplication</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Hittar duplicat, testdata, föräldralösa uppgifter och föråldrade tasks — rensar automatiskt.
        </p>
        <Button onClick={run} disabled={loading} className="gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wrench className="w-4 h-4" />}
          Kör Cleanup
        </Button>
      </Card>

      {result && (
        <div className="space-y-4">
          {/* Score */}
          <Card className="p-4">
            <div className="flex items-center gap-4">
              <div className={cn('text-3xl font-bold', scoreColor(result.cleanliness_score || 0))}>
                {result.cleanliness_score || 0}
              </div>
              <div>
                <p className="font-medium">Renhetsscore</p>
                <p className="text-xs text-muted-foreground">{result.summary}</p>
              </div>
            </div>
          </Card>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-3">
            <Card className="p-3 text-center">
              <p className="text-2xl font-bold text-destructive">{result.orphans_cleaned || 0}</p>
              <p className="text-[10px] text-muted-foreground">Föräldralösa</p>
            </Card>
            <Card className="p-3 text-center">
              <p className="text-2xl font-bold text-primary">{result.duplicates_merged || 0}</p>
              <p className="text-[10px] text-muted-foreground">Duplicat</p>
            </Card>
            <Card className="p-3 text-center">
              <p className="text-2xl font-bold">{result.test_data_removed || 0}</p>
              <p className="text-[10px] text-muted-foreground">Testdata</p>
            </Card>
            <Card className="p-3 text-center">
              <p className="text-2xl font-bold">{result.outdated_removed || 0}</p>
              <p className="text-[10px] text-muted-foreground">Föråldrade</p>
            </Card>
          </div>

          {/* Duplicate groups */}
          {result.duplicate_groups?.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><GitMerge className="w-4 h-4" /> Hittade duplicat</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {result.duplicate_groups.map((g: any, i: number) => (
                  <div key={i} className="text-sm border-b border-border pb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-[9px]">{g.item_indices.length} st</Badge>
                      <span className="text-muted-foreground">{g.reason}</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Test data */}
          {result.test_data?.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><AlertCircle className="w-4 h-4 text-destructive" /> Testdata borttagen</CardTitle></CardHeader>
              <CardContent className="space-y-1">
                {result.test_data.map((t: any, i: number) => (
                  <p key={i} className="text-sm text-muted-foreground">• {t.reason}</p>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Outdated */}
          {result.outdated?.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Clock className="w-4 h-4" /> Föråldrade borttagna</CardTitle></CardHeader>
              <CardContent className="space-y-1">
                {result.outdated.map((o: any, i: number) => (
                  <p key={i} className="text-sm text-muted-foreground">• {o.reason}</p>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};

// ── Auto-Fix Engine Tab ──
const AutoFixTab = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const { openDetail } = useDetailContext();

  const run = async () => {
    setLoading(true);
    const r = await callAI('auto_fix');
    if (r) {
      setResult(r);
      toast.success(`Auto-fix klar – ${r.total_fixed || 0} åtgärdade, ${r.total_flagged || 0} flaggade`);
    }
    setLoading(false);
  };

  const confColor = (c: number) => c >= 80 ? 'text-green-700' : c >= 50 ? 'text-yellow-700' : 'text-red-700';
  const confBg = (c: number) => c >= 80 ? 'bg-green-100' : c >= 50 ? 'bg-yellow-100' : 'bg-red-100';

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Wrench className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">AI Direktfixar</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          AI åtgärdar säkra problem direkt i databasen utan extern byggprocess: 
          dubbletter, föräldralösa kopplingar, felaktig status, tomma kategorier, inaktiva buggar.
          Kräver ≥80% confidence för auto-fix, annars skapas uppgift.
        </p>
        <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground">
          {['Statussynk', 'Dubblettmerge', 'Felaktiga kopplingar', 'Tomma kategorier', 'Gamla buggar', 'Datasynk'].map(t => (
            <span key={t} className="border rounded-full px-2 py-0.5">{t}</span>
          ))}
        </div>
        <Button onClick={run} disabled={loading} className="gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
          Kör Direktfixar
        </Button>
      </Card>

      {result && (
        <div className="space-y-4">
          {/* Summary stats */}
          <div className="grid grid-cols-3 sm:grid-cols-7 gap-2">
            {[
              { key: 'total_fixed', label: 'Åtgärdade', color: 'text-green-700' },
              { key: 'total_flagged', label: 'Flaggade', color: 'text-yellow-700' },
              { key: 'status_fixed', label: 'Statussynk', color: 'text-foreground' },
              { key: 'duplicates_merged', label: 'Dubbletter', color: 'text-primary' },
              { key: 'orphan_links_fixed', label: 'Kopplingar', color: 'text-foreground' },
              { key: 'categories_hidden', label: 'Kategorier', color: 'text-foreground' },
              { key: 'stale_bugs_closed', label: 'Gamla buggar', color: 'text-foreground' },
            ].map(s => (
              <Card key={s.key} className="p-2 text-center">
                <p className={cn('text-xl font-bold', s.color)}>{result[s.key] || 0}</p>
                <p className="text-[9px] text-muted-foreground">{s.label}</p>
              </Card>
            ))}
          </div>

          {/* Data sync info */}
          {result.data_sync && (
            <Card className="p-3">
              <div className="flex items-center gap-2 text-sm">
                <Database className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">Data Sync:</span>
                <span>{result.data_sync.issues} problem hittade, {result.data_sync.fixed} åtgärdade</span>
              </div>
            </Card>
          )}

          {/* Fix log */}
          {result.fixes?.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Activity className="w-4 h-4" /> Åtgärdslogg ({result.fixes.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="max-h-[400px]">
                  <div className="space-y-2">
                    {result.fixes.map((fix: any, i: number) => (
                      <div
                        key={i}
                        className={cn(
                          'flex items-start gap-2 p-2 rounded text-sm border',
                          fix.fixed ? 'border-green-200 bg-green-50/50' : 'border-yellow-200 bg-yellow-50/50',
                          fix.target_id && 'cursor-pointer hover:bg-muted/40'
                        )}
                        onClick={() => fix.target_id && openDetail(fix.target_id)}
                      >
                        {fix.fixed ? <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5 shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs truncate">{fix.action}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-[9px]">{fix.type}</Badge>
                            <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded', confBg(fix.confidence), confColor(fix.confidence))}>
                              {fix.confidence}% confidence
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {/* Fallback tasks */}
          {result.fallback_tasks?.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-yellow-600" /> Kräver manuell granskning ({result.fallback_tasks.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {result.fallback_tasks.map((t: string, i: number) => (
                  <p key={i} className="text-sm text-muted-foreground">• {t}</p>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};

// ── UI Overflow Detection Tab ──
interface OverflowIssue {
  title: string; page: string; container: string; severity: string; breakpoint: string;
  overflow_type: string; description: string; css_fix: string; auto_fixable: boolean; lovable_prompt: string;
}
interface SafeContainer { page: string; container: string; reason: string }
interface OverflowResult {
  overflow_score: number; total_containers_checked: number; issues_found: number;
  executive_summary: string; issues: OverflowIssue[]; safe_containers: SafeContainer[]; tasks_created: number;
}

const OverflowScanTab = () => {
  const [result, setResult] = useState<OverflowResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<string>('all');

  const run = async () => {
    setLoading(true);
    const r = await callAI('ui_overflow_scan');
    if (r) { setResult(r); toast.success(`Overflow-skanning klar – ${r.issues_found || 0} problem`); }
    setLoading(false);
  };

  const sevColor = (s: string) => s === 'critical' ? 'text-destructive' : s === 'high' ? 'text-orange-500' : s === 'medium' ? 'text-yellow-500' : 'text-muted-foreground';
  const scoreColor = (s: number) => s >= 80 ? 'text-accent' : s >= 50 ? 'text-yellow-500' : 'text-destructive';
  const bpIcon = (bp: string) => bp === 'mobile' ? <Smartphone className="w-3.5 h-3.5" /> : bp === 'tablet' ? <Tablet className="w-3.5 h-3.5" /> : bp === 'desktop' ? <Monitor className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />;

  const overflowTypeLabel: Record<string, string> = {
    vertical_clip: 'Vertikal klippning', horizontal_clip: 'Horisontell klippning', no_scroll: 'Ingen scroll',
    flex_overflow: 'Flex overflow', modal_overflow: 'Modal overflow', table_overflow: 'Tabell overflow',
    text_overflow: 'Text overflow', dropdown_clip: 'Dropdown klippt',
  };

  const filteredIssues = result?.issues?.filter(i => filter === 'all' || i.severity === filter || i.overflow_type === filter) || [];

  const createTaskFromIssue = async (issue: OverflowIssue) => {
    try {
      const { error } = await supabase.from('work_items' as any).insert({
        title: `[Overflow] ${issue.title}`.substring(0, 200),
        description: `${issue.description}\n\nSida: ${issue.page}\nContainer: ${issue.container}\nBreakpoint: ${issue.breakpoint}\nTyp: ${issue.overflow_type}\n\nCSS Fix: ${issue.css_fix}`,
        status: 'open',
        priority: issue.severity === 'critical' ? 'critical' : issue.severity === 'high' ? 'high' : 'medium',
        item_type: 'bug',
        source_type: 'ai_detection',
        ai_detected: true,
        ai_confidence: 'high',
        ai_category: 'frontend',
        ai_type_classification: 'ui_overflow',
      } as any);
      if (error) throw error;
      toast.success(`Uppgift skapad: ${issue.title}`);
    } catch { toast.error('Kunde inte skapa uppgift'); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2"><Maximize2 className="w-5 h-5 text-primary" /> UI Overflow Detection</h2>
          <p className="text-sm text-muted-foreground">AI skannar alla containers för overflow utan scroll</p>
        </div>
        <Button onClick={run} disabled={loading} className="gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Radar className="w-4 h-4" />}
          {loading ? 'Skannar...' : 'Kör Overflow-skanning'}
        </Button>
      </div>

      {!result && !loading && (
        <Card className="p-8 flex flex-col items-center justify-center text-center gap-3">
          <Maximize2 className="w-10 h-10 text-muted-foreground/40" />
          <h3 className="font-semibold text-muted-foreground">Ingen skanning har körts ännu</h3>
          <p className="text-sm text-muted-foreground/70 max-w-md">Klicka på "Kör Overflow-skanning" för att hitta containers där innehåll flödar över utan scroll.</p>
        </Card>
      )}

      {loading && (
        <Card className="p-8 flex flex-col items-center justify-center text-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Analyserar alla containers och breakpoints...</p>
        </Card>
      )}

      {result && (
        <>
          {/* Score + stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="p-3">
              <div className="text-xs text-muted-foreground mb-1">Overflow Score</div>
              <div className={cn('text-2xl font-bold', scoreColor(result.overflow_score))}>{result.overflow_score}</div>
              <Progress value={result.overflow_score} className="h-1.5 mt-1" />
            </Card>
            <Card className="p-3">
              <div className="text-xs text-muted-foreground mb-1">Containers kontrollerade</div>
              <div className="text-2xl font-bold">{result.total_containers_checked}</div>
            </Card>
            <Card className="p-3">
              <div className="text-xs text-muted-foreground mb-1">Problem hittade</div>
              <div className={cn('text-2xl font-bold', result.issues_found > 0 ? 'text-destructive' : 'text-accent')}>{result.issues_found}</div>
            </Card>
            <Card className="p-3">
              <div className="text-xs text-muted-foreground mb-1">Uppgifter skapade</div>
              <div className="text-2xl font-bold text-primary">{result.tasks_created}</div>
            </Card>
          </div>

          {/* Summary */}
          <Card className="p-4">
            <p className="text-sm">{result.executive_summary}</p>
          </Card>

          {/* Filter */}
          {result.issues?.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {['all', 'critical', 'high', 'medium', 'low'].map(f => (
                <Button key={f} size="sm" variant={filter === f ? 'default' : 'outline'} className="h-7 text-xs" onClick={() => setFilter(f)}>
                  {f === 'all' ? `Alla (${result.issues.length})` : f.charAt(0).toUpperCase() + f.slice(1)}
                </Button>
              ))}
            </div>
          )}

          {/* Issues */}
          <ScrollArea className="max-h-[50vh]">
            <div className="space-y-3">
              {filteredIssues.map((issue, i) => (
                <Card key={i} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={cn('font-semibold text-sm', sevColor(issue.severity))}>{issue.title}</span>
                        <Badge variant="outline" className="text-[10px]">{issue.severity}</Badge>
                        <Badge variant="secondary" className="text-[10px] gap-1">{bpIcon(issue.breakpoint)} {issue.breakpoint}</Badge>
                        <Badge variant="secondary" className="text-[10px]">{overflowTypeLabel[issue.overflow_type] || issue.overflow_type}</Badge>
                        {issue.auto_fixable && <Badge className="text-[10px] bg-accent/20 text-accent border-accent/30">Auto-fixbar</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground mb-1">{issue.page} → {issue.container}</p>
                      <p className="text-sm mb-2">{issue.description}</p>
                      <div className="bg-secondary/50 rounded-md p-2 mb-2">
                        <p className="text-xs font-mono text-muted-foreground">{issue.css_fix}</p>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5 shrink-0">
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => createTaskFromIssue(issue)}>
                        <Wrench className="w-3 h-3" /> Skapa uppgift
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => { navigator.clipboard.writeText(issue.lovable_prompt); toast.success('Prompt kopierad'); }}>
                        <Copy className="w-3 h-3" /> Prompt
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
              {filteredIssues.length === 0 && result.issues?.length > 0 && (
                <p className="text-center text-sm text-muted-foreground py-4">Inga problem matchar filtret</p>
              )}
            </div>
          </ScrollArea>

          {/* Safe containers */}
          {result.safe_containers?.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><CheckCircle className="w-4 h-4 text-accent" /> Säkra containers ({result.safe_containers.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="max-h-[200px]">
                  <div className="space-y-1">
                    {result.safe_containers.map((sc, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                        <CheckCircle className="w-3 h-3 text-accent shrink-0" />
                        <span className="font-medium">{sc.page}</span>
                        <span>→</span>
                        <span>{sc.container}</span>
                        <span className="text-muted-foreground/60">({sc.reason})</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
};
// ── UX Scanner Tab ──
const categoryLabels: Record<string, string> = {
  navigation: 'Navigering', clickability: 'Klickbarhet', scroll: 'Scroll',
  mobile: 'Mobil', forms: 'Formulär', loading: 'Laddning',
  conversion: 'Konvertering', accessibility: 'Tillgänglighet',
};
const catIcon = (c: string) => {
  const icons: Record<string, any> = { navigation: Compass, clickability: Zap, scroll: Maximize2, mobile: Smartphone, forms: Settings2, loading: Loader2, conversion: TrendingUp, accessibility: Eye };
  const Icon = icons[c] || AlertCircle;
  return <Icon className="w-3.5 h-3.5" />;
};

const UxScannerTab = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [filter, setFilter] = useState('all');
  const { openDetail } = useDetailContext();

  const { data: lastScan } = useQuery({
    queryKey: ['ux-scan-last'],
    queryFn: async () => {
      const { data } = await supabase.from('ai_scan_results' as any).select('*').eq('scan_type', 'ux_scan').order('created_at', { ascending: false }).limit(1) as any;
      return data?.[0] || null;
    },
  });

  useEffect(() => {
    if (lastScan && !result) setResult((lastScan as any).results);
  }, [lastScan]);

  const runScan = async () => {
    setLoading(true);
    try {
      const res = await callAI('ux_scan');
      if (res) { setResult(res); toast.success(`UX-skanning klar — ${res.issues_found || 0} problem`); }
    } finally { setLoading(false); }
  };

  const createTask = async (issue: any) => {
    const res = await callAI('create_action', { title: `UX: ${issue.title}`, description: `${issue.description}\n\nPåverkan: ${issue.user_impact}\nFix: ${issue.fix_suggestion}`, priority: issue.severity, category: issue.category, source_type: 'ux_scan' });
    if (res?.work_item_id) { toast.success('Uppgift skapad'); openDetail(res.work_item_id); }
  };

  const sevColor = (s: string) => s === 'critical' ? 'text-destructive' : s === 'high' ? 'text-orange-500' : s === 'medium' ? 'text-yellow-500' : 'text-muted-foreground';
  const scoreColor = (s: number) => s >= 80 ? 'text-accent' : s >= 50 ? 'text-yellow-500' : 'text-destructive';

  const filteredIssues = result?.issues?.filter((i: any) => filter === 'all' || i.severity === filter || i.category === filter) || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2"><Eye className="w-5 h-5" /> UX Scanner</h2>
          <p className="text-xs text-muted-foreground">AI-driven analys av användarupplevelsen</p>
        </div>
        <Button onClick={runScan} disabled={loading} size="sm" className="gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          {loading ? 'Skannar...' : 'Kör UX-skanning'}
        </Button>
      </div>

      {lastScan && !result && (
        <p className="text-xs text-muted-foreground">Senaste skanning: {new Date((lastScan as any).created_at).toLocaleString('sv-SE')}</p>
      )}

      {result && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="p-3">
              <div className="text-xs text-muted-foreground mb-1">UX Score</div>
              <div className={cn('text-2xl font-bold', scoreColor(result.ux_score))}>{result.ux_score}/100</div>
              <Progress value={result.ux_score} className="h-1.5 mt-1" />
            </Card>
            <Card className="p-3">
              <div className="text-xs text-muted-foreground mb-1">Problem</div>
              <div className={cn('text-2xl font-bold', result.issues_found > 0 ? 'text-destructive' : 'text-accent')}>{result.issues_found}</div>
            </Card>
            <Card className="p-3">
              <div className="text-xs text-muted-foreground mb-1">Uppgifter skapade</div>
              <div className="text-2xl font-bold text-primary">{result.tasks_created || 0}</div>
            </Card>
            <Card className="p-3">
              <div className="text-xs text-muted-foreground mb-1">Positiva fynd</div>
              <div className="text-2xl font-bold text-accent">{result.positive_findings?.length || 0}</div>
            </Card>
          </div>

          <Card className="p-4"><p className="text-sm">{result.executive_summary}</p></Card>

          {/* Filters */}
          {result.issues?.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {['all', 'critical', 'high', 'medium', 'low'].map(f => (
                <Button key={f} size="sm" variant={filter === f ? 'default' : 'outline'} className="h-7 text-xs" onClick={() => setFilter(f)}>
                  {f === 'all' ? `Alla (${result.issues.length})` : f.charAt(0).toUpperCase() + f.slice(1)}
                </Button>
              ))}
              <Separator orientation="vertical" className="h-7 mx-1" />
              {Object.keys(categoryLabels).map(c => {
                const count = result.issues.filter((i: any) => i.category === c).length;
                if (count === 0) return null;
                return (
                  <Button key={c} size="sm" variant={filter === c ? 'default' : 'outline'} className="h-7 text-xs gap-1" onClick={() => setFilter(filter === c ? 'all' : c)}>
                    {catIcon(c)} {categoryLabels[c]} ({count})
                  </Button>
                );
              })}
            </div>
          )}

          {/* Issues */}
          <ScrollArea className="max-h-[50vh]">
            <div className="space-y-3">
              {filteredIssues.map((issue: any, i: number) => (
                <Card key={i} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        {catIcon(issue.category)}
                        <span className={cn('font-semibold text-sm', sevColor(issue.severity))}>{issue.title}</span>
                        <Badge variant="outline" className="text-[10px]">{issue.severity}</Badge>
                        <Badge variant="secondary" className="text-[10px]">{categoryLabels[issue.category] || issue.category}</Badge>
                        {issue.can_auto_fix && <Badge className="text-[10px] bg-accent/20 text-accent border-accent/30">Auto-fixbar</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground mb-1">Sida: {issue.page}</p>
                      <p className="text-sm mb-2">{issue.description}</p>
                      <div className="text-xs space-y-1">
                        <p><strong>Påverkan:</strong> {issue.user_impact}</p>
                        <p><strong>Föreslagen fix:</strong> {issue.fix_suggestion}</p>
                      </div>
                    </div>
                    <Button size="sm" variant="outline" className="shrink-0 h-8 text-xs gap-1" onClick={() => createTask(issue)}>
                      <Wrench className="w-3 h-3" /> Skapa uppgift
                    </Button>
                  </div>
                </Card>
              ))}
              {filteredIssues.length === 0 && result.issues?.length === 0 && (
                <Card className="p-6 text-center"><CheckCircle className="w-8 h-8 text-accent mx-auto mb-2" /><p className="text-sm font-medium">Inga UX-problem hittade!</p></Card>
              )}
            </div>
          </ScrollArea>

          {/* Positive findings */}
          {result.positive_findings?.length > 0 && (
            <Card className="p-4">
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5"><CheckCircle className="w-4 h-4 text-accent" /> Bra UX-mönster</h3>
              <ul className="space-y-1">
                {result.positive_findings.map((f: string, i: number) => (
                  <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                    <CheckCircle className="w-3 h-3 text-accent shrink-0 mt-0.5" /> {f}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}
    </div>
  );
};

// ── Sync Scanner Tab ──
const syncTypeLabels: Record<string, string> = {
  category_mismatch: 'Kategorimismatch', product_mismatch: 'Produktmismatch',
  orphan_data: 'Föräldralös data', stale_reference: 'Gammal referens',
  missing_data: 'Saknad data', status_desync: 'Statusdesync',
};

const SyncScannerTab = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [filter, setFilter] = useState('all');
  const { openDetail } = useDetailContext();

  const { data: lastScan } = useQuery({
    queryKey: ['sync-scan-last'],
    queryFn: async () => {
      const { data } = await supabase.from('ai_scan_results' as any).select('*').eq('scan_type', 'sync_scan').order('created_at', { ascending: false }).limit(1) as any;
      return data?.[0] || null;
    },
  });

  useEffect(() => {
    if (lastScan && !result) setResult((lastScan as any).results);
  }, [lastScan]);

  const runScan = async () => {
    setLoading(true);
    try {
      const res = await callAI('sync_scan');
      if (res) { setResult(res); toast.success(`Sync-skanning klar — ${res.issues_found || 0} problem, ${res.auto_fixed_count || 0} auto-fixade`); }
    } finally { setLoading(false); }
  };

  const createTask = async (issue: any) => {
    const res = await callAI('create_action', { title: `Sync: ${issue.title}`, description: `${issue.description}\n\nÅtgärd: ${issue.fix_action}`, priority: issue.severity, category: 'data_integrity', source_type: 'sync_scan' });
    if (res?.work_item_id) { toast.success('Uppgift skapad'); openDetail(res.work_item_id); }
  };

  const sevColor = (s: string) => s === 'critical' ? 'text-destructive' : s === 'high' ? 'text-orange-500' : s === 'medium' ? 'text-yellow-500' : 'text-muted-foreground';
  const scoreColor = (s: number) => s >= 80 ? 'text-accent' : s >= 50 ? 'text-yellow-500' : 'text-destructive';

  const filteredIssues = result?.issues?.filter((i: any) => filter === 'all' || i.severity === filter || i.type === filter) || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2"><ArrowRightLeft className="w-5 h-5" /> Sync Scanner</h2>
          <p className="text-xs text-muted-foreground">Upptäcker frontend-backend inkonsekvenser automatiskt</p>
        </div>
        <Button onClick={runScan} disabled={loading} size="sm" className="gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          {loading ? 'Skannar...' : 'Kör Sync-skanning'}
        </Button>
      </div>

      {lastScan && !result && (
        <p className="text-xs text-muted-foreground">Senaste skanning: {new Date((lastScan as any).created_at).toLocaleString('sv-SE')}</p>
      )}

      {result && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="p-3">
              <div className="text-xs text-muted-foreground mb-1">Sync Score</div>
              <div className={cn('text-2xl font-bold', scoreColor(result.sync_score))}>{result.sync_score}/100</div>
              <Progress value={result.sync_score} className="h-1.5 mt-1" />
            </Card>
            <Card className="p-3">
              <div className="text-xs text-muted-foreground mb-1">Problem</div>
              <div className={cn('text-2xl font-bold', result.issues_found > 0 ? 'text-destructive' : 'text-accent')}>{result.issues_found}</div>
            </Card>
            <Card className="p-3">
              <div className="text-xs text-muted-foreground mb-1">Auto-fixade</div>
              <div className="text-2xl font-bold text-accent">{result.auto_fixed_count || 0}</div>
            </Card>
            <Card className="p-3">
              <div className="text-xs text-muted-foreground mb-1">Uppgifter skapade</div>
              <div className="text-2xl font-bold text-primary">{result.tasks_created || 0}</div>
            </Card>
          </div>

          <Card className="p-4"><p className="text-sm">{result.executive_summary}</p></Card>

          {/* Auto-fixed summary */}
          {result.auto_fixed?.length > 0 && (
            <Card className="p-4 border-accent/30 bg-accent/5">
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5"><CheckCircle className="w-4 h-4 text-accent" /> Automatiskt åtgärdat</h3>
              <ul className="space-y-1">
                {result.auto_fixed.map((f: any, i: number) => (
                  <li key={i} className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <CheckCircle className="w-3 h-3 text-accent shrink-0" /> {f.action} ({f.count} st)
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {/* Filters */}
          {result.issues?.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {['all', 'critical', 'high', 'medium', 'low'].map(f => (
                <Button key={f} size="sm" variant={filter === f ? 'default' : 'outline'} className="h-7 text-xs" onClick={() => setFilter(f)}>
                  {f === 'all' ? `Alla (${result.issues.length})` : f.charAt(0).toUpperCase() + f.slice(1)}
                </Button>
              ))}
            </div>
          )}

          {/* Issues */}
          <ScrollArea className="max-h-[50vh]">
            <div className="space-y-3">
              {filteredIssues.map((issue: any, i: number) => (
                <Card key={i} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={cn('font-semibold text-sm', sevColor(issue.severity))}>{issue.title}</span>
                        <Badge variant="outline" className="text-[10px]">{issue.severity}</Badge>
                        <Badge variant="secondary" className="text-[10px]">{syncTypeLabels[issue.type] || issue.type}</Badge>
                        <Badge variant="secondary" className="text-[10px]">{issue.affected_count} påverkade</Badge>
                        {issue.can_auto_fix && <Badge className="text-[10px] bg-accent/20 text-accent border-accent/30">Auto-fixbar</Badge>}
                      </div>
                      <p className="text-sm mb-2">{issue.description}</p>
                      <p className="text-xs text-muted-foreground"><strong>Åtgärd:</strong> {issue.fix_action}</p>
                    </div>
                    {!issue.can_auto_fix && (
                      <Button size="sm" variant="outline" className="shrink-0 h-8 text-xs gap-1" onClick={() => createTask(issue)}>
                        <Wrench className="w-3 h-3" /> Skapa uppgift
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
              {filteredIssues.length === 0 && result.issues?.length === 0 && (
                <Card className="p-6 text-center"><CheckCircle className="w-8 h-8 text-accent mx-auto mb-2" /><p className="text-sm font-medium">Inga sync-problem hittade! Frontend och backend är synkroniserade.</p></Card>
              )}
            </div>
          </ScrollArea>
        </>
      )}
    </div>
  );
};

// ── Action Governor Tab (Lovable 0.5) ──
const ActionGovernorTab = () => {
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
const PromptQueueTab = () => {
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


const AdminAI = () => {
  const [detailItem, setDetailItem] = useState<any>(null);
  const queryClient = useQueryClient();

// ── Orchestration Tab (Double-Pass Multi-AI) ──
const OrchestrationTab = () => {
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
              <ScrollArea className="max-h-[300px]">
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
              <ScrollArea className="max-h-[300px]">
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

  const openDetail = useCallback(async (itemId: string) => {
    const { data } = await supabase.from('work_items' as any).select('*').eq('id', itemId).maybeSingle();
    if (data) setDetailItem(data);
    else toast.error('Uppgiften hittades inte');
  }, []);

  const handleStatusChange = async (itemId: string, newStatus: string) => {
    const now = new Date().toISOString();
    const updates: Record<string, any> = { status: newStatus, updated_at: now };
    if (newStatus === 'done') updates.completed_at = now;
    await supabase.from('work_items' as any).update(updates).eq('id', itemId);
    queryClient.invalidateQueries({ queryKey: ['work-items'] });
    queryClient.invalidateQueries({ queryKey: ['ai-managed-items'] });
    if (newStatus === 'done') {
      triggerAiReviewForWorkItem(itemId, { context: 'admin_ai_detail' });
    }
  };

  return (
    <DetailContext.Provider value={{ openDetail }}>
    <div className="space-y-3 sm:space-y-6">
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
        </div>
        <div className="min-w-0">
          <h1 className="text-base sm:text-xl font-bold truncate">AI Center</h1>
          <p className="text-xs text-muted-foreground truncate">Unified AI — läser från alla datakällor</p>
        </div>
      </div>

      <AiCenterTabs defaultValue="lova-chat">

        <TabsContent value="lova-chat" className="mt-4">
          <LovaChatTab />
        </TabsContent>
        <TabsContent value="lova-prompts" className="mt-4">
          <LovaPromptsTab />
        </TabsContent>
        <TabsContent value="autopilot" className="mt-4">
          <AiAutopilotTab />
        </TabsContent>
        <TabsContent value="actions" className="mt-4">
          <ActionEngineTab />
        </TabsContent>
        <TabsContent value="scan" className="mt-4">
          <SystemScanTab />
        </TabsContent>
        <TabsContent value="dashboard" className="mt-4">
          <UnifiedDashboardTab />
        </TabsContent>
        <TabsContent value="visual-qa" className="mt-4">
          <VisualQATab />
        </TabsContent>
        <TabsContent value="nav-bug" className="mt-4">
          <NavBugScanTab />
        </TabsContent>
        <TabsContent value="data-health" className="mt-4">
          <DataHealthTab />
        </TabsContent>
        <TabsContent value="health" className="mt-4">
          <SystemHealthTab />
        </TabsContent>
        <TabsContent value="products" className="mt-4">
          <ProductSuggestionsTab />
        </TabsContent>
        <TabsContent value="tasks" className="mt-4">
          <TaskAITab />
        </TabsContent>
        <TabsContent value="prompts" className="mt-4">
          <PromptGeneratorTab />
        </TabsContent>
        <TabsContent value="bugs" className="mt-4">
          <BugAITab />
        </TabsContent>
        <TabsContent value="insights" className="mt-4">
          <DataInsightsTab />
        </TabsContent>
        <TabsContent value="structure" className="mt-4">
          <StructureAnalysisTab />
        </TabsContent>
        <TabsContent value="guardian" className="mt-4">
          <DevGuardianTab />
        </TabsContent>
        <TabsContent value="interaction-qa" className="mt-4">
          <InteractionQATab />
        </TabsContent>
        <TabsContent value="verification" className="mt-4">
          <VerificationEngineTab />
        </TabsContent>
        <TabsContent value="cleanup" className="mt-4">
          <DataCleanupTab />
        </TabsContent>
        <TabsContent value="auto-fix" className="mt-4">
          <AutoFixTab />
        </TabsContent>
        <TabsContent value="data-integrity" className="mt-4">
          <DataIntegrityTab />
        </TabsContent>
        <TabsContent value="content-validation" className="mt-4">
          <ContentValidationTab />
        </TabsContent>
        <TabsContent value="patterns" className="mt-4">
          <PatternDetectionTab />
        </TabsContent>
        <TabsContent value="focused-scan" className="mt-4">
          <FocusedScanTab />
        </TabsContent>
        <TabsContent value="overflow-scan" className="mt-4">
          <OverflowScanTab />
        </TabsContent>
        <TabsContent value="ux-scanner" className="mt-4">
          <UxScannerTab />
        </TabsContent>
        <TabsContent value="sync-scan" className="mt-4">
          <SyncScannerTab />
        </TabsContent>
        <TabsContent value="governor" className="mt-4">
          <ActionGovernorTab />
        </TabsContent>
        <TabsContent value="prompt-queue" className="mt-4">
          <PromptQueueTab />
        </TabsContent>
        <TabsContent value="orchestration" className="mt-4">
          <OrchestrationTab />
        </TabsContent>
      </AiCenterTabs>

      <WorkItemDetail
        item={detailItem}
        open={!!detailItem}
        onOpenChange={(open) => { if (!open) setDetailItem(null); }}
        onStatusChange={handleStatusChange}
        onRefresh={() => {
          queryClient.invalidateQueries({ queryKey: ['work-items'] });
          queryClient.invalidateQueries({ queryKey: ['ai-managed-items'] });
          if (detailItem) {
            supabase.from('work_items' as any).select('*').eq('id', detailItem.id).maybeSingle().then(({ data }) => {
              if (data) setDetailItem(data);
            });
          }
        }}
      />
    </div>
    </DetailContext.Provider>
  );
};

export default AdminAI;
