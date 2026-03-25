import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Activity, AlertTriangle, Bug, Zap, Search, RefreshCw, Clock, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

const SEVERITY_CONFIG: Record<string, { color: string; icon: typeof Activity }> = {
  debug: { color: 'bg-muted text-muted-foreground', icon: Activity },
  info: { color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300', icon: Activity },
  warning: { color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300', icon: AlertTriangle },
  error: { color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300', icon: Bug },
  critical: { color: 'bg-red-200 text-red-900 dark:bg-red-900/50 dark:text-red-200', icon: Zap },
};

const EVENT_LABELS: Record<string, string> = {
  action: 'Åtgärd',
  error: 'Fel',
  state_change: 'Tillståndsändring',
  api_call: 'API-anrop',
  scan_step: 'Skanningssteg',
  fix_attempt: 'Fixförsök',
};

const AdminObservabilityLog = () => {
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [eventFilter, setEventFilter] = useState<string>('all');

  const { data: logs, isLoading, refetch } = useQuery({
    queryKey: ['observability-logs', severityFilter, eventFilter],
    queryFn: async () => {
      let q = supabase
        .from('system_observability_log' as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (severityFilter !== 'all') q = q.eq('severity', severityFilter);
      if (eventFilter !== 'all') q = q.eq('event_type', eventFilter);

      const { data } = await q;
      return (data || []) as any[];
    },
    refetchInterval: 10000,
  });

  const filtered = (logs || []).filter(l =>
    !search || l.message?.toLowerCase().includes(search.toLowerCase()) ||
    l.component?.toLowerCase().includes(search.toLowerCase()) ||
    l.trace_id?.toLowerCase().includes(search.toLowerCase())
  );

  const traceGroups = new Map<string, number>();
  filtered.forEach(l => {
    if (l.trace_id) traceGroups.set(l.trace_id, (traceGroups.get(l.trace_id) || 0) + 1);
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Sök meddelande, komponent, trace..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Allvarlighet" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alla</SelectItem>
            <SelectItem value="debug">Debug</SelectItem>
            <SelectItem value="info">Info</SelectItem>
            <SelectItem value="warning">Varning</SelectItem>
            <SelectItem value="error">Fel</SelectItem>
            <SelectItem value="critical">Kritisk</SelectItem>
          </SelectContent>
        </Select>
        <Select value={eventFilter} onValueChange={setEventFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Händelsetyp" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alla</SelectItem>
            <SelectItem value="action">Åtgärd</SelectItem>
            <SelectItem value="error">Fel</SelectItem>
            <SelectItem value="state_change">Tillstånd</SelectItem>
            <SelectItem value="api_call">API</SelectItem>
            <SelectItem value="scan_step">Skanning</SelectItem>
            <SelectItem value="fix_attempt">Fix</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Stats row */}
      <div className="flex gap-3 text-xs text-muted-foreground">
        <span>{filtered.length} händelser</span>
        <span>•</span>
        <span>{traceGroups.size} traces</span>
        <span>•</span>
        <span>{filtered.filter(l => l.severity === 'error' || l.severity === 'critical').length} fel</span>
      </div>

      <ScrollArea className="h-[60vh]">
        <div className="space-y-1.5">
          {isLoading && <p className="text-sm text-muted-foreground p-4">Laddar...</p>}
          {!isLoading && filtered.length === 0 && <p className="text-sm text-muted-foreground p-4">Inga loggar hittade.</p>}
          {filtered.map((log: any) => {
            const sev = SEVERITY_CONFIG[log.severity] || SEVERITY_CONFIG.info;
            const SevIcon = sev.icon;
            return (
              <Card key={log.id} className="border-border/50">
                <CardContent className="p-3">
                  <div className="flex items-start gap-2">
                    <SevIcon className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', sev.color)}>
                          {log.severity}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          {EVENT_LABELS[log.event_type] || log.event_type}
                        </Badge>
                        {log.source && log.source !== 'client' && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {log.source}
                          </Badge>
                        )}
                        {log.duration_ms != null && (
                          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                            <Clock className="h-3 w-3" /> {log.duration_ms}ms
                          </span>
                        )}
                      </div>
                      <p className="text-sm leading-tight">{log.message}</p>
                      <div className="flex items-center gap-2 flex-wrap text-[10px] text-muted-foreground">
                        {log.component && <span className="font-mono">📦 {log.component}</span>}
                        {log.endpoint && <span className="font-mono">🔗 {log.endpoint}</span>}
                        {log.trace_id && (
                          <span className="font-mono flex items-center gap-0.5">
                            <Layers className="h-3 w-3" /> {log.trace_id}
                            {traceGroups.get(log.trace_id)! > 1 && (
                              <span className="bg-muted rounded px-1">×{traceGroups.get(log.trace_id)}</span>
                            )}
                          </span>
                        )}
                        {log.scan_id && <span>🔍 scan:{log.scan_id.slice(0, 8)}</span>}
                        {log.bug_id && <span>🐛 bug:{log.bug_id.slice(0, 8)}</span>}
                        {log.work_item_id && <span>📋 wi:{log.work_item_id.slice(0, 8)}</span>}
                        <span className="ml-auto">{format(new Date(log.created_at), 'HH:mm:ss')}</span>
                      </div>
                      {log.error_code && (
                        <p className="text-[10px] font-mono text-destructive">{log.error_code}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
};

export default AdminObservabilityLog;
