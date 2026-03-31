import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  Play, Radar, AlertTriangle, CheckCircle, XCircle, Clock,
  Activity, Loader2, Shield, Database, Zap, RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { runScan, type ScanIssue } from '@/lib/scanner/scanEngine';
import { supabase } from '@/integrations/supabase/client';

// ── Types ──

interface CycleStage {
  key: string;
  label: string;
  status: 'idle' | 'running' | 'done' | 'error';
  result?: string;
}

const INITIAL_STAGES: CycleStage[] = [
  { key: 'scan',    label: '1. Scan (scanEngine)',         status: 'idle' },
  { key: 'analyze', label: '2. Analyze (RootCauseEngine)', status: 'idle' },
  { key: 'fix',     label: '3. Fix (FixEngine)',           status: 'idle' },
  { key: 'apply',   label: '4. Apply fix',                 status: 'idle' },
  { key: 'verify',  label: '5. Verify (VerifyEngine)',     status: 'idle' },
  { key: 'memory',  label: '6. Update system_memory',      status: 'idle' },
];

// ── Helpers ──

function severityColor(s: string) {
  if (s === 'critical') return 'text-red-600';
  if (s === 'high')     return 'text-orange-500';
  if (s === 'medium')   return 'text-yellow-500';
  return 'text-muted-foreground';
}

function severityBadge(s: string) {
  if (s === 'critical') return 'destructive' as const;
  if (s === 'high')     return 'destructive' as const;
  return 'secondary' as const;
}

// ── Root cause analysis (deterministic) ──

function analyzeRootCause(issue: ScanIssue): string {
  if (issue.rule === 'stuck-order')      return 'Fulfillment pipeline stalled or operator action needed';
  if (issue.rule === 'stale-bug')        return 'Bug triage backlog — needs assignment';
  if (issue.rule === 'stuck-work-item')  return 'Work item has no recent activity — may be blocked';
  if (issue.rule === 'unassigned-critical') return 'Critical/high work item lacks assignee';
  return 'Unknown root cause';
}

// ── Fix generation (deterministic) ──

function generateFix(issue: ScanIssue): string {
  if (issue.rule === 'stuck-order')      return 'Create work item to trigger fulfillment review';
  if (issue.rule === 'stale-bug')        return 'Create work item to assign and prioritize bug';
  if (issue.rule === 'stuck-work-item')  return 'Create work item to unblock or close stale item';
  if (issue.rule === 'unassigned-critical') return 'Create work item to assign critical issue';
  return 'Log issue for manual review';
}

// ── Main component ──

