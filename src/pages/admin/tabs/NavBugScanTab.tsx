import { useState } from 'react';
import { Bug, Copy, Loader2, AlertTriangle, RefreshCw, CheckCircle, XCircle, AlertCircle, Radar, ArrowRight, Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { callAI, copyToClipboard } from './_shared';

export const NavBugScanTab = () => {
  const [navResult, setNavResult] = useState<any>(null);
  const [bugResult, setBugResult] = useState<any>(null);
  const [loadingNav, setLoadingNav] = useState(false);
  const [loadingBug, setLoadingBug] = useState(false);

  const runNav = async () => {
    setLoadingNav(true);
    const r = await callAI('nav_scan');
    if (r) { setNavResult(r); toast.success(`Nav-scan klar – ${r.issues?.length || 0} problem, ${r.tasks_created || 0} uppgifter`); }
    setLoadingNav(false);
  };

  const runBugRescan = async () => {
    setLoadingBug(true);
    const r = await callAI('bug_rescan');
    if (r) { setBugResult(r); toast.success(`Bugg-rescan klar – ${r.applied?.bugs_updated || 0} uppdaterade`); }
    setLoadingBug(false);
  };

  const routeIcon = (s: string) => {
    if (s === 'ok') return <CheckCircle className="w-3.5 h-3.5 text-green-600" />;
    if (s === 'warning') return <AlertTriangle className="w-3.5 h-3.5 text-yellow-600" />;
    if (s === 'broken') return <XCircle className="w-3.5 h-3.5 text-destructive" />;
    return <AlertCircle className="w-3.5 h-3.5 text-muted-foreground" />;
  };

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      not_started: '🔴', in_progress: '🟡', review: '🔵', done: '🟢',
      ready_for_publish: '🚀', ignored: '⚫', open: '🔴', resolved: '🟢', duplicate: '📎',
    };
    return `${map[s] || '⚪'} ${s}`;
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Nav Scanner */}
        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Compass className="w-5 h-5 text-primary" />
            <div>
              <h3 className="text-sm font-bold">Navigationsscanner</h3>
              <p className="text-[10px] text-muted-foreground">Skannar alla routes, länkar och knappar</p>
            </div>
          </div>
          <Button onClick={runNav} disabled={loadingNav} className="w-full gap-2">
            {loadingNav ? <Loader2 className="w-4 h-4 animate-spin" /> : <Radar className="w-4 h-4" />}
            {loadingNav ? 'Skannar navigation...' : 'Kör navigationsscan'}
          </Button>
        </Card>

        {/* Bug Rescan */}
        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Bug className="w-5 h-5 text-primary" />
            <div>
              <h3 className="text-sm font-bold">Bugg-omvärdering</h3>
              <p className="text-[10px] text-muted-foreground">Omvärderar alla buggar, uppdaterar status</p>
            </div>
          </div>
          <Button onClick={runBugRescan} disabled={loadingBug} className="w-full gap-2">
            {loadingBug ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {loadingBug ? 'Analyserar buggar...' : 'Kör bugg-rescan'}
          </Button>
        </Card>
      </div>

      {/* Nav Results */}
      {navResult && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className={cn(
              'w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold border-2',
              navResult.nav_score >= 80 ? 'border-green-500 text-green-700 bg-green-50' :
              navResult.nav_score >= 50 ? 'border-yellow-500 text-yellow-700 bg-yellow-50' :
              'border-red-500 text-red-700 bg-red-50'
            )}>
              {navResult.nav_score}
            </div>
            <div>
              <h3 className="text-sm font-bold">Navigationspoäng</h3>
              <p className="text-xs text-muted-foreground">{navResult.summary}</p>
              {navResult.tasks_created > 0 && <Badge variant="secondary" className="mt-1 text-[10px]">{navResult.tasks_created} uppgifter skapade</Badge>}
            </div>
          </div>

          {/* Route status */}
          <Card className="p-4">
            <h4 className="text-xs font-semibold mb-2">Route-status</h4>
            <ScrollArea className="max-h-[50vh]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 pr-2">
                {navResult.route_status?.map((r: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 p-1.5 rounded text-xs">
                    {routeIcon(r.status)}
                    <span className="font-mono text-[10px] text-muted-foreground w-32 shrink-0">{r.path}</span>
                    <span className="truncate">{r.notes}</span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </Card>

          {/* Nav issues */}
          {navResult.issues?.length > 0 && (
            <Card className="p-4">
              <h4 className="text-xs font-semibold mb-2">Navigationsproblem ({navResult.issues.length})</h4>
              <ScrollArea className="max-h-[50vh]">
                <div className="space-y-2 pr-2">
                  {navResult.issues.map((issue: any, i: number) => (
                    <div key={i} className="border rounded-lg p-3 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-medium">{issue.title}</p>
                          <div className="flex gap-1 mt-0.5">
                            <Badge variant={issue.severity === 'critical' || issue.severity === 'high' ? 'destructive' : 'secondary'} className="text-[8px]">{issue.severity}</Badge>
                            <Badge variant="outline" className="text-[8px]">{issue.issue_type}</Badge>
                            <span className="text-[9px] text-muted-foreground">{issue.page}</span>
                          </div>
                        </div>
                        <Button size="sm" variant="ghost" className="h-5 text-[9px] gap-0.5 shrink-0" onClick={() => copyToClipboard(issue.lovable_prompt)}>
                          <Copy className="w-2.5 h-2.5" /> Prompt
                        </Button>
                      </div>
                      <p className="text-[10px] text-muted-foreground">{issue.description}</p>
                      <p className="text-[10px] text-accent">Fix: {issue.fix_suggestion}</p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </Card>
          )}
        </div>
      )}

      {/* Bug Rescan Results */}
      {bugResult && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className={cn(
              'w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold border-2',
              bugResult.health_score >= 80 ? 'border-green-500 text-green-700 bg-green-50' :
              bugResult.health_score >= 50 ? 'border-yellow-500 text-yellow-700 bg-yellow-50' :
              'border-red-500 text-red-700 bg-red-50'
            )}>
              {bugResult.health_score}
            </div>
            <div>
              <h3 className="text-sm font-bold">Bugghälsa</h3>
              <p className="text-xs text-muted-foreground">{bugResult.summary}</p>
              <div className="flex gap-2 mt-1 text-[10px]">
                <span>📊 {bugResult.total_evaluated} utvärderade</span>
                <span>🐛 {bugResult.applied?.bugs_updated || 0} buggar uppdaterade</span>
                <span>📋 {bugResult.applied?.work_items_updated || 0} tasks uppdaterade</span>
                <span>✅ {bugResult.applied?.tasks_created || 0} nya tasks</span>
              </div>
            </div>
          </div>

          {/* Status changes */}
          {bugResult.status_changes?.length > 0 && (
            <Card className="p-4">
              <h4 className="text-xs font-semibold mb-2">Statusändringar ({bugResult.status_changes.length})</h4>
              <ScrollArea className="max-h-[50vh]">
                <div className="space-y-1.5 pr-2">
                  {bugResult.status_changes.map((c: any, i: number) => (
                    <div key={i} className={cn(
                      'border rounded-md p-2 flex items-start gap-2 text-xs',
                      c.confidence >= 80 ? 'border-green-200 bg-green-50/50' : 'border-border'
                    )}>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono text-[9px] text-muted-foreground">{c.bug_id.slice(0, 8)}</span>
                          <span className="text-[9px]">{statusBadge(c.current_status)}</span>
                          <ArrowRight className="w-3 h-3 text-muted-foreground" />
                          <span className="text-[9px] font-medium">{statusBadge(c.recommended_status)}</span>
                          <span className={cn('text-[8px] px-1 rounded', c.confidence >= 80 ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground')}>
                            {c.confidence}%
                          </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{c.reason}</p>
                      </div>
                      {c.confidence >= 80 && <CheckCircle className="w-3.5 h-3.5 text-green-600 shrink-0" />}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </Card>
          )}

          {/* Duplicates */}
          {bugResult.duplicates?.length > 0 && (
            <Card className="p-4">
              <h4 className="text-xs font-semibold mb-2">Dubbletter ({bugResult.duplicates.length})</h4>
              <ScrollArea className="max-h-[50vh]">
                <div className="space-y-1.5 pr-2">
                  {bugResult.duplicates.map((d: any, i: number) => (
                    <div key={i} className="border rounded-md p-2 text-xs">
                      <div className="flex gap-1 flex-wrap mb-0.5">
                        {d.bug_ids.map((id: string) => <span key={id} className="font-mono text-[9px] bg-muted px-1.5 py-0.5 rounded">{id.slice(0, 8)}</span>)}
                      </div>
                      <p className="text-[10px] text-muted-foreground">{d.reason}</p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </Card>
          )}

          {/* Missing work items */}
          {bugResult.missing_work_items?.length > 0 && (
            <Card className="p-4">
              <h4 className="text-xs font-semibold mb-2">Skapade saknade uppgifter ({bugResult.missing_work_items.length})</h4>
              <ScrollArea className="max-h-[50vh]">
                <div className="space-y-1.5 pr-2">
                  {bugResult.missing_work_items.map((m: any, i: number) => (
                    <div key={i} className="border rounded-md p-2 flex items-center gap-2 text-xs">
                      <Badge variant={m.priority === 'critical' || m.priority === 'high' ? 'destructive' : 'secondary'} className="text-[8px]">{m.priority}</Badge>
                      <span>{m.title}</span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};

// ── Visual QA Tab ──
