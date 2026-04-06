import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Activity, AlertTriangle, Bug, CheckCircle2,
  Clock, Code2, Download, Loader2, RefreshCw,
  Shield, Terminal,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDebugLoggerStore, LogLevel } from '@/debug/logger/debugLogger';
import { safeInvoke } from '@/lib/safeInvoke';
import { supabase } from '@/integrations/supabase/client';
import { SYSTEM_FLAGS } from '@/config/systemFlags';

// ─────────────────────────────────────────────
// Scan History Tab — reads from scan_runs table
// ─────────────────────────────────────────────
const ScanHistoryTab = () => {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRuns = async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('scan_runs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);
    if (err) setError(err.message);
    else setRows(data ?? []);
    setLoading(false);
  };

  const triggerScan = async () => {
    setScanning(true);
    const { error: err } = await safeInvoke('run-full-scan', {
      body: { action: 'start', scan_type: 'full' },
      isAdmin: true,
    });
    if (err) setError(err.message || 'Scan failed');
    else await loadRuns();
    setScanning(false);
  };

  useEffect(() => { loadRuns(); }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Button onClick={triggerScan} disabled={scanning} size="sm" className="gap-2">
          {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
          {scanning ? 'Running…' : 'Run Full Scan'}
        </Button>
        <Button onClick={loadRuns} variant="outline" size="sm" className="gap-2" disabled={loading}>
          <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {error && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="pt-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {rows.length === 0 && !loading && (
        <p className="text-sm text-muted-foreground">No scan runs found. Run a scan to populate this view.</p>
      )}

      {rows.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <ScrollArea className="h-64">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">ID</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Type</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Status</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Started</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.id} className="border-b border-border/50">
                      <td className="px-4 py-2 font-mono text-muted-foreground truncate max-w-[120px]">{r.id}</td>
                      <td className="px-4 py-2">{r.scan_type ?? '—'}</td>
                      <td className="px-4 py-2">
                        {r.status === 'done' || r.status === 'completed'
                          ? <span className="text-green-500 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />{r.status}</span>
                          : r.status === 'error'
                            ? <span className="text-destructive flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{r.status}</span>
                            : <span className="text-muted-foreground">{r.status ?? '—'}</span>}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {r.created_at ? new Date(r.created_at).toLocaleString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────
// API Log Tab — reads from safeInvoke call log
// ─────────────────────────────────────────────
const ApiLogTab = () => {
  const [entries, setEntries] = useState<any[]>([]);

  const refresh = async () => {
    // Trigger a lightweight call so the log is populated, then expose via getApiLog if available
    const { getApiLog } = await import('@/lib/safeInvoke').catch(() => ({ getApiLog: undefined }));
    if (typeof (getApiLog as any) === 'function') {
      setEntries((getApiLog as any)());
    }
  };

  useEffect(() => { refresh(); }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button onClick={refresh} variant="outline" size="sm" className="gap-2">
          <RefreshCw className="w-4 h-4" /> Refresh
        </Button>
        <span className="text-xs text-muted-foreground">{entries.length} entries (last 50 edge-function calls)</span>
      </div>

      {entries.length === 0 && (
        <p className="text-sm text-muted-foreground">No API calls recorded yet in this session.</p>
      )}

      {entries.length > 0 && (
        <ScrollArea className="h-72 font-mono text-xs border border-border rounded-lg bg-black/5 dark:bg-white/5">
          <div className="p-3 space-y-1">
            {[...entries].reverse().map((e: any, i) => (
              <div key={i} className="flex gap-2">
                <span className="text-muted-foreground shrink-0">
                  {e.timestamp ? new Date(e.timestamp).toLocaleTimeString() : '—'}
                </span>
                <span className={cn('uppercase shrink-0 w-14', e.error ? 'text-destructive' : 'text-green-500')}>
                  {e.error ? 'ERR' : 'OK'}
                </span>
                <span className="flex-1 truncate">{e.functionName ?? JSON.stringify(e)}</span>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────
// Debug Logger Tab
// ─────────────────────────────────────────────
const LEVEL_ORDER: LogLevel[] = ['debug', 'info', 'warn', 'error', 'critical'];

const DebugLoggerTab = () => {
  const { enabled, entries, silentFailures, toggle, clear, exportLog } = useDebugLoggerStore();
  const [levelFilter, setLevelFilter] = useState<LogLevel | 'all'>('all');
  const [search, setSearch] = useState('');

  const filtered = entries.filter(e => {
    if (levelFilter !== 'all' && e.level !== levelFilter) return false;
    if (search && !e.message.toLowerCase().includes(search.toLowerCase()) && !e.file.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const levelColor: Record<LogLevel, string> = {
    debug: 'text-muted-foreground',
    info: 'text-blue-400',
    warn: 'text-yellow-500',
    error: 'text-destructive',
    critical: 'text-red-600 font-bold',
  };

  const downloadLog = () => {
    const blob = new Blob([exportLog()], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `debug-log-${Date.now()}.txt`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Button onClick={toggle} size="sm" variant={enabled ? 'default' : 'outline'} className="gap-2">
          <Terminal className="w-4 h-4" />{enabled ? 'DEBUG ON' : 'Enable Debug'}
        </Button>
        {entries.length > 0 && (
          <>
            <Button onClick={clear} variant="outline" size="sm">Clear</Button>
            <Button onClick={downloadLog} variant="outline" size="sm" className="gap-2"><Download className="w-4 h-4" />Export</Button>
          </>
        )}
        {silentFailures.length > 0 && (
          <Badge variant="destructive" className="gap-1"><AlertTriangle className="w-3 h-3" />{silentFailures.length} silent failures</Badge>
        )}
      </div>

      {!enabled && (
        <p className="text-sm text-muted-foreground">Enable debug mode to start capturing log entries. Logs are in-memory only (no local storage).</p>
      )}

      {enabled && (
        <>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Input className="pl-3 h-8 text-xs" placeholder="Filter by message or file…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            {(['all', ...LEVEL_ORDER] as const).map(l => (
              <Button key={l} size="sm" variant={levelFilter === l ? 'default' : 'outline'} className="h-8 text-xs capitalize" onClick={() => setLevelFilter(l as any)}>
                {l}
              </Button>
            ))}
          </div>

          <ScrollArea className="h-[380px] font-mono text-xs border border-border rounded-lg bg-black/5 dark:bg-white/5">
            <div className="p-3 space-y-1">
              {filtered.length === 0 && <p className="text-muted-foreground">No entries.</p>}
              {filtered.slice().reverse().map(e => (
                <div key={e.id} className="flex gap-2">
                  <span className="text-muted-foreground shrink-0">{new Date(e.timestamp).toLocaleTimeString()}</span>
                  <span className={cn('uppercase shrink-0 w-14', levelColor[e.level])}>{e.level}</span>
                  <span className="text-muted-foreground shrink-0 truncate max-w-[120px]">{e.file}{e.fn ? `::${e.fn}` : ''}</span>
                  <span className="flex-1 truncate">{e.message}</span>
                </div>
              ))}
            </div>
          </ScrollArea>
        </>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────
// AI Isolation Tab — SYSTEM_FLAGS only, no AI imports
// ─────────────────────────────────────────────
const AiIsolationTab = () => {
  const allOff = !SYSTEM_FLAGS.AI_ENABLED && !SYSTEM_FLAGS.AI_ALLOWED_IN_SCANNER && !SYSTEM_FLAGS.AI_ALLOWED_IN_AUTOMATION;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Compile-time AI isolation status. All flags are constants — AI cannot be enabled without a code change.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { label: 'AI_ENABLED', value: SYSTEM_FLAGS.AI_ENABLED },
          { label: 'AI_ALLOWED_IN_SCANNER', value: SYSTEM_FLAGS.AI_ALLOWED_IN_SCANNER },
          { label: 'AI_ALLOWED_IN_AUTOMATION', value: SYSTEM_FLAGS.AI_ALLOWED_IN_AUTOMATION },
        ].map(f => (
          <Card key={f.label} className="p-3">
            <p className="text-xs text-muted-foreground font-mono">{f.label}</p>
            <Badge variant={f.value ? 'destructive' : 'secondary'} className="mt-1">
              {String(f.value)}
            </Badge>
          </Card>
        ))}
      </div>

      <Card className={cn('border', allOff ? 'border-green-500/30 bg-green-500/5' : 'border-destructive/30 bg-destructive/5')}>
        <CardContent className="pt-4 flex items-center gap-3">
          {allOff
            ? <><CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" /><p className="text-sm font-medium text-green-600">AI ISOLATION: SUCCESS — all AI flags are off</p></>
            : <><AlertTriangle className="w-5 h-5 text-destructive shrink-0" /><p className="text-sm font-medium text-destructive">AI ISOLATION: BREACH — one or more AI flags are enabled</p></>
          }
        </CardContent>
      </Card>
    </div>
  );
};

// ─────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────
const AdminDebug = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Bug className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Debug Dashboard</h1>
          <p className="text-sm text-muted-foreground">Scan history · API log · Debug logger · AI isolation</p>
        </div>
        <Badge variant="outline" className="ml-auto gap-1.5">
          <Code2 className="w-3.5 h-3.5" />
          v2.0
        </Badge>
      </div>

      <Tabs defaultValue="scan-history">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="scan-history" className="gap-2"><Activity className="w-4 h-4" />Scan History</TabsTrigger>
          <TabsTrigger value="api-log" className="gap-2"><Clock className="w-4 h-4" />API Log</TabsTrigger>
          <TabsTrigger value="logger" className="gap-2"><Terminal className="w-4 h-4" />Debug Logger</TabsTrigger>
          <TabsTrigger value="ai-isolation" className="gap-2"><Shield className="w-4 h-4" />AI Isolation</TabsTrigger>
        </TabsList>

        <TabsContent value="scan-history" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Activity className="w-4 h-4" />Scan History</CardTitle>
              <CardDescription>Scans are executed via the run-full-scan edge function. Results are read from the scan_runs table.</CardDescription>
            </CardHeader>
            <CardContent>
              <ScanHistoryTab />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="api-log" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Clock className="w-4 h-4" />API Call Log</CardTitle>
              <CardDescription>Last edge-function calls made through safeInvoke in this session.</CardDescription>
            </CardHeader>
            <CardContent>
              <ApiLogTab />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logger" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Terminal className="w-4 h-4" />Debug Logger</CardTitle>
              <CardDescription>In-memory session log — captures <code className="text-xs bg-secondary px-1 rounded">debugLog / debugError / debugWarn</code> calls. No local storage.</CardDescription>
            </CardHeader>
            <CardContent>
              <DebugLoggerTab />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ai-isolation" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Shield className="w-4 h-4" />AI Isolation</CardTitle>
              <CardDescription>Compile-time flag status. No AI imports in debug/scanner/test pipeline.</CardDescription>
            </CardHeader>
            <CardContent>
              <AiIsolationTab />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminDebug;