const AdminAdvanced = () => {
  const queryClient = useQueryClient();
  const [stages, setStages] = useState<CycleStage[]>(INITIAL_STAGES);
  const [running, setRunning] = useState(false);
  const [lastRun, setLastRun] = useState<string | null>(null);
  const [issues, setIssues] = useState<ScanIssue[]>([]);
  const [cycleLog, setCycleLog] = useState<string[]>([]);

  // ── system_memory recent entries ──
  const { data: memoryEntries = [] } = useQuery({
    queryKey: ['system-memory'],
    queryFn: async () => {
      const { data } = await supabase
        .from('system_memory')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      return data || [];
    },
    refetchInterval: 30_000,
  });

  const setStage = useCallback((key: string, update: Partial<CycleStage>) => {
    setStages(prev => prev.map(s => s.key === key ? { ...s, ...update } : s));
  }, []);

  const log = useCallback((msg: string) => {
    setCycleLog(prev => [...prev, `[${new Date().toISOString()}] ${msg}`]);
  }, []);

  // ── runFullCycle — THE system loop ──
  const runFullCycle = useCallback(async () => {
    if (running) return;
    setRunning(true);
    setStages(INITIAL_STAGES);
    setCycleLog([]);
    setIssues([]);

    try {
      // ── Stage 1: Scan ──
      setStage('scan', { status: 'running' });
      log('scanEngine.run() starting…');
      const scanResult = await runScan();
      const foundIssues = scanResult.issues;
      setIssues(foundIssues);
      setStage('scan', { status: 'done', result: `${foundIssues.length} issues found in ${scanResult.durationMs}ms` });
      log(`Scan complete — ${foundIssues.length} issues, ${scanResult.durationMs}ms`);

      // ── Stage 2: Analyze ──
      setStage('analyze', { status: 'running' });
      const analyzed = foundIssues.map(i => ({ issue: i, rootCause: analyzeRootCause(i) }));
      setStage('analyze', { status: 'done', result: `${analyzed.length} root causes identified` });
      log(`RootCauseEngine — ${analyzed.length} root causes`);

      // ── Stage 3: Fix generation ──
      setStage('fix', { status: 'running' });
      const fixes = analyzed.map(a => ({ ...a, fix: generateFix(a.issue) }));
      setStage('fix', { status: 'done', result: `${fixes.length} fixes generated` });
      log(`FixEngine — ${fixes.length} fixes generated`);

      // ── Stage 4: Apply fix (create work items for critical/high) ──
      setStage('apply', { status: 'running' });
      const critical = fixes.filter(f => f.issue.severity === 'critical' || f.issue.severity === 'high');
      let applied = 0;
      for (const f of critical) {
        const { error } = await supabase.from('work_items').insert({
          title: `[AUTO] ${f.issue.message}`,
          description: `Root cause: ${f.rootCause}\nFix: ${f.fix}`,
          status: 'open',
          priority: f.issue.severity === 'critical' ? 'critical' : 'high',
          item_type: 'task',
        });
        if (!error) applied++;
      }
      setStage('apply', { status: 'done', result: `${applied} work items created` });
      log(`ApplyFix — ${applied} work items created`);

      // ── Stage 5: Verify ──
      setStage('verify', { status: 'running' });
      const verified = applied === critical.length;
      setStage('verify', { status: verified ? 'done' : 'error', result: verified ? 'All fixes applied' : 'Some fixes failed' });
      log(`VerifyEngine — ${verified ? 'OK' : 'PARTIAL'}`);

      // ── Stage 6: Update system_memory ──
      setStage('memory', { status: 'running' });
      const issueHash = `${new Date().toDateString()}-${foundIssues.length}-${critical.length}`;
      await supabase.from('system_memory').insert({
        issue_hash:   issueHash,
        root_cause:   JSON.stringify(analyzed.slice(0, 5).map(a => a.rootCause)),
        fix:          JSON.stringify(fixes.slice(0, 5).map(f => f.fix)),
        result:       verified ? 'success' : 'partial',
        success_rate: critical.length > 0 ? Math.round((applied / critical.length) * 100) : 100,
      });
      setStage('memory', { status: 'done', result: 'system_memory updated' });
      log('system_memory updated');

      setLastRun(new Date().toISOString());
      queryClient.invalidateQueries({ queryKey: ['system-memory'] });
      toast.success(`Full cycle complete — ${foundIssues.length} issues, ${applied} fixes applied`);
    } catch (err: any) {
      log(`ERROR: ${err?.message || err}`);
      toast.error('Cycle failed: ' + (err?.message || 'unknown error'));
    } finally {
      setRunning(false);
    }
  }, [running, setStage, log, queryClient]);

  const doneCount  = stages.filter(s => s.status === 'done').length;
  const progress   = running ? Math.round((doneCount / stages.length) * 100) : (doneCount > 0 ? 100 : 0);
  const criticalCount = issues.filter(i => i.severity === 'critical').length;
  const highCount     = issues.filter(i => i.severity === 'high').length;

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" />
            System Core
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Unified scan → analyze → fix → verify control panel
          </p>
        </div>
        <Button
          onClick={runFullCycle}
          disabled={running}
          size="lg"
          className="gap-2"
        >
          {running
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Running…</>
            : <><Play className="w-4 h-4" /> RUN FULL SYSTEM</>
          }
        </Button>
      </div>

      {lastRun && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Clock className="w-3 h-3" />
          Last run: {format(new Date(lastRun), 'yyyy-MM-dd HH:mm:ss')}
        </p>
      )}

      {/* Pipeline progress */}
      {(running || doneCount > 0) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" /> Pipeline
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Progress value={progress} className="h-2" />
            <div className="space-y-1.5">
              {stages.map(s => (
                <div key={s.key} className="flex items-center gap-3 text-sm">
                  {s.status === 'idle'    && <Clock    className="w-4 h-4 text-muted-foreground shrink-0" />}
                  {s.status === 'running' && <Loader2  className="w-4 h-4 animate-spin text-primary shrink-0" />}
                  {s.status === 'done'    && <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />}
                  {s.status === 'error'   && <XCircle  className="w-4 h-4 text-red-500 shrink-0" />}
                  <span className={cn('font-medium', s.status === 'idle' && 'text-muted-foreground')}>{s.label}</span>
                  {s.result && <span className="text-xs text-muted-foreground ml-auto">{s.result}</span>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Scan results */}
      {issues.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Radar className="w-4 h-4 text-primary" /> Scan Results
              <Badge variant="destructive" className="ml-auto">{criticalCount} critical</Badge>
              <Badge variant="secondary">{highCount} high</Badge>
              <Badge variant="outline">{issues.length} total</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-56">
              <div className="space-y-1.5">
                {issues.map((issue, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs p-2 rounded-lg bg-muted/40 border border-border">
                    <AlertTriangle className={cn('w-3.5 h-3.5 mt-0.5 shrink-0', severityColor(issue.severity))} />
                    <div className="flex-1 min-w-0">
                      <span className="font-medium">{issue.message}</span>
                      <span className="text-muted-foreground ml-2">({issue.component} / {issue.rule})</span>
                    </div>
                    <Badge variant={severityBadge(issue.severity)} className="text-[9px] shrink-0">{issue.severity}</Badge>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Cycle log */}
      {cycleLog.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" /> Cycle Log
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-36">
              <div className="font-mono text-[11px] space-y-0.5 text-muted-foreground">
                {cycleLog.map((entry, i) => (
                  <div key={i}>{entry}</div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      <Separator />

      {/* System memory */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Database className="w-4 h-4 text-primary" /> system_memory
            <Button
              size="sm"
              variant="ghost"
              className="ml-auto h-6 text-xs gap-1"
              onClick={() => queryClient.invalidateQueries({ queryKey: ['system-memory'] })}
            >
              <RefreshCw className="w-3 h-3" /> Refresh
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {memoryEntries.length === 0 ? (
            <p className="text-xs text-muted-foreground">No entries yet — run the full system to populate.</p>
          ) : (
            <ScrollArea className="h-48">
              <div className="space-y-2">
                {memoryEntries.map((entry: any) => (
                  <div key={entry.id} className="text-xs p-2 rounded-lg border border-border bg-muted/30 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-muted-foreground">{entry.issue_hash}</span>
                      <Badge variant={entry.result === 'success' ? 'secondary' : 'outline'} className="text-[9px]">
                        {entry.result} · {entry.success_rate ?? '?'}%
                      </Badge>
                    </div>
                    <div className="text-muted-foreground">{format(new Date(entry.created_at), 'yyyy-MM-dd HH:mm:ss')}</div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

    </div>
  );
};

export default AdminAdvanced;
