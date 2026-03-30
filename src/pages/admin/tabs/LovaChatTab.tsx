import { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2, Send, RefreshCw, Bot, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { callAI } from './_shared';

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

export const LovaChatTab = () => {
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
    <div className="flex flex-col h-[calc(100vh-280px)] min-h-[350px] max-h-[700px]">
      {/* Header + Input at TOP */}
      <div className="pb-3 border-b border-border space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Bot className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-xs sm:text-sm truncate">Lova</h3>
              <p className="text-[10px] sm:text-xs text-muted-foreground truncate hidden sm:block">AI-assistent · systemanalys</p>
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
              <p className="font-medium text-foreground">Hej! Jag är Lova</p>
              <p className="text-sm text-muted-foreground mt-1">
                Jag kan analysera data, köra skanningar, skapa uppgifter, ge tillväxtförslag och mycket mer.
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
