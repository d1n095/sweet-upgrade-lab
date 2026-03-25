import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Eye, Bot, CheckCircle2, AlertTriangle, Clock, FileCode } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { cn } from '@/lib/utils';

const RESULT_META: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  no_issues: { label: 'Inga problem', color: 'text-green-600 bg-green-600/10', icon: CheckCircle2 },
  possible_issue: { label: 'Möjligt problem', color: 'text-amber-600 bg-amber-600/10', icon: AlertTriangle },
  inspected: { label: 'Inspekterad', color: 'text-blue-600 bg-blue-600/10', icon: Eye },
  verified_working: { label: 'Verifierad OK', color: 'text-green-600 bg-green-600/10', icon: CheckCircle2 },
};

const ACTION_LABELS: Record<string, string> = {
  scan: 'Skanning',
  analyze: 'Analys',
  deep_analysis: 'Djupanalys',
  snapshot: 'Systemöversikt',
  chat: 'Lova-chatt',
  review: 'Granskning',
};

const AdminAiReadLog = () => {
  const [search, setSearch] = useState('');
  const [resultFilter, setResultFilter] = useState('all');
  const [dateRange, setDateRange] = useState('7');

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

  const filtered = logs.filter((l: any) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return l.summary?.toLowerCase().includes(s) ||
      l.target_type?.toLowerCase().includes(s) ||
      l.affected_components?.some((c: string) => c.toLowerCase().includes(s));
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-3 flex-wrap items-end">
        <div className="relative flex-1 min-w-[180px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Sök AI-logg..."
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

      <ScrollArea className="max-h-[60vh]">
        <div className="space-y-1.5">
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-8">Laddar AI-logg...</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Inga AI-läsningar loggade</p>
          ) : (
            filtered.map((log: any) => {
              const resMeta = RESULT_META[log.result] || RESULT_META.inspected;
              const ResIcon = resMeta.icon;

              return (
                <Card key={log.id} className="border-border">
                  <CardContent className="py-2.5 px-4">
                    <div className="flex items-center gap-3">
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
                          {log.affected_components?.slice(0, 3).map((comp: string, i: number) => (
                            <Badge key={i} variant="secondary" className="text-[9px] py-0">
                              <FileCode className="w-3 h-3 mr-0.5" />{comp}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
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
