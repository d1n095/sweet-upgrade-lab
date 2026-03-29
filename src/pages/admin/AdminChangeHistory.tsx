import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Search, GitCommit, Bug, Wrench, Bot, Zap, FileCode, Clock,
  ChevronDown, ChevronUp, Link2, AlertTriangle, CheckCircle2, RefreshCw,
} from 'lucide-react';
import { format, subDays, isAfter } from 'date-fns';
import { cn } from '@/lib/utils';

const SOURCE_META: Record<string, { label: string; icon: typeof Bot; color: string }> = {
  lovable: { label: 'Lovable', icon: Bot, color: 'text-purple-600 bg-purple-600/10' },
  ai: { label: 'System', icon: Zap, color: 'text-blue-600 bg-blue-600/10' },
  manual: { label: 'Manuell', icon: Wrench, color: 'text-muted-foreground bg-secondary' },
  automation: { label: 'Automation', icon: RefreshCw, color: 'text-orange-600 bg-orange-600/10' },
  system: { label: 'System', icon: FileCode, color: 'text-cyan-600 bg-cyan-600/10' },
};

const TYPE_COLORS: Record<string, string> = {
  fix: 'bg-green-100 text-green-700 border-green-200',
  feature: 'bg-blue-100 text-blue-700 border-blue-200',
  update: 'bg-amber-100 text-amber-700 border-amber-200',
  reopen: 'bg-red-100 text-red-700 border-red-200',
  refactor: 'bg-violet-100 text-violet-700 border-violet-200',
};

const DATE_RANGES = [
  { value: 'all', label: 'Alla' },
  { value: '1', label: 'Idag' },
  { value: '7', label: '7 dagar' },
  { value: '30', label: '30 dagar' },
];

