import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Sparkles, Tag, Copy, Loader2 as Loader2Icon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Bug, ShieldAlert, Package, Clock, User, MapPin, FileText, AlertCircle,
  CheckCircle2, Loader2, ExternalLink, Wrench,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { toast } from 'sonner';

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
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStatusChange: (itemId: string, newStatus: string) => Promise<void>;
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

const WorkItemDetail = ({ item, open, onOpenChange, onStatusChange }: WorkItemDetailProps) => {
  const { user } = useAuth();
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [resolving, setResolving] = useState(false);

  // Reset state when item changes
  useEffect(() => {
    if (item) {
      setChecklist({});
      setResolutionNotes('');
    }
  }, [item?.id]);

  // Fetch source data (bug_report or incident)
  const { data: sourceData, isLoading: sourceLoading } = useQuery({
    queryKey: ['work-item-source', item?.source_type, item?.source_id],
    queryFn: async () => {
      if (!item?.source_id || !item.source_type) return null;

      if (item.source_type === 'bug_report') {
        const { data } = await supabase
          .from('bug_reports')
          .select('*')
          .eq('id', item.source_id)
          .maybeSingle();
        return { type: 'bug' as const, bug: data, incident: null };
      }

      if (item.source_type === 'order_incident') {
        const { data } = await supabase
          .from('order_incidents')
          .select('*')
          .eq('id', item.source_id)
          .maybeSingle();
        return { type: 'incident' as const, bug: null, incident: data };
      }

      return null;
    },
    enabled: !!item?.source_id && !!item?.source_type,
  });

  const bugData = sourceData?.bug || null;
  const incidentData = sourceData?.incident || null;

  // Fetch reporter profile
  const reporterId = bugData?.user_id || incidentData?.reported_by || item?.created_by;
  const { data: reporterProfile } = useQuery({
    queryKey: ['reporter-profile', reporterId],
    queryFn: async () => {
      if (!reporterId) return null;
      const { data } = await supabase
        .from('profiles')
        .select('user_id, username, first_name, last_name')
        .eq('user_id', reporterId)
        .maybeSingle();
      return data;
    },
    enabled: !!reporterId,
  });

  // Fetch assigned staff profile
  const assigneeId = item?.assigned_to || item?.claimed_by;
  const { data: assigneeProfile } = useQuery({
    queryKey: ['assignee-profile', assigneeId],
    queryFn: async () => {
      if (!assigneeId) return null;
      const { data } = await supabase
        .from('profiles')
        .select('user_id, username, first_name, last_name')
        .eq('user_id', assigneeId)
        .maybeSingle();
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
    if (!allChecked) {
      toast.error('Slutför checklistan först');
      return;
    }
    setResolving(true);
    try {
      // If bug, update resolution notes on bug_reports
      if (item.source_type === 'bug_report' && item.source_id) {
        await supabase.from('bug_reports').update({
          resolution_notes: resolutionNotes.trim() || null,
        }).eq('id', item.source_id);
      }

      await onStatusChange(item.id, 'done');
      toast.success('Markerad som klar ✓');
      onOpenChange(false);
    } catch {
      toast.error('Något gick fel');
    } finally {
      setResolving(false);
    }
  };

  const dt = fmtFull(item.created_at);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[440px] sm:w-[500px] p-0 flex flex-col">
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
            {/* Status + Priority */}
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={isOpen ? (item.status === 'escalated' ? 'destructive' : 'default') : 'secondary'}>
                {item.status === 'open' ? 'Öppen' : item.status === 'claimed' ? 'Tagen' :
                 item.status === 'in_progress' ? 'Pågående' : item.status === 'escalated' ? 'Eskalerad' : 'Klar'}
              </Badge>
              <Badge variant="outline" className={cn('text-xs', {
                'text-destructive border-destructive/30': item.priority === 'critical' || item.priority === 'high',
                'text-warning border-warning/30': item.priority === 'medium',
                'text-accent border-accent/30': item.priority === 'low',
              })}>
                {item.priority === 'critical' ? 'Kritisk' : item.priority === 'high' ? 'Hög' :
                 item.priority === 'medium' ? 'Medium' : 'Låg'} prioritet
              </Badge>
              {item.source_type && item.source_type !== 'manual' && (
                <Badge variant="outline" className="text-xs bg-blue-50 text-blue-600 border-blue-200">
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

            {/* AI Analysis for bugs */}
            {bugData && (bugData as any).ai_processed_at && (
              <div className="space-y-2 border border-primary/20 rounded-lg p-3 bg-primary/5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                  <Sparkles className="w-3.5 h-3.5" />
                  AI-analys
                  {(bugData as any).ai_approved && (
                    <Badge variant="outline" className="text-[9px] ml-1 border-green-300 text-green-700">✓ Godkänd</Badge>
                  )}
                </div>
                {(bugData as any).ai_summary && (
                  <div><span className="text-[10px] text-muted-foreground">Sammanfattning</span><p className="text-xs font-medium">{(bugData as any).ai_summary}</p></div>
                )}
                <div className="flex gap-1.5 flex-wrap">
                  {(bugData as any).ai_severity && (
                    <Badge variant="outline" className="text-[10px]">{(bugData as any).ai_severity}</Badge>
                  )}
                  {(bugData as any).ai_category && (
                    <Badge variant="outline" className="text-[10px]">{(bugData as any).ai_category}</Badge>
                  )}
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

            {/* Description */}
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                <FileText className="w-3 h-3" /> Beskrivning
              </h3>
              <div className="text-sm bg-muted/50 rounded-lg p-3 whitespace-pre-wrap leading-relaxed">
                {bugData?.description || incidentData?.description || item.description || 'Ingen beskrivning'}
              </div>
            </div>

            {/* Resolution info if resolved */}
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

            {/* Source loading */}
            {sourceLoading && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            )}

            {/* Resolve flow */}
            {isOpen && (
              <>
                <Separator />
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center gap-1.5 mb-3">
                      <AlertCircle className="w-4 h-4 text-warning" />
                      <h3 className="text-sm font-semibold">Checklista innan avslut</h3>
                    </div>
                    <div className="space-y-2">
                      {checklist_items.map(c => (
                        <label
                          key={c.key}
                          className="flex items-center gap-2.5 text-sm cursor-pointer hover:bg-muted/30 rounded-md px-2 py-1.5 transition-colors"
                        >
                          <Checkbox
                            checked={!!checklist[c.key]}
                            onCheckedChange={(v) => setChecklist(prev => ({ ...prev, [c.key]: !!v }))}
                          />
                          <span className={cn(checklist[c.key] && 'text-muted-foreground line-through')}>
                            {c.label}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <span className="text-xs text-muted-foreground block mb-1.5">Anteckningar (valfritt)</span>
                    <Textarea
                      placeholder="Beskriv vad som gjordes / fixades..."
                      value={resolutionNotes}
                      onChange={e => setResolutionNotes(e.target.value)}
                      rows={3}
                      className="text-sm"
                    />
                  </div>

                  <Button
                    className="w-full gap-2"
                    disabled={!allChecked || resolving}
                    onClick={handleResolve}
                  >
                    {resolving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    Markera som klar
                  </Button>
                  {!allChecked && (
                    <p className="text-[11px] text-muted-foreground text-center">
                      Alla checklistepunkter måste vara klara
                    </p>
                  )}
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
