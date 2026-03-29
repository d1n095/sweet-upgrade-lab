import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import {
  Search, Eye, Bot, CheckCircle2, AlertTriangle, Clock, FileCode,
  ChevronDown, ChevronUp, Bug, Link2, Radar, FolderOpen, Globe,
  ThumbsUp, ThumbsDown, Sparkles, ShieldCheck, XCircle, MessageSquare,
} from 'lucide-react';
import { format, subDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const RESULT_META: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  no_issues: { label: 'Inga problem', color: 'text-green-600 bg-green-600/10', icon: CheckCircle2 },
  possible_issue: { label: 'Möjligt problem', color: 'text-amber-600 bg-amber-600/10', icon: AlertTriangle },
  inspected: { label: 'Inspekterad', color: 'text-blue-600 bg-blue-600/10', icon: Eye },
  verified_working: { label: 'Verifierad OK', color: 'text-green-600 bg-green-600/10', icon: CheckCircle2 },
};

const VERIFY_META: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  confirmed: { label: 'Bekräftad fixad', color: 'text-green-600 bg-green-600/10', icon: ShieldCheck },
  rejected: { label: 'Ej fixad', color: 'text-destructive bg-destructive/10', icon: XCircle },
};

const ACTION_LABELS: Record<string, string> = {
  scan: 'Skanning',
  analyze: 'Analys',
  deep_analysis: 'Djupanalys',
  snapshot: 'Systemöversikt',
  chat: 'Chatt',
  review: 'Granskning',
};

