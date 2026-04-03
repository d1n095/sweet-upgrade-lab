/**
 * ActionMonitorPanel
 *
 * Visualization for ActionMonitor data, displayed in /debug/dashboard.
 * Shows:
 *   - Current monitor status (OK / DEGRADED / FAILED)
 *   - Last successful event timestamp
 *   - Failures (mirrors /debug/logs/actionmonitor.log)
 *   - Recent event stream
 */
import { useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, Clock, RefreshCw, Trash2, Play, ChevronDown, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
  useActionMonitorStore,
  startMonitor,
  logData,
  getStatus,
  type MonitorEvent,
  type MonitorEventType,
} from '@/utils/actionMonitor';

// ── Helpers ──

const TYPE_LABELS: Record<MonitorEventType, string> = {
  scan: 'Scan',
  test: 'Test',
  action: 'Action',
  error: 'Error',
};

const typeVariant = (type: MonitorEventType): 'default' | 'destructive' | 'secondary' | 'outline' => {
  if (type === 'error') return 'destructive';
  if (type === 'scan') return 'default';
  if (type === 'test') return 'secondary';
  return 'outline';
};

function formatTs(ts: number): string {
  return new Date(ts).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// ── Status badge ──

const StatusBadge = ({ running }: { running: boolean }) => (
  <Badge variant={running ? 'default' : 'outline'} className={cn('gap-1', running ? 'bg-green-600 hover:bg-green-600' : '')}>
    <span className={cn('w-1.5 h-1.5 rounded-full', running ? 'bg-white animate-pulse' : 'bg-muted-foreground')} />
    {running ? 'Running' : 'Stopped'}
  </Badge>
);

// ── Event row ──

const EventRow = ({ event }: { event: MonitorEvent }) => {
  const [open, setOpen] = useState(false);
  const hasFailed = event.status === 'failed';
  return (
    <div className={cn('text-[11px] border rounded p-2 space-y-1', hasFailed ? 'bg-destructive/5 border-destructive/30' : 'bg-muted/10')}>
      <div className="flex items-center gap-2">
        <button onClick={() => setOpen(o => !o)} className="shrink-0">
          {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        </button>
        <Badge variant={typeVariant(event.type)} className="text-[9px] shrink-0">{TYPE_LABELS[event.type]}</Badge>
        <span className="font-mono text-muted-foreground truncate text-[10px]">{event.source}</span>
        {event.status && (
          <span className={cn('text-[10px] shrink-0', event.status === 'success' ? 'text-green-600' : 'text-destructive')}>{event.status}</span>
        )}
        <span className="ml-auto text-muted-foreground shrink-0">{formatTs(event.timestamp)}</span>
        {hasFailed ? <AlertTriangle className="w-3 h-3 text-destructive shrink-0" /> : <CheckCircle2 className="w-3 h-3 text-green-600 shrink-0" />}
      </div>
      {hasFailed && event.error && <div className="pl-5 text-destructive">{event.error} (attempts: {event.attempts})</div>}
      {open && event.payload !== undefined && (
        <pre className="pl-5 text-[9px] font-mono bg-muted/30 rounded p-1 overflow-x-auto max-h-24 whitespace-pre-wrap break-all">
          {JSON.stringify(event.payload, null, 2)}
        </pre>
      )}
    </div>
  );
};

// ── Main panel ──

const ActionMonitorPanel = () => {
  const {
    events,
    failures,
    lastSuccessTimestamp,
    running,
    clearEvents,
    clearFailures,
  } = useActionMonitorStore();

  const status = getStatus();
  const statusColor = status === 'OK' ? 'text-green-600' : status === 'DEGRADED' ? 'text-yellow-600' : 'text-red-600';

  const [tab, setTab] = useState<'events' | 'failures'>('events');
  const [testLoading, setTestLoading] = useState(false);

  const handleTestLog = async () => {
    setTestLoading(true);
    await logData({
      type: 'action',
      source: 'ui',
      payload: { message: 'Manual test event', ts: Date.now() },
      status: 'success',
    });
    setTestLoading(false);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Activity className="w-4 h-4" /> Action Monitor
            <span className={cn('text-xs font-bold', statusColor)}>{status}</span>
          </h3>
          <p className="text-xs text-muted-foreground">
            Centraliserat händelseflöde — skanningar, tester, actions och fel
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge running={running} />
          {!running && (
            <Button size="sm" variant="outline" className="gap-1 h-7 text-xs" onClick={startMonitor}>
              <Play className="w-3 h-3" /> Start
            </Button>
          )}
        </div>
      </div>

      {/* Status cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-border">
          <CardContent className="py-3 px-4">
            <div className="text-[10px] text-muted-foreground mb-1">Händelser</div>
            <div className="text-lg font-bold tabular-nums">{events.length}</div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="py-3 px-4">
            <div className="text-[10px] text-muted-foreground mb-1 flex items-center gap-1"><AlertTriangle className="w-2.5 h-2.5" /> Misslyckanden</div>
            <div className={cn('text-lg font-bold tabular-nums', failures.length > 0 ? 'text-destructive' : '')}>{failures.length}</div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="py-3 px-4">
            <div className="text-[10px] text-muted-foreground mb-1 flex items-center gap-1"><Clock className="w-2.5 h-2.5" /> Senast lyckad</div>
            <div className="text-xs font-mono tabular-nums">
              {lastSuccessTimestamp ? formatTs(lastSuccessTimestamp) : <span className="text-muted-foreground italic">—</span>}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border pb-1">
        {(['events', 'failures'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'text-xs px-3 py-1 rounded-t transition-colors',
              tab === t ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t === 'events' ? `Händelser (${events.length})` : `Misslyckanden (${failures.length})`}
          </button>
        ))}

        {/* Actions */}
        <div className="ml-auto flex gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-6 text-[10px] gap-1"
            onClick={handleTestLog}
            disabled={testLoading}
          >
            {testLoading ? <RefreshCw className="w-2.5 h-2.5 animate-spin" /> : <Activity className="w-2.5 h-2.5" />}
            Test
          </Button>
          {tab === 'events' && events.length > 0 && (
            <Button size="sm" variant="ghost" className="h-6 text-[10px] gap-1 text-destructive hover:text-destructive" onClick={clearEvents}>
              <Trash2 className="w-2.5 h-2.5" /> Rensa
            </Button>
          )}
          {tab === 'failures' && failures.length > 0 && (
            <Button size="sm" variant="ghost" className="h-6 text-[10px] gap-1 text-destructive hover:text-destructive" onClick={clearFailures}>
              <Trash2 className="w-2.5 h-2.5" /> Rensa
            </Button>
          )}
        </div>
      </div>

      {/* Event list */}
      <ScrollArea className="max-h-[420px]">
        {tab === 'events' && (
          <div className="space-y-1">
            {events.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-8 italic">
                Inga händelser ännu — starta en skanning eller klicka Test
              </p>
            )}
            {[...events].reverse().map(e => <EventRow key={e.id} event={e} />)}
          </div>
        )}
        {tab === 'failures' && (
          <div className="space-y-1">
            {failures.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-8 italic">
                Inga misslyckanden loggade (/debug/logs/actionmonitor.log)
              </p>
            )}
            {[...failures].reverse().map(e => <EventRow key={e.id} event={e} />)}
          </div>
        )}
      </ScrollArea>
    </div>
  );
};

export default ActionMonitorPanel;