const AdminChangeHistory = () => {
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [dateRange, setDateRange] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: changes = [], isLoading } = useQuery({
    queryKey: ['change-log', sourceFilter, typeFilter, dateRange],
    queryFn: async () => {
      let query = supabase
        .from('change_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(300);

      if (sourceFilter !== 'all') query = query.eq('source', sourceFilter);
      if (typeFilter !== 'all') query = query.eq('change_type', typeFilter);
      if (dateRange !== 'all') {
        const since = subDays(new Date(), Number(dateRange)).toISOString();
        query = query.gte('created_at', since);
      }

      const { data } = await query;
      return data || [];
    },
  });

  // Fetch linked bugs & work items for expanded entries
  const { data: linkedBugs = [] } = useQuery({
    queryKey: ['change-linked-bugs', expandedId],
    enabled: !!expandedId,
    queryFn: async () => {
      const entry = changes.find(c => c.id === expandedId);
      if (!entry?.bug_report_id) return [];
      const { data } = await supabase
        .from('bug_reports')
        .select('id, description, status, ai_severity, ai_category, created_at')
        .eq('id', entry.bug_report_id);
      return data || [];
    },
  });

  const { data: staffProfiles = [] } = useQuery({
    queryKey: ['staff-profiles-changelog'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('user_id, username');
      return data || [];
    },
  });

  const getStaffName = (userId: string | null) => {
    if (!userId) return 'System';
    const p = staffProfiles.find(s => s.user_id === userId);
    return p?.username || userId.slice(0, 8);
  };

  const filtered = changes.filter(c => {
    if (!search) return true;
    const s = search.toLowerCase();
    return c.description?.toLowerCase().includes(s) ||
      c.affected_components?.some((comp: string) => comp.toLowerCase().includes(s)) ||
      c.change_type?.toLowerCase().includes(s);
  });

  // Stats
  const today = new Date();
  const todayCount = changes.filter(c => isAfter(new Date(c.created_at), subDays(today, 1))).length;
  const weekCount = changes.filter(c => isAfter(new Date(c.created_at), subDays(today, 7))).length;
  const bugFixCount = changes.filter(c => c.change_type === 'fix').length;
  const reopenCount = changes.filter(c => c.change_type === 'reopen').length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Ändringshistorik</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Alla systemändringar med kopplingar till buggar, uppgifter och AI-verifiering
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Idag', value: todayCount, icon: Clock, color: 'text-blue-600' },
          { label: '7 dagar', value: weekCount, icon: GitCommit, color: 'text-primary' },
          { label: 'Bugfixar', value: bugFixCount, icon: Bug, color: 'text-green-600' },
          { label: 'Återöppnade', value: reopenCount, icon: AlertTriangle, color: 'text-destructive' },
        ].map(stat => (
          <Card key={stat.label} className="border-border">
            <CardContent className="py-3 px-4 flex items-center gap-3">
              <stat.icon className={cn('w-5 h-5', stat.color)} />
              <div>
                <p className="text-lg font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-end">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Sök beskrivning, komponenter..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-36 h-9"><SelectValue placeholder="Källa" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alla källor</SelectItem>
            <SelectItem value="lovable">Lovable</SelectItem>
            <SelectItem value="ai">System</SelectItem>
            <SelectItem value="manual">Manuell</SelectItem>
            <SelectItem value="automation">Automation</SelectItem>
            <SelectItem value="system">System</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-36 h-9"><SelectValue placeholder="Typ" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alla typer</SelectItem>
            <SelectItem value="fix">Fix</SelectItem>
            <SelectItem value="feature">Feature</SelectItem>
            <SelectItem value="update">Update</SelectItem>
            <SelectItem value="reopen">Reopen</SelectItem>
            <SelectItem value="refactor">Refactor</SelectItem>
          </SelectContent>
        </Select>
        <Select value={dateRange} onValueChange={setDateRange}>
          <SelectTrigger className="w-32 h-9"><SelectValue placeholder="Period" /></SelectTrigger>
          <SelectContent>
            {DATE_RANGES.map(r => (
              <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Badge variant="secondary" className="h-9 px-3 flex items-center">
          {filtered.length} ändringar
        </Badge>
      </div>

      {/* Change list */}
      <ScrollArea className="max-h-[65vh]">
        <div className="space-y-2">
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-12">Laddar ändringshistorik...</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">Inga ändringar hittade</p>
          ) : (
            filtered.map(entry => {
              const srcMeta = SOURCE_META[entry.source] || SOURCE_META.manual;
              const SrcIcon = srcMeta.icon;
              const isExpanded = expandedId === entry.id;
              const typeColor = TYPE_COLORS[entry.change_type] || 'bg-secondary text-muted-foreground border-border';

              return (
                <Card key={entry.id} className="border-border">
                  <CardContent className="pt-3 pb-3">
                    <div
                      className="flex items-start justify-between gap-3 cursor-pointer"
                      onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                    >
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5', srcMeta.color)}>
                          <SrcIcon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm leading-snug line-clamp-2">{entry.description}</p>
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {format(new Date(entry.created_at), 'yyyy-MM-dd HH:mm')}
                            </span>
                            <Badge variant="outline" className={cn('text-[9px]', typeColor)}>
                              {entry.change_type}
                            </Badge>
                            <Badge variant="outline" className={cn('text-[9px]', srcMeta.color)}>
                              {srcMeta.label}
                            </Badge>
                            {entry.bug_report_id && (
                              <Badge variant="outline" className="text-[9px] text-red-600 bg-red-600/10 border-red-200">
                                <Bug className="w-3 h-3 mr-0.5" /> Bugg
                              </Badge>
                            )}
                            {entry.work_item_id && (
                              <Badge variant="outline" className="text-[9px] text-blue-600 bg-blue-600/10 border-blue-200">
                                <Link2 className="w-3 h-3 mr-0.5" /> Uppgift
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" className="shrink-0">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </Button>
                    </div>

                    {isExpanded && (
                      <div className="mt-4 ml-11 space-y-3 border-t border-border pt-3">
                        {/* Affected components */}
                        {entry.affected_components && entry.affected_components.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">Påverkade komponenter</p>
                            <div className="flex flex-wrap gap-1">
                              {entry.affected_components.map((comp: string, i: number) => (
                                <Badge key={i} variant="secondary" className="text-[10px]">
                                  <FileCode className="w-3 h-3 mr-1" />{comp}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Linked bug */}
                        {linkedBugs.length > 0 && (
                          <div className="bg-destructive/5 rounded-lg p-3 space-y-1">
                            <p className="text-xs font-bold flex items-center gap-1">
                              <Bug className="w-3.5 h-3.5 text-destructive" /> Kopplad bugg
                            </p>
                            {linkedBugs.map((bug: any) => (
                              <div key={bug.id} className="text-sm space-y-1">
                                <p className="line-clamp-2">{bug.description}</p>
                                <div className="flex gap-2 text-xs text-muted-foreground">
                                  <Badge variant="outline" className={cn('text-[9px]',
                                    bug.status === 'resolved' ? 'text-green-700 bg-green-100' : 'text-amber-700 bg-amber-100'
                                  )}>
                                    {bug.status === 'resolved' ? <CheckCircle2 className="w-3 h-3 mr-0.5" /> : <AlertTriangle className="w-3 h-3 mr-0.5" />}
                                    {bug.status}
                                  </Badge>
                                  {bug.ai_severity && (
                                    <span>Allvarlighet: {bug.ai_severity}</span>
                                  )}
                                  {bug.ai_category && (
                                    <span>Kategori: {bug.ai_category}</span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Metadata */}
                        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                          <div>
                            <span className="font-medium">Skapad av:</span> {getStaffName(entry.created_by)}
                          </div>
                          {entry.work_item_id && (
                            <div>
                              <span className="font-medium">Uppgift:</span> {entry.work_item_id.slice(0, 8)}...
                            </div>
                          )}
                          {entry.scan_id && (
                            <div>
                              <span className="font-medium">Scan:</span> {entry.scan_id.slice(0, 8)}...
                            </div>
                          )}
                          {entry.prompt_queue_id && (
                            <div>
                              <span className="font-medium">Prompt:</span> {entry.prompt_queue_id.slice(0, 8)}...
                            </div>
                          )}
                        </div>

                        {/* Raw metadata */}
                        {entry.metadata && Object.keys(entry.metadata as object).length > 0 && (
                          <details className="text-xs">
                            <summary className="cursor-pointer text-muted-foreground font-medium">Metadata</summary>
                            <pre className="mt-1 bg-secondary/30 rounded p-2 overflow-auto max-h-32 text-[10px]">
                              {JSON.stringify(entry.metadata, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default AdminChangeHistory;
