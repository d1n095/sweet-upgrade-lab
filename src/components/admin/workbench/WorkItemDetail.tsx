import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Sparkles, Tag, Copy, Loader2 as Loader2Icon, EyeOff, RotateCcw, PenLine, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import {
  Bug, ShieldAlert, Package, Clock, User, MapPin, FileText, AlertCircle,
  CheckCircle2, Loader2, ExternalLink, Wrench, Bot,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { triggerAiReviewForWorkItem } from '@/lib/workItemAiReview';

interface WorkItemDetailProps {
  item: {
    id: string;
    title: string;
    description: string | null;
    status: string;
    priority: string;
    item_type: string;
    source_type: string | null;
    source_id: string | null;
    related_order_id: string | null;
    created_at: string;
    assigned_to: string | null;
    claimed_by: string | null;
    created_by: string | null;
    ai_review_status?: string;
    ai_review_result?: any;
    ai_review_at?: string;
    ai_pre_verify_status?: string;
    ai_pre_verify_result?: any;
    ai_pre_verify_at?: string;
    resolution_notes?: string;
    ignored?: boolean;
    ignored_reason?: string;
    ai_root_causes?: any;
    human_selected_cause?: string;
    human_custom_cause?: string;
    human_custom_fix?: string;
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStatusChange: (itemId: string, newStatus: string) => Promise<void>;
  onRefresh?: () => void;
}

const BUG_CHECKLIST = [
  { key: 'reproduced', label: 'Buggen har reproducerats' },
  { key: 'identified', label: 'Grundorsaken har identifierats' },
  { key: 'fixed', label: 'Fix har implementerats' },
  { key: 'tested', label: 'Fixens funktion har verifierats' },
  { key: 'no_regression', label: 'Ingen regression upptäckt' },
];

const INCIDENT_CHECKLIST = [
  { key: 'investigated', label: 'Incidenten har undersökts' },
  { key: 'customer_contacted', label: 'Kunden har kontaktats' },
  { key: 'resolved', label: 'Lösning har implementerats' },
  { key: 'verified', label: 'Lösningen har verifierats' },
];

const GENERAL_CHECKLIST = [
  { key: 'understood', label: 'Uppgiften är förstådd' },
  { key: 'completed', label: 'Arbetet är utfört' },
  { key: 'verified', label: 'Resultatet har kontrollerats' },
];

const WorkItemDetail = ({ item, open, onOpenChange, onStatusChange, onRefresh }: WorkItemDetailProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [resolving, setResolving] = useState(false);
  const [fixSuggestion, setFixSuggestion] = useState<any>(null);
  const [analyzingFix, setAnalyzingFix] = useState(false);
  const [runningReview, setRunningReview] = useState(false);
  const [runningPreVerify, setRunningPreVerify] = useState(false);
  const [expandedCause, setExpandedCause] = useState<number | null>(null);
  const [showIgnoreForm, setShowIgnoreForm] = useState(false);
  const [ignoreReason, setIgnoreReason] = useState('');
  const [ignoreSaving, setIgnoreSaving] = useState(false);
  const [showCustomCause, setShowCustomCause] = useState(false);
  const [customCause, setCustomCause] = useState('');
  const [customFix, setCustomFix] = useState('');
  const [savingOverride, setSavingOverride] = useState(false);

  useEffect(() => {
    if (item) {
      setChecklist({});
      setResolutionNotes('');
      setFixSuggestion(null);
      setExpandedCause(null);
      setShowIgnoreForm(false);
      setIgnoreReason('');
      setShowCustomCause(false);
      setCustomCause(item.human_custom_cause || '');
      setCustomFix(item.human_custom_fix || '');
    }
  }, [item?.id]);

  const { data: sourceData, isLoading: sourceLoading } = useQuery({
    queryKey: ['work-item-source', item?.source_type, item?.source_id],
    queryFn: async () => {
      if (!item?.source_id || !item.source_type) return null;
      if (item.source_type === 'bug_report') {
        const { data } = await supabase.from('bug_reports').select('*').eq('id', item.source_id).maybeSingle();
        return { type: 'bug' as const, bug: data, incident: null };
      }
      if (item.source_type === 'order_incident') {
        const { data } = await supabase.from('order_incidents').select('*').eq('id', item.source_id).maybeSingle();
        return { type: 'incident' as const, bug: null, incident: data };
      }
      return null;
    },
    enabled: !!item?.source_id && !!item?.source_type,
  });

  const bugData = sourceData?.bug || null;
  const incidentData = sourceData?.incident || null;

  const reporterId = bugData?.user_id || incidentData?.reported_by || item?.created_by;
  const { data: reporterProfile } = useQuery({
    queryKey: ['reporter-profile', reporterId],
    queryFn: async () => {
      if (!reporterId) return null;
      const { data } = await supabase.from('profiles').select('user_id, username, first_name, last_name').eq('user_id', reporterId).maybeSingle();
      return data;
    },
    enabled: !!reporterId,
  });

  const assigneeId = item?.assigned_to || item?.claimed_by;
  const { data: assigneeProfile } = useQuery({
    queryKey: ['assignee-profile', assigneeId],
    queryFn: async () => {
      if (!assigneeId) return null;
      const { data } = await supabase.from('profiles').select('user_id, username, first_name, last_name').eq('user_id', assigneeId).maybeSingle();
      return data;
    },
    enabled: !!assigneeId,
  });

  if (!item) return null;

  const checklist_items = item.item_type === 'bug' ? BUG_CHECKLIST
    : item.item_type === 'incident' ? INCIDENT_CHECKLIST
    : GENERAL_CHECKLIST;

  const allChecked = checklist_items.every(c => checklist[c.key]);
  const isOpen = !['done', 'cancelled'].includes(item.status);

  const getProfileName = (profile: any) => {
    if (!profile) return 'Okänd';
    if (profile.first_name) return `${profile.first_name} ${profile.last_name || ''}`.trim();
    return profile.username || 'Okänd';
  };

  const fmtFull = (d: string) => {
    const date = new Date(d);
    return {
      date: format(date, 'yyyy-MM-dd'),
      time: format(date, 'HH:mm'),
      weekday: date.toLocaleDateString('sv-SE', { weekday: 'long' }),
      relative: getRelativeTime(date),
    };
  };

  const getRelativeTime = (date: Date) => {
    const diffMs = Date.now() - date.getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'just nu';
    if (mins < 60) return `${mins} min sedan`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h sedan`;
    const days = Math.floor(hours / 24);
    return `${days}d sedan`;
  };

  const handleResolve = async () => {
    if (!allChecked) { toast.error('Slutför checklistan först'); return; }
    setResolving(true);
    try {
      if (item.source_type === 'bug_report' && item.source_id) {
        await supabase.from('bug_reports').update({ resolution_notes: resolutionNotes.trim() || null }).eq('id', item.source_id);
      }
      await onStatusChange(item.id, 'done');
      toast.success('Markerad som klar — AI verifierar...');

      // Auto-trigger AI verification after marking as done
      triggerAiReviewForWorkItem(item.id, { context: 'auto_verify_on_resolve' }).then(reviewResult => {
        if (reviewResult.ok) {
          if (reviewResult.status === 'incomplete') {
            toast.error('⚠️ AI: Fixens verifiering misslyckades — uppgiften återöppnad', { duration: 6000 });
          } else if (reviewResult.status === 'needs_review') {
            toast.warning('AI: Behöver manuell granskning', { duration: 4000 });
          } else {
            toast.success('✅ AI: Verifierad!', { duration: 3000 });
          }
          onRefresh?.();
        }
      }).catch(() => { /* non-blocking */ });

      onOpenChange(false);
    } catch { toast.error('Något gick fel'); }
    finally { setResolving(false); }
  };

  const handleIgnore = async () => {
    if (!ignoreReason.trim()) { toast.error('Ange en anledning'); return; }
    setIgnoreSaving(true);
    try {
      await supabase.from('work_items').update({
        ignored: true,
        ignored_reason: ignoreReason.trim(),
        ignored_at: new Date().toISOString(),
        status: 'cancelled',
      } as any).eq('id', item.id);
      toast.success('Ignorerad ✓');
      onRefresh?.();
      onOpenChange(false);
    } catch { toast.error('Fel'); }
    finally { setIgnoreSaving(false); }
  };

  const handleUnignore = async () => {
    await supabase.from('work_items').update({
      ignored: false, ignored_reason: null, ignored_at: null, status: 'open',
    } as any).eq('id', item.id);
    toast.success('Återöppnad');
    onRefresh?.();
  };

  const handleSelectCause = async (causeText: string) => {
    setSavingOverride(true);
    try {
      const override = { type: 'select_cause', cause: causeText, at: new Date().toISOString(), by: user?.id };
      await supabase.from('work_items').update({
        human_selected_cause: causeText,
        ai_overrides: [...((item as any).ai_overrides || []), override],
      } as any).eq('id', item.id);
      toast.success('Orsak vald');
      onRefresh?.();
    } catch { toast.error('Fel'); }
    finally { setSavingOverride(false); }
  };

  const handleSaveCustomCause = async () => {
    if (!customCause.trim()) return;
    setSavingOverride(true);
    try {
      const override = { type: 'custom_cause', cause: customCause, fix: customFix, at: new Date().toISOString(), by: user?.id };
      await supabase.from('work_items').update({
        human_custom_cause: customCause.trim(),
        human_custom_fix: customFix.trim() || null,
        ai_overrides: [...((item as any).ai_overrides || []), override],
      } as any).eq('id', item.id);
      toast.success('Egen orsak sparad');
      setShowCustomCause(false);
      onRefresh?.();
    } catch { toast.error('Fel'); }
    finally { setSavingOverride(false); }
  };

  const handleRunRootCause = async () => {
    setAnalyzingFix(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error('Ej inloggad'); return; }
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ type: 'bug_fix_suggestion', bug_id: item.source_id }),
        }
      );
      if (resp.ok) {
        const { result } = await resp.json();
        setFixSuggestion(result);
        // Save root causes to DB
        if (result?.root_causes) {
          await supabase.from('work_items').update({ ai_root_causes: result } as any).eq('id', item.id);
        }
      } else {
        toast.error('AI-analys misslyckades');
      }
    } catch { toast.error('Fel'); }
    finally { setAnalyzingFix(false); }
  };

  const dt = fmtFull(item.created_at);
  const rootCauses = fixSuggestion?.root_causes || (item.ai_root_causes as any)?.root_causes || [];
  const analysisSummary = fixSuggestion?.summary || (item.ai_root_causes as any)?.summary;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[440px] sm:w-[520px] p-0 flex flex-col">
        <SheetHeader className="px-5 py-4 border-b border-border">
          <SheetTitle className="flex items-center gap-2 text-base">
            {item.item_type === 'bug' && <Bug className="w-4.5 h-4.5 text-destructive" />}
            {item.item_type === 'incident' && <ShieldAlert className="w-4.5 h-4.5 text-destructive" />}
            {!['bug', 'incident'].includes(item.item_type) && <Wrench className="w-4.5 h-4.5 text-muted-foreground" />}
            <span className="truncate">{item.title}</span>
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-5 space-y-5">
            {/* Ignored banner */}
            {item.ignored && (
              <div className="bg-muted rounded-lg p-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <EyeOff className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Ignorerad: {item.ignored_reason}</span>
                </div>
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={handleUnignore}>
                  <RotateCcw className="w-3 h-3" /> Återöppna
                </Button>
              </div>
            )}

            {/* Status + Priority */}
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={isOpen ? (item.status === 'escalated' ? 'destructive' : 'default') : 'secondary'}>
                {item.status === 'open' ? 'Öppen' : item.status === 'claimed' ? 'Tagen' :
                 item.status === 'in_progress' ? 'Pågående' : item.status === 'escalated' ? 'Eskalerad' :
                 item.status === 'cancelled' ? 'Avbruten' : 'Klar'}
              </Badge>
              <Badge variant="outline" className={cn('text-xs', {
                'text-destructive border-destructive/30': item.priority === 'critical' || item.priority === 'high',
                'text-yellow-600 border-yellow-300': item.priority === 'medium',
                'text-accent border-accent/30': item.priority === 'low',
              })}>
                {item.priority === 'critical' ? 'Kritisk' : item.priority === 'high' ? 'Hög' :
                 item.priority === 'medium' ? 'Medium' : 'Låg'} prioritet
              </Badge>
              {item.source_type && item.source_type !== 'manual' && (
                <Badge variant="outline" className="text-xs">
                  {item.source_type === 'bug_report' ? '🐛 Buggrapport' : item.source_type === 'order_incident' ? '⚠️ Incident' : item.source_type}
                </Badge>
              )}
            </div>

            {/* Meta grid */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="space-y-0.5">
                <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" /> Skapad</span>
                <p className="font-medium">{dt.weekday} {dt.date}</p>
                <p className="text-xs text-muted-foreground">kl {dt.time} ({dt.relative})</p>
              </div>
              <div className="space-y-0.5">
                <span className="text-xs text-muted-foreground flex items-center gap-1"><User className="w-3 h-3" /> Rapportör</span>
                <p className="font-medium">{getProfileName(reporterProfile)}</p>
              </div>
              {assigneeProfile && (
                <div className="space-y-0.5">
                  <span className="text-xs text-muted-foreground">Tilldelad</span>
                  <p className="font-medium">{getProfileName(assigneeProfile)}</p>
                </div>
              )}
              {bugData?.page_url && (
                <div className="space-y-0.5">
                  <span className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="w-3 h-3" /> Sida</span>
                  <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono block truncate">{bugData.page_url}</code>
                </div>
              )}
              {incidentData?.type && (
                <div className="space-y-0.5">
                  <span className="text-xs text-muted-foreground">Typ</span>
                  <p className="font-medium capitalize">{incidentData.type}</p>
                </div>
              )}
              {incidentData?.sla_deadline && (
                <div className="space-y-0.5">
                  <span className="text-xs text-muted-foreground">SLA Deadline</span>
                  <p className={cn('font-medium', new Date(incidentData.sla_deadline) < new Date() && 'text-destructive')}>
                    {format(new Date(incidentData.sla_deadline), 'yyyy-MM-dd HH:mm')}
                  </p>
                </div>
              )}
            </div>

            <Separator />

            {/* Human override display */}
            {(item.human_selected_cause || item.human_custom_cause) && (
              <div className="border border-accent/30 rounded-lg p-3 bg-accent/5 space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-accent">
                  <PenLine className="w-3.5 h-3.5" />
                  Manuell bedömning
                </div>
                {item.human_selected_cause && (
                  <div><span className="text-[10px] text-muted-foreground">Vald AI-orsak:</span><p className="text-xs">{item.human_selected_cause}</p></div>
                )}
                {item.human_custom_cause && (
                  <div><span className="text-[10px] text-muted-foreground">Egen orsak:</span><p className="text-xs">{item.human_custom_cause}</p></div>
                )}
                {item.human_custom_fix && (
                  <div><span className="text-[10px] text-muted-foreground">Egen fix:</span><p className="text-xs">{item.human_custom_fix}</p></div>
                )}
              </div>
            )}

            {/* AI Analysis for bugs */}
            {bugData && (bugData as any).ai_processed_at && (
              <div className="space-y-2 border border-primary/20 rounded-lg p-3 bg-primary/5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                  <Sparkles className="w-3.5 h-3.5" />
                  AI-analys
                  {(bugData as any).ai_approved && (
                    <Badge variant="outline" className="text-[9px] ml-1 border-accent/30 text-accent">✓ Godkänd</Badge>
                  )}
                </div>
                {(bugData as any).ai_summary && (
                  <div><span className="text-[10px] text-muted-foreground">Sammanfattning</span><p className="text-xs font-medium">{(bugData as any).ai_summary}</p></div>
                )}
                <div className="flex gap-1.5 flex-wrap">
                  {(bugData as any).ai_severity && <Badge variant="outline" className="text-[10px]">{(bugData as any).ai_severity}</Badge>}
                  {(bugData as any).ai_category && <Badge variant="outline" className="text-[10px]">{(bugData as any).ai_category}</Badge>}
                </div>
                {(bugData as any).ai_tags?.length > 0 && (
                  <div className="flex gap-1 flex-wrap">
                    {((bugData as any).ai_tags as string[]).map((tag: string) => (
                      <span key={tag} className="text-[9px] bg-muted px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                        <Tag className="w-2.5 h-2.5" />{tag}
                      </span>
                    ))}
                  </div>
                )}
                {(bugData as any).ai_repro_steps && (
                  <div>
                    <span className="text-[10px] text-muted-foreground">Reproduktionssteg</span>
                    <div className="text-xs bg-background rounded-md p-2 whitespace-pre-wrap border mt-0.5">{(bugData as any).ai_repro_steps}</div>
                  </div>
                )}
                {(bugData as any).ai_clean_prompt && (
                  <div>
                    <span className="text-[10px] text-muted-foreground">Strukturerad prompt</span>
                    <div className="text-xs bg-background rounded-md p-2 whitespace-pre-wrap border mt-0.5 font-mono">{(bugData as any).ai_clean_prompt}</div>
                  </div>
                )}
              </div>
            )}

            {/* Root Cause Analysis */}
            {bugData && item.item_type === 'bug' && (
              <div className="space-y-2">
                <Button size="sm" variant="outline" className="w-full gap-1.5" disabled={analyzingFix} onClick={handleRunRootCause}>
                  {analyzingFix ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  {rootCauses.length > 0 ? 'Kör ny AI-analys' : 'AI Root Cause-analys'}
                </Button>

                {rootCauses.length > 0 && (
                  <div className="border border-primary/20 rounded-lg p-3 bg-primary/5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                        <Sparkles className="w-3.5 h-3.5" />
                        Möjliga grundorsaker ({rootCauses.length})
                      </div>
                      {fixSuggestion?.overall_risk && (
                        <Badge variant="outline" className="text-[9px]">Risk: {fixSuggestion.overall_risk}</Badge>
                      )}
                    </div>

                    {analysisSummary && <p className="text-xs text-muted-foreground">{analysisSummary}</p>}

                    {rootCauses.map((rc: any, i: number) => (
                      <div key={i} className={cn('rounded-lg border p-2.5 space-y-2 transition-colors',
                        item.human_selected_cause === rc.cause ? 'border-accent bg-accent/5' : 'border-border/50 bg-background'
                      )}>
                        <button className="flex items-start justify-between w-full text-left gap-2" onClick={() => setExpandedCause(expandedCause === i ? null : i)}>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold">#{i + 1}</span>
                              <span className="text-xs font-medium truncate">{rc.cause}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <Progress value={rc.confidence} className="h-1 w-16" />
                              <span className="text-[10px] text-muted-foreground">{rc.confidence}%</span>
                              <Badge variant="outline" className="text-[9px]">{rc.risk_level}</Badge>
                            </div>
                          </div>
                          {expandedCause === i ? <ChevronUp className="w-3.5 h-3.5 shrink-0 mt-0.5" /> : <ChevronDown className="w-3.5 h-3.5 shrink-0 mt-0.5" />}
                        </button>

                        {expandedCause === i && (
                          <div className="space-y-2 pt-1">
                            <div className="text-xs"><span className="text-muted-foreground font-medium">Fix-strategi:</span><p className="mt-0.5">{rc.fix_strategy}</p></div>
                            {rc.code_suggestion && (
                              <div className="text-xs"><span className="text-muted-foreground font-medium">Kod:</span>
                                <pre className="text-[11px] bg-muted rounded-md p-2 mt-0.5 whitespace-pre-wrap font-mono">{rc.code_suggestion}</pre>
                              </div>
                            )}
                            {rc.affected_areas?.length > 0 && (
                              <div className="flex gap-1 flex-wrap">
                                {rc.affected_areas.map((a: string) => <span key={a} className="text-[9px] bg-muted px-1.5 py-0.5 rounded-full">{a}</span>)}
                              </div>
                            )}
                            <div className="flex gap-1.5">
                              <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1 flex-1" disabled={savingOverride}
                                onClick={() => handleSelectCause(rc.cause)}>
                                <CheckCircle2 className="w-2.5 h-2.5" />
                                {item.human_selected_cause === rc.cause ? 'Vald ✓' : 'Välj denna orsak'}
                              </Button>
                              <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1" onClick={() => {
                                navigator.clipboard.writeText(rc.lovable_prompt);
                                toast.success('Prompt kopierad');
                              }}>
                                <Copy className="w-2.5 h-2.5" /> Prompt
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Custom cause / fix */}
                {isOpen && (
                  <div className="space-y-2">
                    <Button size="sm" variant="ghost" className="w-full h-7 text-xs gap-1.5" onClick={() => setShowCustomCause(!showCustomCause)}>
                      <PenLine className="w-3 h-3" /> {showCustomCause ? 'Dölj egen orsak' : 'Skriv egen orsak / fix'}
                    </Button>
                    {showCustomCause && (
                      <div className="space-y-2 border rounded-lg p-3">
                        <Textarea placeholder="Beskriv grundorsaken..." value={customCause} onChange={e => setCustomCause(e.target.value)} rows={2} className="text-xs" />
                        <Textarea placeholder="Beskriv fix (valfritt)..." value={customFix} onChange={e => setCustomFix(e.target.value)} rows={2} className="text-xs" />
                        <Button size="sm" className="w-full h-7 text-xs" disabled={savingOverride || !customCause.trim()} onClick={handleSaveCustomCause}>
                          {savingOverride ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Spara'}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Description */}
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                <FileText className="w-3 h-3" /> Beskrivning
              </h3>
              <div className="text-sm bg-muted/50 rounded-lg p-3 whitespace-pre-wrap leading-relaxed">
                {bugData?.description || incidentData?.description || item.description || 'Ingen beskrivning'}
              </div>
            </div>

            {/* AI Pre-Verification Suggestion */}
            {item.ai_pre_verify_status && item.ai_pre_verify_status !== 'not_fixed' && item.ai_pre_verify_status !== 'dismissed' && (isOpen || item.ai_pre_verify_status === 'confirmed' || item.ai_pre_verify_status === 'rejected') && (
              <div className={cn('rounded-lg p-3 space-y-2.5 border', {
                'bg-accent/10 border-accent/30': item.ai_pre_verify_status === 'appears_fixed' || item.ai_pre_verify_status === 'confirmed',
                'bg-primary/5 border-primary/20': item.ai_pre_verify_status === 'possibly_fixed',
                'bg-destructive/5 border-destructive/20': item.ai_pre_verify_status === 'rejected',
              })}>
                <div className="flex items-center gap-1.5 text-xs font-semibold">
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                  {item.ai_pre_verify_status === 'confirmed' ? 'AI-förslag bekräftat' :
                   item.ai_pre_verify_status === 'rejected' ? 'AI-förslag avvisat' : 'AI förslag: Verkar löst'}
                  <Badge variant="outline" className={cn('text-[9px] ml-auto', {
                    'border-accent/40 text-accent': item.ai_pre_verify_status === 'appears_fixed' || item.ai_pre_verify_status === 'confirmed',
                    'border-primary/30 text-primary': item.ai_pre_verify_status === 'possibly_fixed',
                    'border-destructive/30 text-destructive': item.ai_pre_verify_status === 'rejected',
                  })}>
                    {item.ai_pre_verify_status === 'confirmed' ? '✅ Bekräftad av användare' :
                     item.ai_pre_verify_status === 'rejected' ? '❌ Avvisad — djupanalys körd' :
                     item.ai_pre_verify_status === 'appears_fixed' ? '✅ Verkar fixat' : '🔍 Möjligen fixat'}
                    {item.ai_pre_verify_result?.confidence != null && ` (${item.ai_pre_verify_result.confidence}%)`}
                  </Badge>
                </div>
                {item.ai_pre_verify_result?.reasoning && (
                  <p className="text-xs text-muted-foreground">{item.ai_pre_verify_result.reasoning}</p>
                )}
                {item.ai_pre_verify_result?.related_change && (
                  <p className="text-[10px] text-muted-foreground">
                    <span className="font-medium">Relaterad ändring:</span> {item.ai_pre_verify_result.related_change}
                  </p>
                )}
                {item.ai_pre_verify_at && (
                  <p className="text-[10px] text-muted-foreground">{fmtFull(item.ai_pre_verify_at).relative}</p>
                )}
                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant="default" className="flex-1 gap-1 h-7 text-xs"
                    disabled={runningPreVerify}
                    onClick={async () => {
                      setRunningPreVerify(true);
                      try {
                        // 1. Mark as done
                        await onStatusChange(item.id, 'done');
                        // 2. Log human confirmation
                        await supabase.from('work_items').update({
                          ai_pre_verify_status: 'confirmed',
                          ai_pre_verify_result: {
                            ...item.ai_pre_verify_result,
                            human_confirmed: true,
                            confirmed_at: new Date().toISOString(),
                            confirmed_by: user?.id,
                          },
                          resolution_notes: `✅ Bekräftad via AI-förslag (${item.ai_pre_verify_result?.confidence || '?'}% konfidens)`,
                        } as any).eq('id', item.id);
                        // 3. Log to change_log
                        await supabase.from('change_log').insert({
                          change_type: 'verification',
                          description: `Användare bekräftade AI-förslag: ${item.title}`,
                          affected_components: [item.item_type, 'ai_pre_verify'],
                          source: 'human_confirmation',
                          work_item_id: item.id,
                          bug_report_id: item.source_type === 'bug_report' ? item.source_id : null,
                          metadata: { ai_confidence: item.ai_pre_verify_result?.confidence, action: 'confirm' },
                        });
                        // 4. Trigger post-verify review
                        triggerAiReviewForWorkItem(item.id, { context: 'human_confirmed_pre_verify' });
                        toast.success('✅ Bekräftad och verifierad');
                        onRefresh?.();
                        onOpenChange(false);
                      } catch { toast.error('Fel'); }
                      finally { setRunningPreVerify(false); }
                    }}
                  >
                    {runningPreVerify ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                    Bekräfta fixad
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1 gap-1 h-7 text-xs text-destructive border-destructive/30"
                    disabled={runningPreVerify}
                    onClick={async () => {
                      setRunningPreVerify(true);
                      try {
                        // 1. Escalate priority
                        const newPriority = item.priority === 'low' ? 'medium' : item.priority === 'medium' ? 'high' : 'high';
                        await supabase.from('work_items').update({
                          ai_pre_verify_status: 'rejected',
                          ai_pre_verify_result: {
                            ...item.ai_pre_verify_result,
                            human_rejected: true,
                            rejected_at: new Date().toISOString(),
                            rejected_by: user?.id,
                          },
                          priority: newPriority,
                          status: 'open',
                        } as any).eq('id', item.id);
                        // 2. Log rejection
                        await supabase.from('change_log').insert({
                          change_type: 'rejection',
                          description: `Användare avvisade AI-förslag: ${item.title} — prioritet eskalerad till ${newPriority}`,
                          affected_components: [item.item_type, 'ai_pre_verify'],
                          source: 'human_rejection',
                          work_item_id: item.id,
                          bug_report_id: item.source_type === 'bug_report' ? item.source_id : null,
                          metadata: { ai_confidence: item.ai_pre_verify_result?.confidence, action: 'reject', escalated_to: newPriority },
                        });
                        toast.info('🔍 Avvisad — AI kör djupare analys...', { duration: 4000 });
                        // 3. Trigger deeper scan in background
                        const { data: { session } } = await supabase.auth.getSession();
                        if (session && item.source_type === 'bug_report' && item.source_id) {
                          fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
                            body: JSON.stringify({ type: 'deep_analysis', bug_id: item.source_id }),
                          }).then(() => {
                            toast.success('AI djupanalys slutförd');
                            onRefresh?.();
                          }).catch(() => {});
                        }
                        onRefresh?.();
                      } catch { toast.error('Fel'); }
                      finally { setRunningPreVerify(false); }
                    }}
                  >
                    {runningPreVerify ? <Loader2 className="w-3 h-3 animate-spin" /> : <AlertCircle className="w-3 h-3" />}
                    Inte fixad
                  </Button>
                </div>
              </div>
            )}

            {/* Pre-Verify Button for open items */}
            {isOpen && (
              <Button size="sm" variant="outline" className="w-full gap-1.5" disabled={runningPreVerify}
                onClick={async () => {
                  setRunningPreVerify(true);
                  try {
                    const { data: { session } } = await supabase.auth.getSession();
                    if (!session) { toast.error('Ej inloggad'); return; }
                    const resp = await fetch(
                      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant`,
                      {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
                        body: JSON.stringify({ type: 'pre_verify', work_item_id: item.id }),
                      }
                    );
                    if (resp.ok) {
                      const { result } = await resp.json();
                      const s = result?.pre_verify?.status;
                      if (s === 'appears_fixed') toast.success(`AI: Verkar fixat (${result.pre_verify.confidence}%)`);
                      else if (s === 'possibly_fixed') toast.info(`AI: Möjligen fixat (${result.pre_verify.confidence}%)`);
                      else toast.info('AI: Inget tyder på att det är löst');
                      onRefresh?.();
                    } else toast.error('AI-analys misslyckades');
                  } catch { toast.error('Fel'); }
                  finally { setRunningPreVerify(false); }
                }}
              >
                {runningPreVerify ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                AI: Kontrollera om löst
              </Button>
            )}

            {/* AI Review Results */}
            {item.ai_review_status && (
              <div className={cn('rounded-lg p-3 space-y-2 border', {
                'bg-accent/5 border-accent/20': item.ai_review_status === 'verified',
                'bg-yellow-50 border-yellow-200': item.ai_review_status === 'needs_review',
                'bg-destructive/5 border-destructive/20': item.ai_review_status === 'incomplete',
              })}>
                <div className="flex items-center gap-1.5 text-xs font-semibold">
                  <Bot className="w-3.5 h-3.5" />
                  AI-granskning
                  <Badge variant="outline" className={cn('text-[9px] ml-auto', {
                    'border-accent/30 text-accent': item.ai_review_status === 'verified',
                    'border-yellow-300 text-yellow-700': item.ai_review_status === 'needs_review',
                    'border-destructive/30 text-destructive': item.ai_review_status === 'incomplete',
                  })}>
                    {item.ai_review_status === 'verified' ? '✅ Verifierad' :
                     item.ai_review_status === 'needs_review' ? '⚠️ Behöver granskning' : '❌ Ofullständig'}
                  </Badge>
                </div>
                {item.ai_review_result?.verdict && <p className="text-xs">{item.ai_review_result.verdict}</p>}
                {item.ai_review_result?.confidence != null && (
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span>Konfidens: {item.ai_review_result.confidence}%</span>
                    {item.ai_review_at && <span>• {fmtFull(item.ai_review_at).relative}</span>}
                  </div>
                )}
                {item.ai_review_result?.risks?.length > 0 && (
                  <div className="text-xs">
                    <span className="font-medium text-destructive">Risker:</span>
                    <ul className="list-disc pl-4 mt-0.5 space-y-0.5">
                      {item.ai_review_result.risks.map((r: string, i: number) => <li key={i}>{r}</li>)}
                    </ul>
                  </div>
                )}
                {item.ai_review_result?.edge_cases?.length > 0 && (
                  <div className="text-xs">
                    <span className="font-medium text-yellow-700">Edge cases:</span>
                    <ul className="list-disc pl-4 mt-0.5 space-y-0.5">
                      {item.ai_review_result.edge_cases.map((e: string, i: number) => <li key={i}>{e}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Manual AI Review button */}
            {item.status === 'done' && (
              <Button size="sm" variant="outline" className="w-full gap-1.5" disabled={runningReview}
                onClick={async () => {
                  setRunningReview(true);
                  try {
                    const reviewResult = await triggerAiReviewForWorkItem(item.id, { context: 'work_item_detail_manual' });
                    if (!reviewResult.ok) toast.error('AI-granskning misslyckades');
                    else {
                      const s = reviewResult.status;
                      toast.success(s === 'verified' ? 'AI: ✅ Verifierad' : s === 'needs_review' ? 'AI: ⚠️ Behöver granskning' : 'AI: Granskning klar');
                    }
                    onRefresh?.();
                  } catch { toast.error('Fel vid AI-granskning'); }
                  finally { setRunningReview(false); }
                }}
              >
                {runningReview ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bot className="w-3.5 h-3.5" />}
                {item.ai_review_status ? 'Kör AI-granskning igen' : 'Kör AI-granskning'}
              </Button>
            )}

            {/* Resolution info */}
            {bugData?.status === 'resolved' && bugData.resolution_notes && (
              <div className="bg-accent/10 rounded-lg p-3 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-medium text-accent">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Löst {bugData.resolved_at && fmtFull(bugData.resolved_at).relative}
                </div>
                <p className="text-sm text-muted-foreground">{bugData.resolution_notes}</p>
              </div>
            )}
            {incidentData?.resolution && (
              <div className="bg-accent/10 rounded-lg p-3 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-medium text-accent">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Lösning
                </div>
                <p className="text-sm text-muted-foreground">{incidentData.resolution}</p>
              </div>
            )}

            {sourceLoading && (
              <div className="flex items-center justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
            )}

            {/* Resolve flow */}
            {isOpen && !item.ignored && (
              <>
                <Separator />
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center gap-1.5 mb-3">
                      <AlertCircle className="w-4 h-4 text-yellow-500" />
                      <h3 className="text-sm font-semibold">Checklista innan avslut</h3>
                    </div>
                    <div className="space-y-2">
                      {checklist_items.map(c => (
                        <label key={c.key} className="flex items-center gap-2.5 text-sm cursor-pointer hover:bg-muted/30 rounded-md px-2 py-1.5 transition-colors">
                          <Checkbox checked={!!checklist[c.key]} onCheckedChange={(v) => setChecklist(prev => ({ ...prev, [c.key]: !!v }))} />
                          <span className={cn(checklist[c.key] && 'text-muted-foreground line-through')}>{c.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <span className="text-xs text-muted-foreground block mb-1.5">Anteckningar (valfritt)</span>
                    <Textarea placeholder="Beskriv vad som gjordes / fixades..." value={resolutionNotes} onChange={e => setResolutionNotes(e.target.value)} rows={3} className="text-sm" />
                  </div>

                  <div className="flex gap-2">
                    <Button className="flex-1 gap-2" disabled={!allChecked || resolving} onClick={handleResolve}>
                      {resolving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                      Markera som klar
                    </Button>
                    <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground" onClick={() => setShowIgnoreForm(!showIgnoreForm)} title="Ignorera">
                      <EyeOff className="w-4 h-4" />
                    </Button>
                  </div>

                  {showIgnoreForm && (
                    <div className="border rounded-lg p-3 space-y-2 bg-muted/30">
                      <p className="text-xs font-medium">Ignorera detta ärende</p>
                      <p className="text-[10px] text-muted-foreground">AI kommer inte att ta upp detta problem igen.</p>
                      <Textarea placeholder="Anledning till ignorering..." value={ignoreReason} onChange={e => setIgnoreReason(e.target.value)} rows={2} className="text-xs" />
                      <Button size="sm" variant="destructive" className="w-full h-7 text-xs gap-1" disabled={ignoreSaving || !ignoreReason.trim()} onClick={handleIgnore}>
                        {ignoreSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <EyeOff className="w-3 h-3" />}
                        Ignorera permanent
                      </Button>
                    </div>
                  )}

                  {!allChecked && <p className="text-[11px] text-muted-foreground text-center">Alla checklistepunkter måste vara klara</p>}
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};

export default WorkItemDetail;