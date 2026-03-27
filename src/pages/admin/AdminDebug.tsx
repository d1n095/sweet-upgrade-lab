import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Activity, AlertTriangle, Bug, CheckCircle2, ChevronRight,
  Clock, Code2, Download, Globe, Loader2, RefreshCw,
  Search, Shield, Terminal, Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSiteScannerStore, ScanStatus } from '@/debug/scanner/siteScanner';
import { useDebugLoggerStore, LogLevel } from '@/debug/logger/debugLogger';
import { useTestRunnerStore, TEST_CASES } from '@/debug/testRunner/testRunner';
import { buildSiteIndex, searchIndex, IndexEntryType } from '@/debug/index/siteIndex';

// ─────────────────────────────────────────────
// Site Scanner Tab
// ─────────────────────────────────────────────
const ScannerTab = () => {
  const { status, result, progress, currentStep, error, options, runScan, reset, setOptions, exportJson } = useSiteScannerStore();
  const [depthInput, setDepthInput] = useState(String(options.depth));

  const scanning = status === 'scanning';
  const done = status === 'done';

  const statusColor: Record<ScanStatus, string> = {
    idle: 'text-muted-foreground',
    scanning: 'text-blue-500',
    done: 'text-green-500',
    error: 'text-destructive',
  };

  const downloadJson = () => {
    const json = exportJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `site-scan-${Date.now()}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Button onClick={runScan} disabled={scanning} size="sm" className="gap-2">
          {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
          {scanning ? 'Scanning…' : 'Run Full Scan'}
        </Button>
        {(done || status === 'error') && (
          <>
            <Button onClick={reset} variant="outline" size="sm" className="gap-2">
              <RefreshCw className="w-4 h-4" /> Reset
            </Button>
            <Button onClick={downloadJson} variant="outline" size="sm" className="gap-2">
              <Download className="w-4 h-4" /> Export JSON
            </Button>
          </>
        )}
        <Badge variant="outline" className={cn('text-xs', statusColor[status])}>
          {status.toUpperCase()}
        </Badge>
      </div>

      {scanning && (
        <div className="space-y-2">
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-muted-foreground">{currentStep}</p>
        </div>
      )}

      {error && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="pt-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {done && result && (
        <div className="space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <SummaryCard label="Health Score" value={`${result.summary.health_score}/100`} icon={<Shield className="w-4 h-4" />} color={result.summary.health_score >= 80 ? 'green' : result.summary.health_score >= 50 ? 'yellow' : 'red'} />
            <SummaryCard label="Routes Broken" value={`${result.summary.broken_routes}/${result.summary.total_routes}`} icon={<Globe className="w-4 h-4" />} color={result.summary.broken_routes === 0 ? 'green' : 'red'} />
            <SummaryCard label="API Broken" value={`${result.summary.broken_api}/${result.summary.total_api}`} icon={<Zap className="w-4 h-4" />} color={result.summary.broken_api === 0 ? 'green' : 'red'} />
            <SummaryCard label="Console Errors" value={String(result.summary.console_errors)} icon={<AlertTriangle className="w-4 h-4" />} color={result.summary.console_errors === 0 ? 'green' : 'red'} />
          </div>
          {/* Scan duration */}
          <p className="text-xs text-muted-foreground">Scanned at {new Date(result.summary.scanned_at).toLocaleString()} · Duration: {(result.summary.scan_duration_ms / 1000).toFixed(1)}s</p>

          {/* Routes table */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Routes ({result.routes.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-48">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left px-4 py-2 font-medium text-muted-foreground">Path</th>
                      <th className="text-left px-4 py-2 font-medium text-muted-foreground">Status</th>
                      <th className="text-left px-4 py-2 font-medium text-muted-foreground">Latency</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.routes.map(r => (
                      <tr key={r.path} className={cn('border-b border-border/50', !r.ok && 'bg-destructive/5')}>
                        <td className="px-4 py-2 font-mono">{r.path}</td>
                        <td className="px-4 py-2">
                          {r.ok
                            ? <span className="text-green-500">{r.status ?? '—'}</span>
                            : <span className="text-destructive">{r.status ?? r.error ?? 'ERR'}</span>}
                        </td>
                        <td className="px-4 py-2 text-muted-foreground">{r.latency_ms}ms</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* API results */}
          {result.api.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">API Probes</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {result.api.map(a => (
                  <div key={a.endpoint} className="flex items-center justify-between text-xs">
                    <span className="font-mono truncate max-w-[60%]">{a.endpoint}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">{a.latency_ms}ms</span>
                      {a.ok ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> : <AlertTriangle className="w-3.5 h-3.5 text-destructive" />}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────
// Test Runner Tab
// ─────────────────────────────────────────────
const TestRunnerTab = () => {
  const { running, results, summary, selectedTests, toggleTest, selectAll, selectNone, runTests, reset, exportReport } = useTestRunnerStore();

  const getStatusIcon = (status: string) => {
    if (status === 'pass') return <CheckCircle2 className="w-4 h-4 text-green-500" />;
    if (status === 'fail') return <AlertTriangle className="w-4 h-4 text-destructive" />;
    if (status === 'skip') return <ChevronRight className="w-4 h-4 text-muted-foreground" />;
    if (status === 'running') return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
    return <Clock className="w-4 h-4 text-muted-foreground" />;
  };

  const downloadReport = () => {
    const blob = new Blob([exportReport()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `test-report-${Date.now()}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  const resultMap = new Map(results.map(r => [r.id, r]));
  const categories = [...new Set(TEST_CASES.map(t => t.category))];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Button onClick={runTests} disabled={running} size="sm" className="gap-2">
          {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
          {running ? 'Running…' : 'Run Tests'}
        </Button>
        <Button onClick={selectAll} variant="outline" size="sm">Select All</Button>
        <Button onClick={selectNone} variant="outline" size="sm">Select None</Button>
        {summary && (
          <>
            <Button onClick={reset} variant="outline" size="sm"><RefreshCw className="w-4 h-4" /></Button>
            <Button onClick={downloadReport} variant="outline" size="sm" className="gap-2"><Download className="w-4 h-4" /> Export</Button>
          </>
        )}
      </div>

      {summary && (
        <div className="grid grid-cols-3 gap-3">
          <SummaryCard label="Passed" value={String(summary.passed)} icon={<CheckCircle2 className="w-4 h-4" />} color="green" />
          <SummaryCard label="Failed" value={String(summary.failed)} icon={<AlertTriangle className="w-4 h-4" />} color={summary.failed === 0 ? 'green' : 'red'} />
          <SummaryCard label="Skipped" value={String(summary.skipped)} icon={<ChevronRight className="w-4 h-4" />} color="yellow" />
        </div>
      )}

      {categories.map(cat => {
        const tests = TEST_CASES.filter(t => t.category === cat);
        return (
          <Card key={cat}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm capitalize">{cat.replace('_', ' ')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {tests.map(test => {
                const result = resultMap.get(test.id);
                const selected = selectedTests.has(test.id);
                return (
                  <div key={test.id} className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleTest(test.id)}
                      className="mt-0.5 h-4 w-4 rounded border-border"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {result ? getStatusIcon(result.status) : <Clock className="w-4 h-4 text-muted-foreground" />}
                        <span className="text-sm font-medium">{test.name}</span>
                        {result && <span className="text-xs text-muted-foreground ml-auto">{result.duration_ms}ms</span>}
                      </div>
                      {result && result.status === 'fail' && (
                        <p className="text-xs text-destructive mt-1 pl-6">{result.message}</p>
                      )}
                      {result && result.status === 'pass' && (
                        <p className="text-xs text-muted-foreground mt-1 pl-6">{result.message}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

// ─────────────────────────────────────────────
// Site Index Tab
// ─────────────────────────────────────────────
const SiteIndexTab = () => {
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<IndexEntryType | 'all'>('all');
  const index = buildSiteIndex();

  const types: Array<IndexEntryType | 'all'> = ['all', 'page', 'component', 'api', 'store', 'util'];
  const results = query
    ? searchIndex(index, query, typeFilter === 'all' ? undefined : [typeFilter])
    : [...index.pages, ...index.components, ...index.api, ...index.stores, ...index.utils].filter(e => typeFilter === 'all' || e.type === typeFilter);

  const downloadIndex = () => {
    const json = JSON.stringify(index, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `site-index-${Date.now()}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  const typeColor: Record<string, string> = {
    page: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    component: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
    api: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
    store: 'bg-green-500/10 text-green-600 dark:text-green-400',
    util: 'bg-gray-500/10 text-gray-600 dark:text-gray-400',
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9 h-9 text-sm" placeholder="Search pages, components, API…" value={query} onChange={e => setQuery(e.target.value)} />
        </div>
        <div className="flex gap-1 flex-wrap">
          {types.map(t => (
            <Button key={t} size="sm" variant={typeFilter === t ? 'default' : 'outline'} className="h-8 text-xs capitalize" onClick={() => setTypeFilter(t)}>
              {t}
            </Button>
          ))}
        </div>
        <Button onClick={downloadIndex} variant="outline" size="sm" className="gap-2 h-9">
          <Download className="w-4 h-4" /> Export
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">{results.length} entries · generated {new Date(index.generated_at).toLocaleString()}</p>

      <ScrollArea className="h-[420px]">
        <div className="space-y-2">
          {results.map(entry => (
            <div key={entry.id} className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-secondary/30 transition-colors">
              <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 mt-0.5', typeColor[entry.type] || 'bg-secondary')}>{entry.type}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{entry.label}</span>
                  <span className="text-xs font-mono text-muted-foreground truncate">{entry.path}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{entry.description}</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {entry.tags.map(tag => (
                    <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">{tag}</span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};

// ─────────────────────────────────────────────
// Debug Logger Tab
// ─────────────────────────────────────────────
const LEVEL_ORDER: LogLevel[] = ['critical', 'error', 'warn', 'info', 'debug'];
const levelColor: Record<LogLevel, string> = {
  critical: 'text-destructive font-bold',
  error: 'text-destructive',
  warn: 'text-yellow-500',
  info: 'text-blue-500',
  debug: 'text-muted-foreground',
};

const DebugLoggerTab = () => {
  const { enabled, entries, silentFailures, toggle, clear, exportLog } = useDebugLoggerStore();
  const [levelFilter, setLevelFilter] = useState<LogLevel | 'all'>('all');
  const [search, setSearch] = useState('');

  const filtered = entries.filter(e => {
    if (levelFilter !== 'all' && e.level !== levelFilter) return false;
    if (search && !e.message.toLowerCase().includes(search.toLowerCase()) && !e.file.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

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
          <Terminal className="w-4 h-4" />
          {enabled ? 'DEBUG ON' : 'DEBUG OFF'}
        </Button>
        <Button onClick={clear} variant="outline" size="sm">Clear</Button>
        {entries.length > 0 && (
          <Button onClick={downloadLog} variant="outline" size="sm" className="gap-2"><Download className="w-4 h-4" /> Export</Button>
        )}
        <Badge variant="outline" className="text-xs">
          {entries.length} entries · {silentFailures.length} silent failures
        </Badge>
      </div>

      {!enabled && (
        <Card className="border-dashed">
          <CardContent className="pt-4 text-sm text-muted-foreground text-center">
            Enable DEBUG mode to capture log entries from <code>debugLog / debugError / debugWarn</code> calls throughout the app.
          </CardContent>
        </Card>
      )}

      {enabled && (
        <>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input className="pl-9 h-8 text-xs" placeholder="Filter by message or file…" value={search} onChange={e => setSearch(e.target.value)} />
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
// Shared helper
// ─────────────────────────────────────────────
const SummaryCard = ({ label, value, icon, color }: { label: string; value: string; icon: React.ReactNode; color: 'green' | 'red' | 'yellow' | 'blue' }) => {
  const colorCls = { green: 'text-green-500', red: 'text-destructive', yellow: 'text-yellow-500', blue: 'text-blue-500' }[color];
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={cn('shrink-0', colorCls)}>{icon}</div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className={cn('text-lg font-bold', colorCls)}>{value}</p>
        </div>
      </CardContent>
    </Card>
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
          <p className="text-sm text-muted-foreground">Site scanner · Test runner · Site index · Debug logger</p>
        </div>
        <Badge variant="outline" className="ml-auto gap-1.5">
          <Code2 className="w-3.5 h-3.5" />
          v1.0
        </Badge>
      </div>

      <Tabs defaultValue="scanner">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="scanner" className="gap-2"><Globe className="w-4 h-4" />Site Scanner</TabsTrigger>
          <TabsTrigger value="tests" className="gap-2"><Activity className="w-4 h-4" />Test Runner</TabsTrigger>
          <TabsTrigger value="index" className="gap-2"><Search className="w-4 h-4" />Site Index</TabsTrigger>
          <TabsTrigger value="logger" className="gap-2"><Terminal className="w-4 h-4" />Debug Logger</TabsTrigger>
        </TabsList>

        <TabsContent value="scanner" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Globe className="w-4 h-4" />Full Site Scanner</CardTitle>
              <CardDescription>Probes all known routes, checks API endpoints, collects asset issues and console errors. No AI dependencies.</CardDescription>
            </CardHeader>
            <CardContent>
              <ScannerTab />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tests" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Activity className="w-4 h-4" />Test Runner</CardTitle>
              <CardDescription>Runs deterministic environment, storage, API, navigation and UI checks.</CardDescription>
            </CardHeader>
            <CardContent>
              <TestRunnerTab />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="index" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Search className="w-4 h-4" />Site Index</CardTitle>
              <CardDescription>Searchable index of all pages, components, API endpoints, stores and utilities.</CardDescription>
            </CardHeader>
            <CardContent>
              <SiteIndexTab />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logger" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Terminal className="w-4 h-4" />Debug Logger</CardTitle>
              <CardDescription>Global DEBUG mode — captures all <code className="text-xs bg-secondary px-1 rounded">debugLog / debugError / debugWarn</code> calls with file, function and stack trace.</CardDescription>
            </CardHeader>
            <CardContent>
              <DebugLoggerTab />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminDebug;