const AdminAiReadLog = () => {
  const [search, setSearch] = useState('');
  const [resultFilter, setResultFilter] = useState('all');
  const [dateRange, setDateRange] = useState('7');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [verifyNote, setVerifyNote] = useState('');
  const queryClient = useQueryClient();

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['ai-read-log', resultFilter, dateRange],
    queryFn: async () => {
      let query = supabase
        .from('ai_read_log' as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (resultFilter !== 'all') query = query.eq('result', resultFilter);
      if (dateRange !== 'all') {
        query = query.gte('created_at', subDays(new Date(), Number(dateRange)).toISOString());
      }

      const { data } = await query;
      return (data || []) as any[];
    },
    refetchInterval: 30000,
  });

  const verifyMutation = useMutation({
    mutationFn: async ({ id, status, note }: { id: string; status: 'confirmed' | 'rejected'; note?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await (supabase.from('ai_read_log' as any) as any)
        .update({
          verify_status: status,
          verify_note: note || null,
          verified_by: user?.id,
          verified_at: new Date().toISOString(),
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['ai-read-log'] });
      toast.success(vars.status === 'confirmed' ? 'Bekräftad som fixad ✓' : 'Markerad som ej fixad');
      setVerifyNote('');
    },
    onError: () => toast.error('Kunde inte uppdatera verifieringsstatus'),
  });

  const filtered = logs.filter((l: any) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return l.summary?.toLowerCase().includes(s) ||
      l.target_type?.toLowerCase().includes(s) ||
      l.affected_components?.some((c: string) => c.toLowerCase().includes(s)) ||
      l.file_paths?.some((f: string) => f.toLowerCase().includes(s));
  });

  // Stats
  const totalChecks = filtered.length;
  const issueCount = filtered.filter((l: any) => l.result === 'possible_issue').length;
  const suggestFixed = filtered.filter((l: any) => l.ai_suggestion && !l.verify_status).length;
  const verifiedCount = filtered.filter((l: any) => l.verify_status === 'confirmed').length;

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          { label: 'Inspektioner', value: totalChecks, icon: Eye, color: 'text-blue-600' },
          { label: 'Möjliga problem', value: issueCount, icon: AlertTriangle, color: 'text-amber-600' },
          { label: 'Föreslår fixad', value: suggestFixed, icon: Sparkles, color: 'text-primary' },
          { label: 'Verifierade', value: verifiedCount, icon: ShieldCheck, color: 'text-green-600' },
        ].map(s => (
          <Card key={s.label} className="border-border">
            <CardContent className="py-2 px-3 flex items-center gap-2">
              <s.icon className={cn('w-4 h-4', s.color)} />
              <div>
                <p className="text-sm font-bold">{s.value}</p>
                <p className="text-[10px] text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-end">
        <div className="relative flex-1 min-w-[180px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Sök filer, komponenter..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <Select value={resultFilter} onValueChange={setResultFilter}>
          <SelectTrigger className="w-36 h-9"><SelectValue placeholder="Resultat" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alla resultat</SelectItem>
            <SelectItem value="no_issues">Inga problem</SelectItem>
            <SelectItem value="possible_issue">Möjligt problem</SelectItem>
            <SelectItem value="inspected">Inspekterad</SelectItem>
            <SelectItem value="verified_working">Verifierad OK</SelectItem>
          </SelectContent>
        </Select>
        <Select value={dateRange} onValueChange={setDateRange}>
          <SelectTrigger className="w-28 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="1">Idag</SelectItem>
            <SelectItem value="7">7 dagar</SelectItem>
            <SelectItem value="30">30 dagar</SelectItem>
            <SelectItem value="all">Alla</SelectItem>
          </SelectContent>
        </Select>
        <Badge variant="secondary" className="h-9 px-3 flex items-center">
          {filtered.length} poster
        </Badge>
      </div>

      {/* Log list */}
      <ScrollArea className="max-h-[58vh]">
        <div className="space-y-1.5">
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-8">Laddar AI-logg...</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Inga AI-inspektioner loggade</p>
          ) : (
            filtered.map((log: any) => {
              const resMeta = RESULT_META[log.result] || RESULT_META.inspected;
              const ResIcon = resMeta.icon;
              const isExpanded = expandedId === log.id;
              const hasTrace = log.file_paths?.length > 0 || log.endpoints?.length > 0 || log.affected_components?.length > 0;
              const hasLinks = log.linked_bug_id || log.linked_work_item_id || log.linked_scan_id;
              const hasSuggestion = !!log.ai_suggestion;
              const verifyMeta = log.verify_status ? VERIFY_META[log.verify_status] : null;

              return (
                <Card key={log.id} className={cn(
                  'border-border',
                  hasSuggestion && !log.verify_status && 'border-primary/30 bg-primary/[0.02]',
                )}>
                  <CardContent className="py-2.5 px-4">
                    <div
                      className="flex items-center gap-3 cursor-pointer"
                      onClick={() => setExpandedId(isExpanded ? null : log.id)}
                    >
                      <div className={cn('w-7 h-7 rounded-md flex items-center justify-center shrink-0', resMeta.color)}>
                        <ResIcon className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm leading-snug line-clamp-1">{log.summary || `${ACTION_LABELS[log.action_type] || log.action_type}: ${log.target_type}`}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                            <Clock className="w-3 h-3" />
                            {format(new Date(log.created_at), 'MM-dd HH:mm')}
                          </span>
                          <Badge variant="outline" className="text-[9px] py-0">
                            <Bot className="w-3 h-3 mr-0.5" />{ACTION_LABELS[log.action_type] || log.action_type}
                          </Badge>
                          <Badge variant="outline" className={cn('text-[9px] py-0', resMeta.color)}>
                            {resMeta.label}
                          </Badge>
                          {hasSuggestion && !log.verify_status && (
                            <Badge variant="secondary" className="text-[9px] py-0 text-primary bg-primary/10 animate-pulse">
                              <Sparkles className="w-3 h-3 mr-0.5" />Föreslår fixad
                            </Badge>
                          )}
                          {verifyMeta && (
                            <Badge variant="secondary" className={cn('text-[9px] py-0', verifyMeta.color)}>
                              <verifyMeta.icon className="w-3 h-3 mr-0.5" />{verifyMeta.label}
                            </Badge>
                          )}
                          {hasTrace && (
                            <Badge variant="secondary" className="text-[9px] py-0">
                              <FileCode className="w-3 h-3 mr-0.5" />{(log.file_paths?.length || 0) + (log.affected_components?.length || 0)} spår
                            </Badge>
                          )}
                          {hasLinks && (
                            <Badge variant="outline" className="text-[9px] py-0 text-purple-600 bg-purple-600/5">
                              <Link2 className="w-3 h-3 mr-0.5" />Länkad
                            </Badge>
                          )}
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" className="shrink-0 h-7 w-7 p-0">
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </Button>
                    </div>

                    {isExpanded && (
                      <div className="mt-3 ml-10 space-y-3 border-t border-border pt-3">
                        {/* AI Suggestion */}
                        {hasSuggestion && (
                          <div className={cn(
                            'rounded-lg p-3 space-y-2',
                            log.verify_status === 'confirmed' ? 'bg-green-500/5 border border-green-500/20' :
                            log.verify_status === 'rejected' ? 'bg-destructive/5 border border-destructive/20' :
                            'bg-primary/5 border border-primary/20'
                          )}>
                            <div className="flex items-start gap-2">
                              <Sparkles className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                              <div className="flex-1">
                                <p className="text-xs font-semibold mb-1">AI-förslag</p>
                                <p className="text-xs text-foreground">{log.ai_suggestion}</p>
                              </div>
                            </div>

                            {log.verify_status ? (
                              <div className="flex items-center gap-2 pt-1">
                                {verifyMeta && <verifyMeta.icon className={cn('w-4 h-4', verifyMeta.color.split(' ')[0])} />}
                                <span className="text-xs font-medium">{verifyMeta?.label}</span>
                                {log.verified_at && (
                                  <span className="text-[10px] text-muted-foreground">
                                    {format(new Date(log.verified_at), 'yyyy-MM-dd HH:mm')}
                                  </span>
                                )}
                                {log.verify_note && (
                                  <span className="text-xs text-muted-foreground ml-2 flex items-center gap-1">
                                    <MessageSquare className="w-3 h-3" /> {log.verify_note}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <div className="space-y-2 pt-1">
                                <Textarea
                                  placeholder="Valfri kommentar..."
                                  value={expandedId === log.id ? verifyNote : ''}
                                  onChange={e => setVerifyNote(e.target.value)}
                                  className="h-16 text-xs"
                                />
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    className="gap-1.5 text-xs h-8 bg-green-600 hover:bg-green-700"
                                    disabled={verifyMutation.isPending}
                                    onClick={() => verifyMutation.mutate({ id: log.id, status: 'confirmed', note: verifyNote })}
                                  >
                                    <ThumbsUp className="w-3.5 h-3.5" /> Bekräfta fixad
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="gap-1.5 text-xs h-8 text-destructive border-destructive/30 hover:bg-destructive/10"
                                    disabled={verifyMutation.isPending}
                                    onClick={() => verifyMutation.mutate({ id: log.id, status: 'rejected', note: verifyNote })}
                                  >
                                    <ThumbsDown className="w-3.5 h-3.5" /> Ej fixad
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Checked files */}
                        {log.file_paths?.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                              <FolderOpen className="w-3 h-3" /> Kontrollerade filer
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {log.file_paths.map((f: string, i: number) => (
                                <Badge key={i} variant="secondary" className="text-[10px] font-mono">
                                  {f}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Checked components */}
                        {log.affected_components?.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                              <FileCode className="w-3 h-3" /> Kontrollerade komponenter
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {log.affected_components.map((c: string, i: number) => (
                                <Badge key={i} variant="outline" className="text-[10px]">
                                  {c}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Checked endpoints */}
                        {log.endpoints?.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                              <Globe className="w-3 h-3" /> Kontrollerade endpoints/tabeller
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {log.endpoints.map((e: string, i: number) => (
                                <Badge key={i} variant="secondary" className="text-[10px] font-mono">
                                  {e}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* AI checked timestamp */}
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground pt-1 border-t border-border/50">
                          <Bot className="w-3 h-3" />
                          <span>AI kontrollerade detta</span>
                          <Clock className="w-3 h-3 ml-1" />
                          <span>{format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss')}</span>
                          {log.triggered_by && (
                            <>
                              <span className="mx-1">·</span>
                              <span>Utlöst av: {log.triggered_by.slice(0, 8)}…</span>
                            </>
                          )}
                        </div>

                        {/* Links */}
                        {hasLinks && (
                          <div className="bg-secondary/30 rounded-lg p-2.5 space-y-1">
                            <p className="text-xs font-bold flex items-center gap-1">
                              <Link2 className="w-3 h-3" /> Kopplingar
                            </p>
                            <div className="flex flex-wrap gap-2 text-xs">
                              {log.linked_bug_id && (
                                <Badge variant="outline" className="text-[10px] gap-1">
                                  <Bug className="w-3 h-3 text-destructive" />
                                  Bugg: {log.linked_bug_id.substring(0, 8)}...
                                </Badge>
                              )}
                              {log.linked_work_item_id && (
                                <Badge variant="outline" className="text-[10px] gap-1">
                                  <FileCode className="w-3 h-3 text-blue-600" />
                                  Uppgift: {log.linked_work_item_id.substring(0, 8)}...
                                </Badge>
                              )}
                              {log.linked_scan_id && (
                                <Badge variant="outline" className="text-[10px] gap-1">
                                  <Radar className="w-3 h-3 text-primary" />
                                  Scan: {log.linked_scan_id.substring(0, 8)}...
                                </Badge>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Target IDs */}
                        {log.target_ids?.length > 0 && (
                          <div className="text-xs text-muted-foreground">
                            <span className="font-medium">Target IDs:</span> {log.target_ids.map((id: string) => id.substring(0, 8)).join(', ')}
                          </div>
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

export default AdminAiReadLog;
