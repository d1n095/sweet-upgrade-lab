import { useState, useEffect } from 'react';
import { Copy, Loader2, AlertTriangle, RefreshCw, Bot, CheckCircle, XCircle, Shield, Zap, Wrench, Radar, ArrowRight, Monitor, Smartphone, Tablet, Eye, GitMerge, ChevronDown, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { createWorkItemWithDedup } from '@/utils/workItemDedup';
import { callAI } from './_shared';

interface QAIssue { title: string; page: string; severity: string; category: string; breakpoint: string; description: string; fix_suggestion: string; lovable_prompt: string }
interface FlowTest { flow_name: string; status: string; issues: string[] }
interface PageScore { page: string; score: number; status: string; notes: string }
interface VisualQAResult {
  overall_ui_score: number; mobile_score: number; desktop_score: number; usability_score: number; accessibility_score: number;
  executive_summary: string; issues: QAIssue[]; flow_tests: FlowTest[]; page_scores: PageScore[]; tasks_created: number;
  scan_id?: string;
}

type IssueStatus = 'open' | 'done' | 'ignored';
type AiDecision = 'auto_fix' | 'needs_prompt' | 'ignore';
interface IssueState {
  status: IssueStatus;
  note?: string;
  updatedAt: string;
  aiDecision?: AiDecision;
  aiDecisionReason?: string;
  generatedPrompt?: string;
  aiAnalysis?: { root_cause: string; auto_fixable: boolean; fix_steps: string[]; impact: string; confidence: string; decision: AiDecision; decision_reason: string; lovable_prompt?: string };
}

export const VisualQATab = () => {
  const [result, setResult] = useState<VisualQAResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<IssueStatus | 'all'>('all');
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [issueStates, setIssueStates] = useState<Record<number, IssueState>>({});
  const [analyzingIdx, setAnalyzingIdx] = useState<number | null>(null);
  const [ignoreNote, setIgnoreNote] = useState('');
  const [scanMeta, setScanMeta] = useState<{ id: string; created_at: string } | null>(null);
  const [triaging, setTriaging] = useState(false);
  const [scanHistory, setScanHistory] = useState<{ id: string; created_at: string; overall_ui_score: number; issues_count: number; executive_summary: string }[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [compareScanId, setCompareScanId] = useState<string | null>(null);
  const [compareResult, setCompareResult] = useState<VisualQAResult | null>(null);

  const loadHistory = async () => {
    const { data } = await (supabase.from('ai_scan_results') as any)
      .select('id, results, created_at, overall_score, issues_count, executive_summary')
      .eq('scan_type', 'visual_qa')
      .order('created_at', { ascending: false })
      .limit(20);
    if (data) {
      setScanHistory(data.map((d: any) => ({
        id: d.id,
        created_at: d.created_at,
        overall_ui_score: d.results?.overall_ui_score || d.overall_score || 0,
        issues_count: d.results?.issues?.length || d.issues_count || 0,
        executive_summary: d.executive_summary || d.results?.executive_summary || '',
      })));
    }
  };

  // Load last scan + history on mount
  useEffect(() => {
    (supabase.from('ai_scan_results') as any)
      .select('id, results, created_at')
      .eq('scan_type', 'visual_qa')
      .order('created_at', { ascending: false })
      .limit(1)
      .then(({ data }: any) => {
        if (data?.[0]) {
          setResult(data[0].results);
          setScanMeta({ id: data[0].id, created_at: data[0].created_at });
        }
      });
    loadHistory();
  }, []);

  const run = async () => {
    setLoading(true);
    setIssueStates({});
    setExpandedIdx(null);
    setCompareScanId(null);
    setCompareResult(null);
    const r = await callAI('visual_qa');
    if (r) {
      setResult(r);
      toast.success(`QA klar – ${r.issues?.length || 0} problem`);
      const { data } = await (supabase.from('ai_scan_results') as any)
        .select('id, created_at')
        .eq('scan_type', 'visual_qa')
        .order('created_at', { ascending: false })
        .limit(1);
      if (data?.[0]) setScanMeta({ id: data[0].id, created_at: data[0].created_at });
      await loadHistory();
    }
    setLoading(false);
  };

  const loadScan = async (scanId: string) => {
    const { data } = await (supabase.from('ai_scan_results') as any)
      .select('id, results, created_at')
      .eq('id', scanId)
      .single();
    if (data) {
      setResult(data.results);
      setScanMeta({ id: data.id, created_at: data.created_at });
      setIssueStates({});
      setExpandedIdx(null);
      setShowHistory(false);
      toast.success('Skanning laddad');
    }
  };

  const loadCompare = async (scanId: string) => {
    if (compareScanId === scanId) { setCompareScanId(null); setCompareResult(null); return; }
    const { data } = await (supabase.from('ai_scan_results') as any)
      .select('id, results')
      .eq('id', scanId)
      .single();
    if (data) {
      setCompareScanId(scanId);
      setCompareResult(data.results);
    }
  };

  const getState = (idx: number): IssueState => issueStates[idx] || { status: 'open', updatedAt: '' };

  const setIssueStatus = (idx: number, status: IssueStatus, note?: string) => {
    setIssueStates(prev => ({
      ...prev,
      [idx]: { ...prev[idx], status, note: note || prev[idx]?.note, updatedAt: new Date().toISOString(), aiAnalysis: prev[idx]?.aiAnalysis }
    }));
    toast.success(status === 'done' ? 'Markerad som klar' : status === 'ignored' ? 'Ignorerad' : 'Återöppnad');
  };

  const analyzeIssue = async (issue: QAIssue, idx: number) => {
    setAnalyzingIdx(idx);
    const res = await callAI('lova_chat', {
      message: `Analysera detta Visual QA-problem och bestäm hur det ska hanteras. Svara i JSON-format med fälten:
- root_cause (string): grundorsak
- auto_fixable (boolean): kan fixas automatiskt utan kodändring?
- fix_steps (array of strings): steg för att fixa
- impact (string): impact-bedömning
- confidence (string: high/medium/low)
- decision (string: "auto_fix" om du bedömer att det kan fixas direkt utan mänsklig hjälp, "needs_prompt" om det kräver en Lovable-prompt/kodändring, "ignore" om det är en falsk positiv eller inte värt att åtgärda)
- decision_reason (string): kort motivering till beslutet
- lovable_prompt (string, valfritt): om decision är "needs_prompt", generera en tydlig och komplett Lovable-prompt för att fixa problemet

Problem: ${issue.title}
Sida: ${issue.page}
Breakpoint: ${issue.breakpoint}
Kategori: ${issue.category}
Severity: ${issue.severity}
Beskrivning: ${issue.description}
Förslag: ${issue.fix_suggestion}`,
      conversation_id: null,
    });
    if (res?.response) {
      try {
        const jsonMatch = res.response.match(/\{[\s\S]*\}/);
        const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
        if (parsed) {
          const decision: AiDecision = ['auto_fix', 'needs_prompt', 'ignore'].includes(parsed.decision) ? parsed.decision : 'needs_prompt';
          setIssueStates(prev => ({
            ...prev,
            [idx]: {
              ...prev[idx] || { status: 'open', updatedAt: new Date().toISOString() },
              aiAnalysis: { ...parsed, decision, decision_reason: parsed.decision_reason || '' },
              aiDecision: decision,
              aiDecisionReason: parsed.decision_reason || '',
              generatedPrompt: parsed.lovable_prompt || issue.lovable_prompt,
            }
          }));
          // Auto-handle based on decision
          await handleAiDecision(issue, idx, decision, parsed);
        }
      } catch {
        setIssueStates(prev => ({
          ...prev,
          [idx]: {
            ...prev[idx] || { status: 'open', updatedAt: new Date().toISOString() },
            aiAnalysis: { root_cause: res.response, auto_fixable: false, fix_steps: [], impact: 'Okänd', confidence: 'low', decision: 'needs_prompt' as AiDecision, decision_reason: 'Kunde inte tolka AI-svar' },
            aiDecision: 'needs_prompt' as AiDecision,
          }
        }));
      }
    }
    setAnalyzingIdx(null);
  };

  const handleAiDecision = async (issue: QAIssue, idx: number, decision: AiDecision, analysis: any) => {
    if (decision === 'auto_fix') {
      // Create work item marked as auto-fixable and mark issue done (with dedup)
      try {
        const dedupResult = await createWorkItemWithDedup({
          title: `[Auto-fix] ${issue.title}`,
          description: `AI-beslut: Auto-fix\n\n${issue.description}\n\nGrundorsak: ${analysis.root_cause}\nFixsteg:\n${(analysis.fix_steps || []).map((s: string, i: number) => `${i + 1}. ${s}`).join('\n')}`,
          item_type: 'bug',
          priority: issue.severity === 'critical' ? 'critical' : issue.severity === 'high' ? 'high' : 'medium',
          source_type: 'ai_visual_qa',
          source_id: scanMeta?.id || null,
        });
        if (dedupResult.duplicate) {
          setIssueStatus(idx, 'done', 'Ärende finns redan i masterlistan');
          toast.info(`Ärende finns redan: ${issue.title}`);
        } else if (dedupResult.created) {
          setIssueStatus(idx, 'done', 'AI auto-fix: uppgift skapad');
          toast.success(`🤖 Auto-fix: ${issue.title}`);
        } else {
          toast.error(dedupResult.error || 'Kunde inte skapa uppgift');
        }
      } catch {
        toast.error('Kunde inte skapa auto-fix uppgift');
      }
    } else if (decision === 'ignore') {
      setIssueStatus(idx, 'ignored', analysis.decision_reason || 'AI bedömde som ej åtgärdskrävande');
      toast.info(`⏭️ AI ignorerade: ${issue.title}`);
    }
    // needs_prompt: stays open with generated prompt visible
  };

  const smartTriageAll = async () => {
    const openIssues = (result?.issues || [])
      .map((issue, idx) => ({ issue, idx }))
      .filter(({ idx }) => getState(idx).status === 'open' && !getState(idx).aiDecision);

    if (openIssues.length === 0) { toast.info('Inga öppna problem utan AI-beslut'); return; }
    setTriaging(true);
    toast.info(`Triagerar ${openIssues.length} problem...`);

    for (const { issue, idx } of openIssues) {
      await analyzeIssue(issue, idx);
      // Small delay between calls to avoid rate limiting
      await new Promise(r => setTimeout(r, 500));
    }

    setTriaging(false);
    const states = { auto_fix: 0, needs_prompt: 0, ignore: 0 };
    openIssues.forEach(({ idx }) => {
      const d = getState(idx).aiDecision;
      if (d) states[d]++;
    });
    toast.success(`Triage klar: ${states.auto_fix} auto-fix, ${states.needs_prompt} prompt, ${states.ignore} ignorerade`);
  };

  const createTaskFromIssue = async (issue: QAIssue, idx: number) => {
    const state = getState(idx);
    try {
      const dedupResult = await createWorkItemWithDedup({
        title: `[Visual QA] ${issue.title}`,
        description: `${issue.description}\n\nSida: ${issue.page}\nBreakpoint: ${issue.breakpoint}\nFix: ${issue.fix_suggestion}${state.aiAnalysis ? `\n\nAI Root Cause: ${state.aiAnalysis.root_cause}\nAuto-fixable: ${state.aiAnalysis.auto_fixable ? 'Ja' : 'Nej'}\nSteg:\n${state.aiAnalysis.fix_steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}` : ''}`,
        item_type: 'bug',
        priority: issue.severity === 'critical' ? 'critical' : issue.severity === 'high' ? 'high' : 'medium',
        source_type: 'ai_visual_qa',
        source_id: scanMeta?.id || null,
      });
      if (dedupResult.duplicate) {
        toast.info(`Ärende finns redan i masterlistan`);
      } else if (dedupResult.created) {
        setIssueStatus(idx, 'done');
        toast.success(`Uppgift skapad: ${issue.title}`);
      } else {
        toast.error(dedupResult.error || 'Kunde inte skapa uppgift');
      }
    } catch {
      toast.error('Kunde inte skapa uppgift');
    }
  };

  const sevColor = (s: string) => s === 'critical' ? 'text-destructive' : s === 'high' ? 'text-orange-500' : s === 'medium' ? 'text-yellow-500' : 'text-muted-foreground';
  const scoreColor = (s: number) => s >= 80 ? 'text-green-600' : s >= 50 ? 'text-yellow-500' : 'text-destructive';
  const flowIcon = (s: string) => s === 'pass' ? <CheckCircle className="w-4 h-4 text-green-600" /> : s === 'warning' ? <AlertTriangle className="w-4 h-4 text-yellow-500" /> : <XCircle className="w-4 h-4 text-destructive" />;
  const breakpointIcon = (bp: string) => bp === 'mobile' ? <Smartphone className="w-3.5 h-3.5" /> : bp === 'tablet' ? <Tablet className="w-3.5 h-3.5" /> : bp === 'desktop' ? <Monitor className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />;

  const filteredIssues = (result?.issues || [])
    .map((issue, idx) => ({ issue, idx }))
    .filter(({ issue, idx }) => {
      const state = getState(idx);
      if (statusFilter !== 'all' && state.status !== statusFilter) return false;
      if (filter !== 'all' && issue.severity !== filter && issue.breakpoint !== filter && issue.category !== filter) return false;
      return true;
    });

  const openCount = (result?.issues || []).filter((_, i) => getState(i).status === 'open').length;
  const doneCount = (result?.issues || []).filter((_, i) => getState(i).status === 'done').length;
  const ignoredCount = (result?.issues || []).filter((_, i) => getState(i).status === 'ignored').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2"><Monitor className="w-5 h-5 text-primary" /> Visual QA</h2>
          <p className="text-sm text-muted-foreground">
            AI analyserar sidor, flöden och breakpoints
            {scanMeta && <span className="ml-2 text-[10px] text-muted-foreground/60">Senast: {new Date(scanMeta.created_at).toLocaleString('sv-SE')}</span>}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={run} disabled={loading || triaging} className="gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Radar className="w-4 h-4" />}
            {loading ? 'Analyserar...' : 'Kör Visual QA'}
          </Button>
          {result && (result.issues?.length || 0) > 0 && (
            <Button onClick={smartTriageAll} disabled={loading || triaging} variant="outline" className="gap-2">
              {triaging ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bot className="w-4 h-4" />}
              {triaging ? 'Triagerar...' : 'Smart Triage'}
            </Button>
          )}
          {scanHistory.length > 0 && (
            <Button onClick={() => setShowHistory(!showHistory)} variant="ghost" className="gap-2">
              <History className="w-4 h-4" />
              Historik ({scanHistory.length})
            </Button>
          )}
        </div>
      </div>

      {/* Scan History Panel */}
      {showHistory && scanHistory.length > 0 && (
        <Card className="p-4">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><History className="w-4 h-4" /> Skanningshistorik</h3>
          <div className="max-h-[50vh] overflow-y-auto space-y-1.5">
            {scanHistory.map((scan, i) => {
              const isCurrent = scanMeta?.id === scan.id;
              const isComparing = compareScanId === scan.id;
              return (
                <div key={scan.id} className={cn(
                  'flex items-center gap-3 p-2.5 rounded-lg border text-xs transition-colors',
                  isCurrent && 'border-primary/40 bg-primary/5',
                  isComparing && 'border-accent bg-accent/10',
                  !isCurrent && !isComparing && 'hover:bg-secondary/30',
                )}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{new Date(scan.created_at).toLocaleString('sv-SE')}</span>
                      {isCurrent && <Badge variant="default" className="text-[9px]">Aktiv</Badge>}
                      {i === 0 && !isCurrent && <Badge variant="outline" className="text-[9px]">Senaste</Badge>}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-muted-foreground">
                      <span className={cn('font-bold', scan.overall_ui_score >= 80 ? 'text-green-600' : scan.overall_ui_score >= 50 ? 'text-yellow-500' : 'text-destructive')}>
                        {scan.overall_ui_score}/100
                      </span>
                      <span>{scan.issues_count} problem</span>
                      {scan.executive_summary && <span className="truncate max-w-[200px]">{scan.executive_summary}</span>}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {!isCurrent && (
                      <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2" onClick={() => loadScan(scan.id)}>
                        Visa
                      </Button>
                    )}
                    {result && !isCurrent && (
                      <Button variant={isComparing ? 'default' : 'outline'} size="sm" className="h-6 text-[10px] px-2" onClick={() => loadCompare(scan.id)}>
                        {isComparing ? '✓ Jämför' : 'Jämför'}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Comparison view */}
      {compareResult && result && (
        <Card className="p-4 border-accent">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <GitMerge className="w-4 h-4 text-accent-foreground" /> Jämförelse
            </h3>
            <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => { setCompareScanId(null); setCompareResult(null); }}>
              <XCircle className="w-3 h-3 mr-1" /> Stäng
            </Button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {([
              { label: 'UI Total', current: result.overall_ui_score, prev: compareResult.overall_ui_score },
              { label: 'Mobil', current: result.mobile_score, prev: compareResult.mobile_score },
              { label: 'Desktop', current: result.desktop_score, prev: compareResult.desktop_score },
              { label: 'Användbarhet', current: result.usability_score, prev: compareResult.usability_score },
              { label: 'Problem', current: result.issues?.length || 0, prev: compareResult.issues?.length || 0 },
            ]).map(c => {
              const diff = c.current - c.prev;
              const isIssueCount = c.label === 'Problem';
              const improved = isIssueCount ? diff < 0 : diff > 0;
              return (
                <div key={c.label} className="rounded-lg border p-2 text-center">
                  <p className="text-[10px] text-muted-foreground mb-1">{c.label}</p>
                  <div className="flex items-center justify-center gap-1.5">
                    <span className="text-muted-foreground text-sm">{c.prev}</span>
                    <ArrowRight className="w-3 h-3 text-muted-foreground" />
                    <span className="text-sm font-bold">{c.current}</span>
                  </div>
                  {diff !== 0 && (
                    <span className={cn('text-[10px] font-medium', improved ? 'text-green-600' : 'text-destructive')}>
                      {improved ? '▲' : '▼'} {Math.abs(diff)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {!result && !loading && (
        <Card className="p-8 flex flex-col items-center justify-center text-center gap-3">
          <Monitor className="w-10 h-10 text-muted-foreground/40" />
          <h3 className="font-semibold text-muted-foreground">Ingen skanning har körts ännu</h3>
          <p className="text-sm text-muted-foreground/70 max-w-md">Klicka på &quot;Kör Visual QA&quot; för att analysera alla sidor.</p>
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
          </Card>

          {/* Flow tests */}
          {result.flow_tests?.length > 0 && (
            <Card className="p-4">
              <h3 className="font-semibold text-sm mb-3">Flödestester</h3>
              <div className="space-y-2">
                {result.flow_tests.map((ft, i) => (
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
                {result.page_scores.map((ps, i) => (
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

          {/* Issues with status controls */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h3 className="font-semibold text-sm">Problem ({filteredIssues.length})</h3>
              <div className="flex gap-3 items-center flex-wrap">
                {/* Status filter */}
                <div className="flex gap-1">
                  {([['all', `Alla (${result.issues?.length || 0})`], ['open', `Öppna (${openCount})`], ['done', `Klara (${doneCount})`], ['ignored', `Ignorerade (${ignoredCount})`]] as [IssueStatus | 'all', string][]).map(([key, label]) => (
                    <Badge key={key} variant={statusFilter === key ? 'default' : 'outline'} className="text-[10px] cursor-pointer" onClick={() => setStatusFilter(key)}>
                      {label}
                    </Badge>
                  ))}
                </div>
                {/* Severity/type filter */}
                <div className="flex gap-1">
                  {['all', 'critical', 'high', 'mobile'].map(f => (
                    <Badge key={f} variant={filter === f ? 'default' : 'outline'} className="text-[10px] cursor-pointer" onClick={() => setFilter(f)}>
                      {f === 'all' ? 'Alla typer' : f}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            {filteredIssues.length === 0 ? (
              <div className="flex flex-col items-center py-8 gap-2 text-center">
                <CheckCircle className="w-8 h-8 text-green-600" />
                <p className="font-medium text-sm">Inga problem med vald filtrering</p>
              </div>
            ) : (
              <div className="max-h-[60vh] overflow-y-auto space-y-2 pr-1">
                {filteredIssues.map(({ issue, idx }) => {
                  const state = getState(idx);
                  const isExpanded = expandedIdx === idx;
                  const isAnalyzing = analyzingIdx === idx;

                  return (
                    <div
                      key={idx}
                      className={cn(
                        'border rounded-lg overflow-hidden transition-colors',
                        state.status === 'done' && 'opacity-50 border-green-500/30',
                        state.status === 'ignored' && 'opacity-40 border-muted',
                        state.status === 'open' && 'border-border hover:border-primary/30',
                      )}
                    >
                      {/* Clickable header */}
                      <button
                        className="w-full text-left p-3 flex items-start justify-between gap-2"
                        onClick={() => setExpandedIdx(isExpanded ? null : idx)}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {state.status === 'done' ? <CheckCircle className="w-4 h-4 text-green-600 shrink-0" /> :
                           state.status === 'ignored' ? <XCircle className="w-4 h-4 text-muted-foreground shrink-0" /> :
                           breakpointIcon(issue.breakpoint)}
                          <span className={cn('text-sm font-medium truncate', state.status !== 'open' && 'line-through')}>{issue.title}</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {state.aiDecision && (
                            <Badge variant={state.aiDecision === 'auto_fix' ? 'default' : state.aiDecision === 'ignore' ? 'outline' : 'secondary'} className="text-[10px]">
                              {state.aiDecision === 'auto_fix' ? '⚡' : state.aiDecision === 'ignore' ? '⏭️' : '📝'}
                            </Badge>
                          )}
                          <Badge variant="outline" className="text-[10px]">{issue.page}</Badge>
                          <Badge variant={issue.severity === 'critical' ? 'destructive' : 'outline'} className={cn('text-[10px]', sevColor(issue.severity))}>{issue.severity}</Badge>
                          <ChevronDown className={cn('w-4 h-4 text-muted-foreground transition-transform', isExpanded && 'rotate-180')} />
                        </div>
                      </button>

                      {/* Expanded detail panel */}
                      {isExpanded && (
                        <div className="border-t px-4 pb-4 pt-3 space-y-4 bg-muted/20">
                          {/* Description & meta */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <div>
                                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Beskrivning</p>
                                <p className="text-xs">{issue.description}</p>
                              </div>
                              <div>
                                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Impact</p>
                                <p className="text-xs">{issue.severity === 'critical' ? 'Blockerar användare eller skapar förlorad konvertering' : issue.severity === 'high' ? 'Påverkar användarupplevelsen negativt' : issue.severity === 'medium' ? 'Märkbart men inte kritiskt' : 'Mindre förbättringsmöjlighet'}</p>
                              </div>
                              <div>
                                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Föreslagen fix</p>
                                <p className="text-xs text-green-700 dark:text-green-400">{issue.fix_suggestion}</p>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <div className="flex gap-2 text-xs">
                                <span className="text-muted-foreground">Sida:</span><span className="font-medium">{issue.page}</span>
                              </div>
                              <div className="flex gap-2 text-xs">
                                <span className="text-muted-foreground">Breakpoint:</span><span className="font-medium flex items-center gap-1">{breakpointIcon(issue.breakpoint)} {issue.breakpoint}</span>
                              </div>
                              <div className="flex gap-2 text-xs">
                                <span className="text-muted-foreground">Kategori:</span><Badge variant="outline" className="text-[10px]">{issue.category}</Badge>
                              </div>
                              <div className="flex gap-2 text-xs">
                                <span className="text-muted-foreground">Status:</span>
                                <Badge variant={state.status === 'done' ? 'secondary' : state.status === 'ignored' ? 'outline' : 'default'} className="text-[10px]">
                                  {state.status === 'done' ? '✅ Klar' : state.status === 'ignored' ? '⏭️ Ignorerad' : '🔴 Öppen'}
                                </Badge>
                              </div>
                              {state.note && (
                                <div className="flex gap-2 text-xs">
                                  <span className="text-muted-foreground">Anteckning:</span><span className="italic">{state.note}</span>
                                </div>
                              )}
                              {scanMeta && (
                                <div className="flex gap-2 text-xs">
                                  <span className="text-muted-foreground">Scan:</span><span className="font-mono text-[10px]">{scanMeta.id.slice(0, 8)}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* AI Analysis & Decision section */}
                          {state.aiAnalysis && (
                            <div className="border rounded-lg p-3 bg-card space-y-3">
                              <div className="flex items-center justify-between">
                                <p className="text-[10px] font-semibold text-primary uppercase tracking-wider flex items-center gap-1"><Bot className="w-3 h-3" /> AI-analys & beslut</p>
                                {state.aiDecision && (
                                  <Badge variant={state.aiDecision === 'auto_fix' ? 'default' : state.aiDecision === 'ignore' ? 'outline' : 'secondary'} className="text-[10px]">
                                    {state.aiDecision === 'auto_fix' ? '⚡ Auto-fix' : state.aiDecision === 'ignore' ? '⏭️ Ignorera' : '📝 Kräver prompt'}
                                  </Badge>
                                )}
                              </div>

                              {/* Decision reason */}
                              {state.aiDecisionReason && (
                                <div className="bg-muted/40 rounded-md p-2 text-xs">
                                  <span className="font-medium text-muted-foreground">AI-motivering: </span>{state.aiDecisionReason}
                                </div>
                              )}

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                                <div>
                                  <p className="font-medium text-muted-foreground mb-0.5">Grundorsak</p>
                                  <p>{state.aiAnalysis.root_cause}</p>
                                </div>
                                <div>
                                  <p className="font-medium text-muted-foreground mb-0.5">Impact</p>
                                  <p>{state.aiAnalysis.impact}</p>
                                </div>
                              </div>
                              <div className="flex gap-2 items-center flex-wrap">
                                <Badge variant={state.aiAnalysis.auto_fixable ? 'default' : 'outline'} className="text-[10px]">
                                  {state.aiAnalysis.auto_fixable ? '🟢 Auto-fixbar' : '🔴 Manuell fix krävs'}
                                </Badge>
                                <Badge variant="outline" className="text-[10px]">Konfidens: {state.aiAnalysis.confidence}</Badge>
                              </div>
                              {state.aiAnalysis.fix_steps?.length > 0 && (
                                <div>
                                  <p className="font-medium text-muted-foreground text-xs mb-1">Fixsteg</p>
                                  <ol className="text-xs space-y-0.5 list-decimal list-inside">
                                    {state.aiAnalysis.fix_steps.map((step, si) => <li key={si}>{step}</li>)}
                                  </ol>
                                </div>
                              )}

                              {/* Generated Lovable prompt for needs_prompt */}
                              {state.aiDecision === 'needs_prompt' && state.generatedPrompt && (
                                <div className="border border-primary/20 rounded-md p-3 bg-primary/5 space-y-2">
                                  <div className="flex items-center justify-between">
                                    <p className="text-[10px] font-semibold text-primary uppercase tracking-wider">Genererad Lovable-prompt</p>
                                    <Button variant="ghost" size="sm" className="text-xs gap-1 h-6" onClick={() => { navigator.clipboard.writeText(state.generatedPrompt!); toast.success('Prompt kopierad'); }}>
                                      <Copy className="w-3 h-3" /> Kopiera
                                    </Button>
                                  </div>
                                  <p className="text-xs whitespace-pre-wrap font-mono bg-muted/30 rounded p-2 max-h-40 overflow-y-auto">{state.generatedPrompt}</p>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Action buttons */}
                          <div className="flex items-center gap-2 flex-wrap pt-1">
                            {state.status === 'open' && (
                              <>
                                <Button variant="default" size="sm" className="text-xs gap-1.5 h-7" onClick={() => analyzeIssue(issue, idx)} disabled={isAnalyzing || triaging}>
                                  {isAnalyzing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Bot className="w-3 h-3" />}
                                  {state.aiAnalysis ? 'Analysera igen' : 'AI-beslut'}
                                </Button>
                                <Button variant="outline" size="sm" className="text-xs gap-1.5 h-7" onClick={() => setIssueStatus(idx, 'done')}>
                                  <CheckCircle className="w-3 h-3" /> Markera klar
                                </Button>
                                <Button variant="outline" size="sm" className="text-xs gap-1.5 h-7" onClick={() => {
                                  const note = ignoreNote || undefined;
                                  setIssueStatus(idx, 'ignored', note);
                                  setIgnoreNote('');
                                }}>
                                  <XCircle className="w-3 h-3" /> Ignorera
                                </Button>
                                <Button variant="outline" size="sm" className="text-xs gap-1.5 h-7" onClick={() => createTaskFromIssue(issue, idx)}>
                                  <Wrench className="w-3 h-3" /> Skapa uppgift
                                </Button>
                                <Button variant="ghost" size="sm" className="text-xs gap-1.5 h-7" onClick={() => { navigator.clipboard.writeText(state.generatedPrompt || issue.lovable_prompt); toast.success('Prompt kopierad'); }}>
                                  <Copy className="w-3 h-3" /> Kopiera prompt
                                </Button>
                              </>
                            )}
                            {state.status !== 'open' && (
                              <Button variant="ghost" size="sm" className="text-xs gap-1.5 h-7" onClick={() => setIssueStatus(idx, 'open')}>
                                <RefreshCw className="w-3 h-3" /> Återöppna
                              </Button>
                            )}
                          </div>

                          {/* Ignore note input (shown when open) */}
                          {state.status === 'open' && (
                            <div className="flex gap-2 items-center">
                              <Input
                                placeholder="Anteckning vid ignorering (valfritt)..."
                                value={ignoreNote}
                                onChange={(e) => setIgnoreNote(e.target.value)}
                                className="h-7 text-xs flex-1"
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
};

// ── Structure Analysis Tab ──
