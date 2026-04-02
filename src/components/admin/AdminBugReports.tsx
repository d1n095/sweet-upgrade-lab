import { useState, useEffect, useCallback, useRef } from 'react';
import { Bug, CheckCircle2, Loader2, Clock, MapPin, User, ChevronDown, ChevronUp, AlertCircle, Sparkles, Tag, Search, RefreshCw, BookOpen, Copy, Filter, Crosshair, Wrench, FileCode, ClipboardCopy } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { safeInvoke, safeFetch } from '@/lib/safeInvoke';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { triggerAiReviewForWorkItem } from '@/lib/workItemAiReview';

interface ActionableFix {
  blocker_statement?: string;
  root_cause_exact?: string;
  location?: { file_path: string; function_name: string; system_area: string };
  fix_steps?: string[];
  copy_prompt?: string;
  root_causes?: { cause: string; confidence: number; affected_area: string }[];
  is_reproducible?: boolean;
  reproducibility_reasoning?: string;
  fix_suggestions?: { suggestion: string; effort: string; risk: string }[];
  affected_components?: string[];
}

interface BugReport {
  id: string;
  user_id: string;
  page_url: string;
  description: string;
  status: string;
  created_at: string;
  resolution_notes: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  ai_summary: string | null;
  ai_category: string | null;
  ai_severity: string | null;
  ai_tags: string[] | null;
  ai_clean_prompt: string | null;
  ai_processed_at: string | null;
  ai_approved: boolean;
  ai_actionable_fix: ActionableFix | null;
  work_item_status?: string;
  reporter_name?: string;
}

const RESOLVE_CHECKLIST = [
  { key: 'reproduced', label: 'Problemet har reproducerats' },
  { key: 'identified', label: 'Grundorsaken har identifierats' },
  { key: 'fixed', label: 'Fix har implementerats' },
  { key: 'tested', label: 'Fixens funktion har verifierats' },
  { key: 'no_regression', label: 'Ingen regression upptäckt' },
];

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-500/15 text-red-700 border-red-300',
  high: 'bg-orange-500/15 text-orange-700 border-orange-300',
  medium: 'bg-yellow-500/15 text-yellow-700 border-yellow-300',
  low: 'bg-blue-500/15 text-blue-700 border-blue-300',
};

const CATEGORY_COLORS: Record<string, string> = {
  UI: 'bg-purple-500/15 text-purple-700',
  payment: 'bg-green-500/15 text-green-700',
  auth: 'bg-red-500/15 text-red-700',
  system: 'bg-gray-500/15 text-gray-700',
  performance: 'bg-amber-500/15 text-amber-700',
  data: 'bg-cyan-500/15 text-cyan-700',
  unclear: 'bg-muted text-muted-foreground',
};

