import { useState, useCallback } from 'react';
import { Bug, CheckCircle2, Loader2, Clock, MapPin, User, ChevronDown, ChevronUp, AlertCircle, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

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

const AdminBugReports = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [resolving, setResolving] = useState<string | null>(null);

  const fetchBugs = async (): Promise<BugReport[]> => {
    const { data: bugs } = await supabase
      .from('bug_reports')
      .select('id, user_id, page_url, description, status, created_at, resolution_notes, resolved_at, resolved_by')
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

      return bugs.map(b => ({
        ...b,
        work_item_status: wiMap.get(b.id) || null,
        reporter_name: profileMap.get(b.user_id) || 'Okänd',
      })) as BugReport[];
    }
    return [];
  };

  const { data: reports = [], isLoading: loading, refetch } = useQuery({
    queryKey: ['bug-reports'],
    queryFn: fetchBugs,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });

  const openBug = useCallback((id: string) => {
    setExpandedId(prev => {
      if (prev === id) return null;
      setChecklist({});
      setResolutionNotes('');
      return id;
    });
  }, []);

  const allChecked = RESOLVE_CHECKLIST.every(c => checklist[c.key]);

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
      }
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

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  const openReports = reports.filter(r => r.status === 'open');
  const resolvedReports = reports.filter(r => r.status !== 'open');
  const openCount = openReports.length;

  const renderBugCard = (r: BugReport) => {
    const dt = fmtDateTime(r.created_at);
    const isExpanded = expandedId === r.id;
    const isOpen = r.status === 'open';

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
            </div>
            <p className="text-sm font-medium leading-snug line-clamp-2">{r.description}</p>
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><User className="w-3 h-3" />{r.reporter_name}</span>
              <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{r.page_url}</span>
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{dt.relative}</span>
            </div>
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
              <span className="text-xs text-muted-foreground block mb-1">Beskrivning</span>
              <div className="text-sm bg-muted/50 rounded-md p-2.5 whitespace-pre-wrap leading-relaxed">{r.description}</div>
            </div>

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

      <Tabs defaultValue="open" className="w-full min-h-0 flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="open" className="gap-1.5 text-xs">
            <Bug className="w-3.5 h-3.5" />
            Öppna
            {openCount > 0 && <Badge variant="destructive" className="text-[9px] h-4 px-1">{openCount}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="resolved" className="gap-1.5 text-xs">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Lösta
            <Badge variant="outline" className="text-[9px] h-4 px-1">{resolvedReports.length}</Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="open" className="mt-3 min-h-0 flex-1">
          {openReports.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Inga öppna buggar 🎉</p>
          ) : (
            <ScrollArea className="h-full min-h-0">
              <div className="space-y-2 pr-2">{openReports.map(r => renderBugCard(r))}</div>
            </ScrollArea>
          )}
        </TabsContent>

        <TabsContent value="resolved" className="mt-3 min-h-0 flex-1">
          {resolvedReports.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Inga lösta buggar ännu</p>
          ) : (
            <ScrollArea className="h-full min-h-0">
              <div className="space-y-2 pr-2">{resolvedReports.map(r => renderBugCard(r))}</div>
            </ScrollArea>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminBugReports;
