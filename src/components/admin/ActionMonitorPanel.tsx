/**
 * ActionMonitorPanel
 *
 * Visualization for ActionMonitor data, displayed in /debug/dashboard.
 * Shows:
 *   - Current monitor status (running / stopped)
 *   - Enable / disable toggle
 *   - Last successful data point timestamp
 *   - Failure count + failure log (mirrors /debug/logs/actionmonitor.log)
 *   - Recent collected data entries
 */
import { useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, Clock, RefreshCw, Trash2, Play, Square, ChevronDown, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
  useActionMonitorStore,
  startMonitor,
  stopMonitor,
  logData,
  type MonitorEntry,
  type MonitorEntryType,
} from '@/utils/actionMonitor';

// ── Helpers ──

const TYPE_LABELS: Record<MonitorEntryType, string> = {
  scan_step: 'Scan Step',
  scan_complete: 'Scan Complete',
  scan_error: 'Scan Error',
  test_result: 'Test Result',
  endpoint_call: 'Endpoint Call',
  manual: 'Manual',
};

const typeVariant = (type: MonitorEntryType): 'default' | 'destructive' | 'secondary' | 'outline' => {
  if (type === 'scan_error') return 'destructive';
  if (type === 'scan_complete') return 'default';
  if (type === 'test_result') return 'secondary';
  return 'outline';
};

function formatTs(ts: number): string {
  return new Date(ts).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// ── Status badge ──

const StatusBadge = ({ enabled }: { enabled: boolean }) => (
  <Badge variant={enabled ? 'default' : 'outline'} className={cn('gap-1', enabled ? 'bg-green-600 hover:bg-green-600' : '')}>
    <span className={cn('w-1.5 h-1.5 rounded-full', enabled ? 'bg-white animate-pulse' : 'bg-muted-foreground')} />
    {enabled ? 'Running' : 'Stopped'}
  </Badge>
);

// ── Entry row ──

const EntryRow = ({ entry }: { entry: MonitorEntry }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className={cn('text-[11px] border rounded p-2 space-y-1', entry.ok ? 'bg-muted/10' : 'bg-destructive/5 border-destructive/30')}>
      <div className="flex items-center gap-2">
        <button onClick={() => setOpen(o => !o)} className="shrink-0">
          {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        </button>
        <Badge variant={typeVariant(entry.type)} className="text-[9px] shrink-0">{TYPE_LABELS[entry.type]}</Badge>
        {entry.endpoint && <span className="font-mono text-muted-foreground truncate">{entry.endpoint}</span>}
        <span className="ml-auto text-muted-foreground shrink-0">{formatTs(entry.timestamp)}</span>
        {!entry.ok && <AlertTriangle className="w-3 h-3 text-destructive shrink-0" />}
        {entry.ok && <CheckCircle2 className="w-3 h-3 text-green-600 shrink-0" />}
      </div>
      {entry.page && <div className="pl-5 text-muted-foreground">Page: <span className="text-foreground">{entry.page}</span></div>}
      {!entry.ok && entry.error && <div className="pl-5 text-destructive">{entry.error} (attempts: {entry.attempts})</div>}
      {open && entry.data && (
        <pre className="pl-5 text-[9px] font-mono bg-muted/30 rounded p-1 overflow-x-auto max-h-24 whitespace-pre-wrap break-all">
          {JSON.stringify(entry.data, null, 2)}
        </pre>
      )}
    </div>
  );
};

// ── Main panel ──

const ActionMonitorPanel = () => {
  const {
    enabled,
    entries,
    failureLog,
    lastSuccessAt,
    failureCount,
    clearEntries,
    clearFailureLog,
  } = useActionMonitorStore();

  const [tab, setTab] = useState<'entries' | 'failures'>('entries');
  const [testLoading, setTestLoading] = useState(false);

  const handleToggle = () => {
    if (enabled) stopMonitor();
    else startMonitor();
  };

  const handleTestLog = async () => {
    setTestLoading(true);
    await logData({
      type: 'manual',
      page: 'ActionMonitorPanel',
      endpoint: 'manual-test',
      data: { message: 'Manual test entry', ts: Date.now() },
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
          </h3>
          <p className="text-xs text-muted-foreground">
            Samlar in data från skanningar, tester och endpoints i realtid
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge enabled={enabled} />
          <Button size="sm" variant="outline" className="gap-1 h-7 text-xs" onClick={handleToggle}>
            {enabled ? <Square className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            {enabled ? 'Stop' : 'Start'}
          </Button>
        </div>
      </div>

      {/* Status cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-border">
          <CardContent className="py-3 px-4">
            <div className="text-[10px] text-muted-foreground mb-1">Datapunkter</div>
            <div className="text-lg font-bold tabular-nums">{entries.length}</div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="py-3 px-4">
            <div className="text-[10px] text-muted-foreground mb-1 flex items-center gap-1"><AlertTriangle className="w-2.5 h-2.5" /> Misslyckanden</div>
            <div className={cn('text-lg font-bold tabular-nums', failureCount > 0 ? 'text-destructive' : '')}>{failureCount}</div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="py-3 px-4">
            <div className="text-[10px] text-muted-foreground mb-1 flex items-center gap-1"><Clock className="w-2.5 h-2.5" /> Senast lyckad</div>
            <div className="text-xs font-mono tabular-nums">
              {lastSuccessAt ? formatTs(lastSuccessAt) : <span className="text-muted-foreground italic">—</span>}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border pb-1">
        {(['entries', 'failures'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'text-xs px-3 py-1 rounded-t transition-colors',
              tab === t ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t === 'entries' ? `Data (${entries.length})` : `Misslyckanden (${failureLog.length})`}
          </button>
        ))}

        {/* Actions */}
        <div className="ml-auto flex gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-6 text-[10px] gap-1"
            onClick={handleTestLog}
            disabled={testLoading || !enabled}
          >
            {testLoading ? <RefreshCw className="w-2.5 h-2.5 animate-spin" /> : <Activity className="w-2.5 h-2.5" />}
            Test
          </Button>
          {tab === 'entries' && entries.length > 0 && (
            <Button size="sm" variant="ghost" className="h-6 text-[10px] gap-1 text-destructive hover:text-destructive" onClick={clearEntries}>
              <Trash2 className="w-2.5 h-2.5" /> Rensa
            </Button>
          )}
          {tab === 'failures' && failureLog.length > 0 && (
            <Button size="sm" variant="ghost" className="h-6 text-[10px] gap-1 text-destructive hover:text-destructive" onClick={clearFailureLog}>
              <Trash2 className="w-2.5 h-2.5" /> Rensa
            </Button>
          )}
        </div>
      </div>

      {/* Entry list */}
      <ScrollArea className="max-h-[420px]">
        {tab === 'entries' && (
          <div className="space-y-1">
            {entries.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-8 italic">
                Inga datapunkter ännu — starta en skanning eller klicka Test
              </p>
            )}
            {[...entries].reverse().map(e => <EntryRow key={e.id} entry={e} />)}
          </div>
        )}
        {tab === 'failures' && (
          <div className="space-y-1">
            {failureLog.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-8 italic">
                Inga misslyckanden loggade (/debug/logs/actionmonitor.log)
              </p>
            )}
            {[...failureLog].reverse().map(e => <EntryRow key={e.id} entry={e} />)}
          </div>
        )}
      </ScrollArea>
    </div>
  );
};

export default ActionMonitorPanel;