const AdminBugReports = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [localReports, setLocalReports] = useState<BugReport[] | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [resolving, setResolving] = useState<string | null>(null);
  const [processingAI, setProcessingAI] = useState<string | null>(null);
  const [promptSearch, setPromptSearch] = useState('');
  const [promptTagFilter, setPromptTagFilter] = useState<string | null>(null);
  

  const fetchBugs = async (): Promise<BugReport[]> => {
    const { data: bugs } = await supabase
      .from('bug_reports')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (bugs) {
      const bugIds = bugs.map(b => b.id);
      const userIds = [...new Set(bugs.map(b => b.user_id))];

      const [{ data: workItems }, { data: profiles }] = await Promise.all([
        supabase.from('work_items').select('source_id, status').eq('source_type', 'bug_report').in('source_id', bugIds),
        supabase.from('profiles').select('user_id, username, first_name, last_name').in('user_id', userIds),
      ]);

      const wiMap = new Map(workItems?.map(wi => [wi.source_id, wi.status]) || []);
      const profileMap = new Map(
        profiles?.map(p => [p.user_id, p.first_name ? `${p.first_name} ${p.last_name || ''}`.trim() : (p.username || 'Okänd')]) || []
      );

      const mapped = bugs.map(b => ({
        ...b,
        ai_tags: (b as any).ai_tags || [],
        ai_approved: (b as any).ai_approved || false,
        work_item_status: wiMap.get(b.id) || null,
        reporter_name: profileMap.get(b.user_id) || 'Okänd',
      })) as BugReport[];
      return mapped;
    }
    return [];
  };

  const { data: queryReports = [], isLoading: loading, refetch } = useQuery({
    queryKey: ['bug-reports'],
    queryFn: fetchBugs,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });

  // Use local optimistic state when set, otherwise use query data
  const reports = localReports ?? queryReports;
  const setReports = (updater: BugReport[] | ((prev: BugReport[]) => BugReport[])) => {
    setLocalReports(prev => {
      const current = prev ?? queryReports;
      return typeof updater === 'function' ? updater(current) : updater;
    });
  };

  // Sync local state when query data changes
  useEffect(() => {
    setLocalReports(null); // Reset optimistic state on fresh data
  }, [queryReports]);

  // Auto-enrich on mount
  const enrichedRef = useRef(false);
  useEffect(() => {
    if (!loading && queryReports.length > 0 && !enrichedRef.current) {
      enrichedRef.current = true;
      autoEnrichBugs();
    }
  }, [loading, queryReports]);

  const autoEnrichBugs = async () => {
    const { data: unprocessed } = await supabase
      .from('bug_reports')
      .select('id')
      .is('ai_processed_at', null)
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(5);
    if (!unprocessed?.length) return;
    console.log(`[BugEnrich] Auto-processing ${unprocessed.length} bugs`);
    for (const bug of unprocessed) {
      try {
        await safeInvoke('process-bug-report', { body: { bug_id: bug.id }, isAdmin: true });
      } catch (e) {
        console.warn(`[BugEnrich] Failed for ${bug.id}:`, e);
      }
    }
    // Reload to show enriched data
    refetch();
  };

  const openBug = useCallback((id: string) => {
    setExpandedId(prev => {
      if (prev === id) return null;
      setChecklist({});
      setResolutionNotes('');
      return id;
    });
  }, []);

  const allChecked = RESOLVE_CHECKLIST.every(c => checklist[c.key]);

  const processWithAI = async (bugId: string) => {
    setProcessingAI(bugId);
    try {
      const resp = await safeFetch('process-bug-report', {
        body: { bug_id: bugId },
        isAdmin: true,
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        toast.error(err.error || 'AI-bearbetning misslyckades');
        return;
      }

      const { result } = await resp.json();
      setReports(prev => prev.map(r =>
        r.id === bugId
          ? {
              ...r,
              ai_summary: result.summary,
              ai_category: result.category,
              ai_severity: result.severity,
              ai_tags: result.tags,
              ai_clean_prompt: result.copy_prompt,
              ai_processed_at: new Date().toISOString(),
              ai_actionable_fix: {
                blocker_statement: result.blocker_statement,
                root_cause_exact: result.root_cause_exact,
                location: result.location,
                fix_steps: result.fix_steps,
                copy_prompt: result.copy_prompt,
                root_causes: result.root_causes,
                is_reproducible: result.is_reproducible,
                reproducibility_reasoning: result.reproducibility_reasoning,
                fix_suggestions: result.fix_suggestions,
                affected_components: result.affected_components || [],
              },
            }
          : r
      ));
      toast.success('AI-analys klar ✓');
    } catch {
      toast.error('Något gick fel');
    } finally {
      setProcessingAI(null);
    }
  };

  const approveAI = async (bugId: string) => {
    await supabase.from('bug_reports').update({ ai_approved: true } as any).eq('id', bugId);
    setReports(prev => prev.map(r => r.id === bugId ? { ...r, ai_approved: true } : r));
    toast.success('AI-analys godkänd');
  };

  const resolve = async (id: string) => {
    if (!allChecked) { toast.error('Slutför checklistan'); return; }
    setResolving(id);
    try {
      const { data: wi } = await supabase.from('work_items').select('id').eq('source_type', 'bug_report').eq('source_id', id).maybeSingle();
      await supabase.from('bug_reports').update({
        status: 'resolved',
        resolved_at: new Date().toISOString(),
        resolved_by: user?.id,
        resolution_notes: resolutionNotes.trim() || null,
      }).eq('id', id);
      if (wi) {
        await supabase.from('work_items').update({ status: 'done', completed_at: new Date().toISOString() }).eq('id', wi.id);
        const reviewResult = await triggerAiReviewForWorkItem(wi.id, { context: 'admin_bug_reports_resolve' });
        if (!reviewResult.ok) {
          toast.warning('AI-granskning misslyckades — kräver manuell kontroll');
        }
      }
      setReports(prev => prev.map(r => r.id === id ? { ...r, status: 'resolved', work_item_status: 'done', resolved_at: new Date().toISOString(), resolution_notes: resolutionNotes.trim() || null } : r));
      setExpandedId(null);
      toast.success('Bugg markerad som löst ✓');
    } catch { toast.error('Något gick fel'); }
    finally {
      setResolving(null);
      queryClient.invalidateQueries({ queryKey: ['bug-reports'] });
      queryClient.invalidateQueries({ queryKey: ['work-items'] });
    }
  };

  const fmtDateTime = (d: string) => {
    const date = new Date(d);
    return {
      date: date.toLocaleDateString('sv-SE', { year: 'numeric', month: 'short', day: 'numeric' }),
      time: date.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }),
      relative: getRelativeTime(date),
    };
  };

  const getRelativeTime = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'just nu';
    if (diffMins < 60) return `${diffMins} min sedan`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h sedan`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d sedan`;
  };

  const copyToClipboard = (text: string, buttonId?: string) => {
    const clean = text.replace(/[#*`_~>]/g, '').replace(/\n{3,}/g, '\n\n').trim();
    navigator.clipboard.writeText(clean);
    if (buttonId) {
      const el = document.getElementById(buttonId);
      if (el) {
        el.textContent = '✓ Kopierad';
        el.classList.add('text-green-600');
        setTimeout(() => { el.textContent = '📋 Copy Fix'; el.classList.remove('text-green-600'); }, 2000);
      }
    }
    toast.success('Kopierat till urklipp');
  };

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  const inbox = reports.filter(r => !r.ai_processed_at);
  const processed = reports.filter(r => !!r.ai_processed_at);
  const promptLibrary = processed.filter(r => r.ai_clean_prompt);

  // Collect all unique tags for filter
  const allTags = [...new Set(promptLibrary.flatMap(r => r.ai_tags || []))].sort();

  const filteredPrompts = promptLibrary.filter(r => {
    const matchSearch = !promptSearch || 
      r.ai_clean_prompt?.toLowerCase().includes(promptSearch.toLowerCase()) ||
      r.ai_summary?.toLowerCase().includes(promptSearch.toLowerCase());
    const matchTag = !promptTagFilter || r.ai_tags?.includes(promptTagFilter);
    return matchSearch && matchTag;
  });

  const openCount = reports.filter(r => r.status === 'open').length;

  const renderBugCard = (r: BugReport, showAI = false) => {
    const dt = fmtDateTime(r.created_at);
    const isExpanded = expandedId === r.id;
    const isOpen = r.status === 'open';
    const isProcessing = processingAI === r.id;

    return (
      <div
        key={r.id}
        className={cn(
          'border rounded-lg transition-colors',
          isOpen ? 'border-destructive/30 bg-destructive/5' : 'border-border',
          isExpanded && 'ring-1 ring-primary/30'
        )}
      >
        <button
          onClick={() => openBug(r.id)}
          className="w-full text-left p-3 flex items-start justify-between gap-2 hover:bg-muted/30 transition-colors rounded-lg"
        >
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Badge variant={isOpen ? 'destructive' : 'secondary'} className="text-[10px]">
                {isOpen ? 'Öppen' : 'Löst'}
              </Badge>
              {showAI && r.ai_severity && (
                <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full border font-medium', SEVERITY_COLORS[r.ai_severity])}>
                  {r.ai_severity}
                </span>
              )}
              {showAI && r.ai_category && (
                <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium', CATEGORY_COLORS[r.ai_category])}>
                  {r.ai_category}
                </span>
              )}
              {r.ai_approved && (
                <Badge variant="outline" className="text-[9px] border-green-300 text-green-700">✓ Godkänd</Badge>
              )}
            </div>
            <p className="text-sm font-medium leading-snug line-clamp-2">
              {showAI && r.ai_summary ? r.ai_summary : r.description}
            </p>
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><User className="w-3 h-3" />{r.reporter_name}</span>
              <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{r.page_url}</span>
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{dt.relative}</span>
            </div>
            {showAI && r.ai_tags && r.ai_tags.length > 0 && (
              <div className="flex gap-1 flex-wrap mt-0.5">
                {r.ai_tags.map(tag => (
                  <span key={tag} className="text-[9px] bg-muted px-1.5 py-0.5 rounded-full">{tag}</span>
                ))}
              </div>
            )}
          </div>
          <div className="shrink-0 pt-1">
            {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </div>
        </button>

        {isExpanded && (
          <div className="px-3 pb-3 space-y-3 border-t border-border/50">
            <Separator className="my-0" />

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-muted-foreground block mb-0.5">Rapporterad</span>
                <span className="font-medium">{dt.date} kl {dt.time}</span>
              </div>
              <div>
                <span className="text-muted-foreground block mb-0.5">Rapportör</span>
                <span className="font-medium">{r.reporter_name}</span>
              </div>
              <div className="col-span-2">
                <span className="text-muted-foreground block mb-0.5">Sida</span>
                <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{r.page_url}</code>
              </div>
            </div>

            <div>
              <span className="text-xs text-muted-foreground block mb-1">Originalbeskrivning</span>
              <div className="text-sm bg-muted/50 rounded-md p-2.5 whitespace-pre-wrap leading-relaxed">{r.description}</div>
            </div>

            {/* AI Actionable Fix Section */}
            {r.ai_processed_at ? (
              <div className="space-y-3 border border-primary/20 rounded-lg p-3 bg-primary/5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                    <Sparkles className="w-3.5 h-3.5" />
                    AI Actionable Fix
                  </div>
                  <div className="flex gap-1">
                    {!r.ai_approved && (
                      <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1" onClick={() => approveAI(r.id)}>
                        <CheckCircle2 className="w-3 h-3" /> Godkänn
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="h-6 text-[10px] gap-1" onClick={() => processWithAI(r.id)}>
                      <RefreshCw className={cn("w-3 h-3", isProcessing && "animate-spin")} /> Kör igen
                    </Button>
                  </div>
                </div>

                {/* BLOCKER */}
                {(r.ai_actionable_fix?.blocker_statement || r.ai_summary) && (
                  <div className="bg-destructive/10 border border-destructive/20 rounded-md p-2.5">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-destructive mb-1">🔴 BLOCKER</div>
                    <p className="text-xs font-medium">{r.ai_actionable_fix?.blocker_statement || r.ai_summary}</p>
                  </div>
                )}

                {/* ROOT CAUSE */}
                {r.ai_actionable_fix?.root_cause_exact && (
                  <div className="bg-muted/50 border rounded-md p-2.5">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-foreground mb-1">🧠 ROOT CAUSE</div>
                    <p className="text-xs">{r.ai_actionable_fix.root_cause_exact}</p>
                  </div>
                )}

                {/* LOCATION */}
                {r.ai_actionable_fix?.location && (
                  <div className="bg-muted/50 border rounded-md p-2.5">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-foreground mb-1">
                      <Crosshair className="w-3 h-3" /> LOCATION
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-xs">
                        <FileCode className="w-3 h-3 text-muted-foreground shrink-0" />
                        <code className="bg-background px-1.5 py-0.5 rounded font-mono text-[11px]">{r.ai_actionable_fix.location.file_path}</code>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-muted-foreground">→</span>
                        <span className="font-medium">{r.ai_actionable_fix.location.function_name}</span>
                        <span className="text-[9px] bg-muted px-1.5 py-0.5 rounded-full">{r.ai_actionable_fix.location.system_area}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* FIX STEPS */}
                {r.ai_actionable_fix?.fix_steps && r.ai_actionable_fix.fix_steps.length > 0 && (
                  <div className="bg-muted/50 border rounded-md p-2.5">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-foreground mb-1.5">
                      <Wrench className="w-3 h-3" /> FIX (EXACT)
                    </div>
                    <ol className="space-y-1.5 ml-0.5">
                      {r.ai_actionable_fix.fix_steps.map((step, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs">
                          <span className="shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary font-bold text-[10px] flex items-center justify-center mt-0.5">{i + 1}</span>
                          <span className="flex-1">{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                {/* COPY PROMPT */}
                {(r.ai_actionable_fix?.copy_prompt || r.ai_clean_prompt) && (
                  <div className="bg-background border-2 border-primary/30 rounded-md p-2.5">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-foreground">
                        <ClipboardCopy className="w-3 h-3" /> COPY PROMPT
                      </div>
                      <Button
                        size="sm"
                        variant="default"
                        className="h-6 text-[10px] gap-1"
                        id={`copy-fix-bug-${r.id}`}
                        onClick={() => copyToClipboard(r.ai_actionable_fix?.copy_prompt || r.ai_clean_prompt!, `copy-fix-bug-${r.id}`)}
                      >
                        📋 Copy Fix
                      </Button>
                    </div>
                    <div className="text-xs bg-muted rounded-md p-2.5 whitespace-pre-wrap font-mono leading-relaxed border max-h-48 overflow-y-auto">
                      {r.ai_actionable_fix?.copy_prompt || r.ai_clean_prompt}
                    </div>
                  </div>
                )}

                {/* Root causes with confidence */}
                {r.ai_actionable_fix?.root_causes && r.ai_actionable_fix.root_causes.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-[10px] text-muted-foreground font-semibold block">Möjliga orsaker (rankat)</span>
                    {r.ai_actionable_fix.root_causes.map((rc, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs bg-background rounded-md p-2 border">
                        <div className={cn(
                          'shrink-0 w-8 h-5 rounded text-[10px] font-bold flex items-center justify-center',
                          rc.confidence >= 70 ? 'bg-destructive/15 text-destructive' : rc.confidence >= 40 ? 'bg-amber-500/15 text-amber-700' : 'bg-muted text-muted-foreground'
                        )}>
                          {rc.confidence}%
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium">{rc.cause}</p>
                          <span className="text-[10px] text-muted-foreground">{rc.affected_area}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Reproducibility */}
                {r.ai_actionable_fix?.is_reproducible !== undefined && (
                  <div className="text-xs space-y-0.5">
                    <Badge variant={r.ai_actionable_fix.is_reproducible ? 'destructive' : 'secondary'} className="text-[9px]">
                      {r.ai_actionable_fix.is_reproducible ? 'Reproducerbar' : 'Ej säkert reproducerbar'}
                    </Badge>
                    {r.ai_actionable_fix.reproducibility_reasoning && (
                      <p className="text-muted-foreground mt-1">{r.ai_actionable_fix.reproducibility_reasoning}</p>
                    )}
                  </div>
                )}

                {/* Affected components */}
                {r.ai_actionable_fix?.affected_components && r.ai_actionable_fix.affected_components.length > 0 && (
                  <div>
                    <span className="text-[10px] text-muted-foreground block mb-1">Berörda filer</span>
                    <div className="flex gap-1 flex-wrap">
                      {r.ai_actionable_fix.affected_components.map((c, i) => (
                        <code key={i} className="text-[9px] bg-muted px-1.5 py-0.5 rounded font-mono">{c}</code>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="w-full gap-1.5"
                disabled={isProcessing}
                onClick={() => processWithAI(r.id)}
              >
                {isProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                Bearbeta med AI
              </Button>
            )}

            {r.status === 'resolved' && (
              <div className="bg-accent/10 rounded-md p-2.5 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-medium text-accent">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Löst {r.resolved_at && fmtDateTime(r.resolved_at).relative}
                </div>
                {r.resolution_notes && <p className="text-xs text-muted-foreground">{r.resolution_notes}</p>}
              </div>
            )}

            {isOpen && (
              <div className="space-y-3">
                <Separator />
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <AlertCircle className="w-3.5 h-3.5 text-yellow-600" />
                    <span className="text-xs font-semibold">Checklista innan lösning</span>
                  </div>
                  <div className="space-y-2">
                    {RESOLVE_CHECKLIST.map(item => (
                      <label key={item.key} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted/30 rounded px-1.5 py-1 transition-colors">
                        <Checkbox checked={!!checklist[item.key]} onCheckedChange={(v) => setChecklist(prev => ({ ...prev, [item.key]: !!v }))} />
                        <span className={cn(checklist[item.key] && 'text-muted-foreground line-through')}>{item.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block mb-1">Anteckningar (valfritt)</span>
                  <Textarea placeholder="Beskriv vad som fixades..." value={resolutionNotes} onChange={e => setResolutionNotes(e.target.value)} rows={2} className="text-xs" />
                </div>
                <Button size="sm" className="w-full gap-1.5" disabled={!allChecked || resolving === r.id} onClick={() => resolve(r.id)}>
                  {resolving === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  Markera som löst
                </Button>
                {!allChecked && <p className="text-[10px] text-muted-foreground text-center">Slutför alla steg i checklistan först</p>}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex h-full min-h-0 flex-col space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bug className="w-5 h-5 text-destructive" />
          <h2 className="font-semibold">Buggrapporter</h2>
          <Badge variant={openCount > 0 ? 'destructive' : 'secondary'} className="text-xs">{openCount} öppna</Badge>
          <Badge variant="outline" className="text-xs">{reports.length} totalt</Badge>
        </div>
        <Button size="sm" variant="ghost" className="gap-1.5 h-7 text-xs" onClick={() => refetch()}>
          <RefreshCw className="w-3 h-3" /> Uppdatera
        </Button>
      </div>

      <Tabs defaultValue="inbox" className="w-full min-h-0 flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="inbox" className="gap-1.5 text-xs">
            <Bug className="w-3.5 h-3.5" />
            Inkorg
            {inbox.length > 0 && <Badge variant="destructive" className="text-[9px] h-4 px-1">{inbox.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="processed" className="gap-1.5 text-xs">
            <Sparkles className="w-3.5 h-3.5" />
            Bearbetade
            <Badge variant="outline" className="text-[9px] h-4 px-1">{processed.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="prompts" className="gap-1.5 text-xs">
            <BookOpen className="w-3.5 h-3.5" />
            Promptbibliotek
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inbox" className="mt-3 min-h-0 flex-1">
          {inbox.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Alla buggar är bearbetade 🎉</p>
          ) : (
            <ScrollArea className="h-full min-h-0">
              <div className="space-y-2 pr-2">{inbox.map(r => renderBugCard(r, false))}</div>
            </ScrollArea>
          )}
        </TabsContent>

        <TabsContent value="processed" className="mt-3 min-h-0 flex-1">
          {processed.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Inga bearbetade buggar ännu</p>
          ) : (
            <ScrollArea className="h-full min-h-0">
              <div className="space-y-2 pr-2">{processed.map(r => renderBugCard(r, true))}</div>
            </ScrollArea>
          )}
        </TabsContent>

        <TabsContent value="prompts" className="mt-3 min-h-0 flex-1 flex flex-col space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Sök i promptbiblioteket..."
                value={promptSearch}
                onChange={e => setPromptSearch(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>
            {promptTagFilter && (
              <Button size="sm" variant="ghost" className="h-8 text-xs gap-1" onClick={() => setPromptTagFilter(null)}>
                <Filter className="w-3 h-3" /> Rensa
              </Button>
            )}
          </div>

          {allTags.length > 0 && (
            <div className="flex gap-1 flex-wrap">
              {allTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => setPromptTagFilter(promptTagFilter === tag ? null : tag)}
                  className={cn(
                    'text-[10px] px-2 py-0.5 rounded-full border transition-colors',
                    promptTagFilter === tag ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted hover:bg-muted/80 border-border'
                  )}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}

          {filteredPrompts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Inga promptar hittade</p>
          ) : (
            <ScrollArea className="flex-1 min-h-0">
              <div className="space-y-2 pr-2">
                {filteredPrompts.map(r => (
                  <div key={r.id} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap mb-1">
                          {r.ai_severity && (
                            <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full border font-medium', SEVERITY_COLORS[r.ai_severity])}>{r.ai_severity}</span>
                          )}
                          {r.ai_category && (
                            <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium', CATEGORY_COLORS[r.ai_category])}>{r.ai_category}</span>
                          )}
                          <Badge variant={r.status === 'open' ? 'destructive' : 'secondary'} className="text-[9px]">
                            {r.status === 'open' ? 'Öppen' : 'Löst'}
                          </Badge>
                        </div>
                        <p className="text-xs font-medium mb-1">{r.ai_actionable_fix?.blocker_statement || r.ai_summary}</p>
                        {r.ai_actionable_fix?.location && (
                          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-1">
                            <FileCode className="w-3 h-3" />
                            <code className="font-mono">{r.ai_actionable_fix.location.file_path}</code>
                            <span>→ {r.ai_actionable_fix.location.function_name}</span>
                          </div>
                        )}
                      </div>
                      <Button size="sm" variant="default" className="h-6 text-[10px] gap-0.5 shrink-0" onClick={() => copyToClipboard(r.ai_actionable_fix?.copy_prompt || r.ai_clean_prompt!)}>
                        <Copy className="w-2.5 h-2.5" /> Kopiera Fix
                      </Button>
                    </div>
                    {r.ai_actionable_fix?.fix_steps && r.ai_actionable_fix.fix_steps.length > 0 && (
                      <div className="text-xs space-y-1 bg-muted/30 rounded-md p-2 border">
                        {r.ai_actionable_fix.fix_steps.map((step, i) => (
                          <div key={i} className="flex items-start gap-1.5">
                            <span className="shrink-0 text-primary font-bold text-[10px]">{i + 1}.</span>
                            <span>{step}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="text-xs bg-muted/50 rounded-md p-2 whitespace-pre-wrap border font-mono leading-relaxed max-h-32 overflow-y-auto">
                      {r.ai_actionable_fix?.copy_prompt || r.ai_clean_prompt}
                    </div>
                    {r.ai_tags && r.ai_tags.length > 0 && (
                      <div className="flex gap-1 flex-wrap">
                        {r.ai_tags.map(tag => (
                          <span key={tag} className="text-[9px] bg-muted px-1.5 py-0.5 rounded-full">{tag}</span>
                        ))}
                      </div>
                    )}
                    <div className="text-[10px] text-muted-foreground">
                      {r.page_url} · {fmtDateTime(r.created_at).relative}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminBugReports;
