import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Sparkles, Bug, BarChart3, Copy, Loader2, Send, AlertTriangle, Lightbulb, Info, RefreshCw, Bot, CheckCircle, XCircle, Shield, Clock, Zap } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger, ScrollableTabs } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

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
    else if (resp.status === 402) toast.error('AI-krediter slut – lägg till mer i inställningar');
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

// ── Task AI Tab ──
const TaskAITab = () => {
  const [running, setRunning] = useState<string | null>(null);
  const [lastResults, setLastResults] = useState<any>(null);
  const queryClient = useQueryClient();

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
      {/* Action buttons */}
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

      {/* Last run results */}
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

      {/* Stats */}
      <div className="flex gap-3 text-xs text-muted-foreground">
        <span>🤖 AI-detekterade: <strong className="text-foreground">{detectedCount}</strong></span>
        <span>🚩 Flaggade: <strong className="text-foreground">{flaggedCount}</strong></span>
        <span>✅ Lösta: <strong className="text-foreground">{resolvedItems.length}</strong></span>
      </div>

      {/* Active AI items */}
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
              <div key={item.id} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      {item.ai_detected && <Bot className="w-3.5 h-3.5 text-primary shrink-0" />}
                      <p className="text-sm font-medium line-clamp-1">{item.title}</p>
                    </div>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      <Badge variant={item.priority === 'critical' ? 'destructive' : item.priority === 'high' ? 'destructive' : 'secondary'} className="text-[9px]">
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

                {/* Admin override actions */}
                <div className="flex gap-1.5 pt-1">
                  {item.status !== 'done' && (
                    <>
                      <Button
                        size="sm" variant="outline"
                        className="h-6 text-[10px] gap-1"
                        onClick={() => overrideItem(item.id, { status: 'done', completed_at: new Date().toISOString() })}
                      >
                        <CheckCircle className="w-2.5 h-2.5" /> Stäng
                      </Button>
                      <Button
                        size="sm" variant="outline"
                        className="h-6 text-[10px] gap-1"
                        onClick={() => overrideItem(item.id, { priority: 'critical' })}
                      >
                        <AlertTriangle className="w-2.5 h-2.5" /> Eskalera
                      </Button>
                      <Button
                        size="sm" variant="ghost"
                        className="h-6 text-[10px] gap-1"
                        onClick={() => overrideItem(item.id, { status: 'cancelled' })}
                      >
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

      {/* Recently resolved */}
      {resolvedItems.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground">Nyligen AI-lösta ({resolvedItems.length})</h4>
          <div className="space-y-1">
            {resolvedItems.slice(0, 5).map(item => (
              <div key={item.id} className="border rounded-md p-2 flex items-center justify-between gap-2 opacity-60">
                <div className="min-w-0">
                  <p className="text-xs truncate">{item.title}</p>
                  <p className="text-[9px] text-muted-foreground">{item.ai_resolution_notes?.substring(0, 80)}</p>
                </div>
                <Button
                  size="sm" variant="ghost"
                  className="h-5 text-[9px] shrink-0"
                  onClick={() => overrideItem(item.id, { status: 'open', completed_at: null })}
                >
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
        <Textarea
          placeholder="Beskriv ett problem, en idé eller en bugg..."
          value={input}
          onChange={e => setInput(e.target.value)}
          rows={4}
          className="text-sm"
        />
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
                <Badge variant={result.priority === 'critical' || result.priority === 'high' ? 'destructive' : 'secondary'} className="text-[10px]">
                  {result.priority}
                </Badge>
                {result.tags.map(t => (
                  <span key={t} className="text-[9px] bg-muted px-1.5 py-0.5 rounded-full">{t}</span>
                ))}
              </div>
            </div>
            <Button size="sm" variant="outline" className="gap-1 h-7 text-xs shrink-0" onClick={() => copyToClipboard(result.full_prompt)}>
              <Copy className="w-3 h-3" /> Kopiera
            </Button>
          </div>

          <Separator />

          <div className="space-y-2 text-sm">
            <div>
              <span className="text-xs font-semibold text-muted-foreground">🎯 MÅL</span>
              <p className="text-sm">{result.goal}</p>
            </div>
            {result.problem && (
              <div>
                <span className="text-xs font-semibold text-muted-foreground">⚠️ PROBLEM</span>
                <p className="text-sm">{result.problem}</p>
              </div>
            )}
            <div>
              <span className="text-xs font-semibold text-muted-foreground">📋 STEG</span>
              <ol className="list-decimal list-inside text-sm space-y-0.5 mt-0.5">
                {result.steps.map((s, i) => <li key={i}>{s}</li>)}
              </ol>
            </div>
            <div>
              <span className="text-xs font-semibold text-muted-foreground">✅ FÖRVÄNTAT RESULTAT</span>
              <p className="text-sm">{result.expected_result}</p>
            </div>
          </div>

          <Separator />

          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-muted-foreground">Full prompt</span>
              <Button size="sm" variant="ghost" className="h-5 text-[9px] gap-0.5 px-1" onClick={() => copyToClipboard(result.full_prompt)}>
                <Copy className="w-2.5 h-2.5" /> Kopiera
              </Button>
            </div>
            <div className="text-xs bg-muted/50 rounded-md p-3 whitespace-pre-wrap border font-mono max-h-60 overflow-y-auto">
              {result.full_prompt}
            </div>
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

  const INSIGHT_ICONS: Record<string, any> = {
    warning: AlertTriangle,
    opportunity: Lightbulb,
    info: Info,
  };

  const INSIGHT_COLORS: Record<string, string> = {
    warning: 'text-destructive bg-destructive/10 border-destructive/20',
    opportunity: 'text-green-700 bg-green-50 border-green-200',
    info: 'text-blue-700 bg-blue-50 border-blue-200',
  };

  return (
    <div className="space-y-4">
      <Button onClick={analyze} disabled={loading} className="w-full gap-2">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <BarChart3 className="w-4 h-4" />}
        Analysera data (senaste 7 dagarna)
      </Button>

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
                  <div className="flex items-center gap-1 pt-1">
                    <Send className="w-3 h-3" />
                    <span className="text-xs font-medium">{insight.action}</span>
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
    const { data } = await supabase
      .from('bug_reports')
      .select('id, description, page_url, status, ai_summary, ai_severity, ai_category, created_at')
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(20);
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
                    {bug.ai_severity && (
                      <Badge variant={bug.ai_severity === 'critical' || bug.ai_severity === 'high' ? 'destructive' : 'secondary'} className="text-[10px]">
                        {bug.ai_severity}
                      </Badge>
                    )}
                    {bug.ai_category && <Badge variant="outline" className="text-[10px]">{bug.ai_category}</Badge>}
                    <span className="text-[10px] text-muted-foreground">{bug.page_url}</span>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1 h-7 text-xs shrink-0"
                  disabled={analyzing === bug.id}
                  onClick={() => analyzeBug(bug.id)}
                >
                  {analyzing === bug.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                  Analysera
                </Button>
              </div>

              {fixes[bug.id] && (
                <div className="border-t pt-2 space-y-2 mt-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                    <Sparkles className="w-3.5 h-3.5" />
                    AI Fix-förslag
                    <Badge variant="outline" className="text-[9px] ml-auto">
                      Risk: {fixes[bug.id].risk_level}
                    </Badge>
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <div>
                      <span className="text-muted-foreground font-medium">Trolig orsak:</span>
                      <p>{fixes[bug.id].possible_cause}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground font-medium">Fix-strategi:</span>
                      <p>{fixes[bug.id].fix_strategy}</p>
                    </div>
                    {fixes[bug.id].code_suggestion && (
                      <div>
                        <span className="text-muted-foreground font-medium">Kodförslag:</span>
                        <pre className="text-[11px] bg-muted rounded-md p-2 mt-0.5 whitespace-pre-wrap font-mono overflow-x-auto">
                          {fixes[bug.id].code_suggestion}
                        </pre>
                      </div>
                    )}
                    <div>
                      <span className="text-muted-foreground font-medium">Berörda områden:</span>
                      <div className="flex gap-1 flex-wrap mt-0.5">
                        {fixes[bug.id].affected_areas.map((a: string) => (
                          <span key={a} className="text-[9px] bg-muted px-1.5 py-0.5 rounded-full">{a}</span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-1.5 pt-1">
                    <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1 flex-1" onClick={() => copyToClipboard(fixes[bug.id].lovable_prompt)}>
                      <Copy className="w-2.5 h-2.5" /> Kopiera Lovable-prompt
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};

// ── Main Page ──
const AdminAI = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold">AI Center</h1>
          <p className="text-sm text-muted-foreground">AI-verktyg för uppgiftshantering, analys och promptgenerering</p>
        </div>
      </div>

      <Tabs defaultValue="tasks" className="w-full">
        <ScrollableTabs>
          <TabsList>
            <TabsTrigger value="tasks" className="gap-1.5 text-xs">
              <Bot className="w-3.5 h-3.5" />
              Task AI
            </TabsTrigger>
            <TabsTrigger value="prompts" className="gap-1.5 text-xs">
              <Sparkles className="w-3.5 h-3.5" />
              Prompt Generator
            </TabsTrigger>
            <TabsTrigger value="bugs" className="gap-1.5 text-xs">
              <Bug className="w-3.5 h-3.5" />
              Bug AI
            </TabsTrigger>
            <TabsTrigger value="insights" className="gap-1.5 text-xs">
              <BarChart3 className="w-3.5 h-3.5" />
              AI Insights
            </TabsTrigger>
          </TabsList>
        </ScrollableTabs>

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
      </Tabs>
    </div>
  );
};

export default AdminAI;
