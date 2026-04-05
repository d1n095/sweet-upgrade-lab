import { useState, useCallback } from 'react';
import { Loader2, AlertTriangle, CheckCircle, Clock, Activity, Wrench, Radar, GitMerge, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface CleanupFinding {
  id: string;
  category: 'duplicate' | 'orphan' | 'stale' | 'outdated';
  table: string;
  title: string;
  detail: string;
  ids: string[];
  autoCleanable: boolean;
}

export const DataCleanupTab = () => {
  const [scanning, setScanning] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [findings, setFindings] = useState<CleanupFinding[]>([]);
  const [cleaned, setCleaned] = useState(0);
  const [progress, setProgress] = useState(0);
  const [lastRun, setLastRun] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const scan = useCallback(async () => {
    setScanning(true);
    setFindings([]);
    setCleaned(0);
    setProgress(0);
    const results: CleanupFinding[] = [];
    const makeId = () => `cf-${Date.now()}-${Math.random().toString(36).slice(2,6)}`;

    try {
      // ─── 1. Duplicate bugs (same description + page_url) ───
      setProgress(10);
      const { data: bugs } = await supabase.from('bug_reports').select('id, description, page_url, status, created_at').order('created_at', { ascending: false }).limit(500);
      if (bugs && bugs.length > 1) {
        const seen = new Map<string, typeof bugs>();
        for (const bug of bugs) {
          const key = `${(bug.description || '').slice(0, 80).toLowerCase().trim()}|${bug.page_url}`;
          if (!seen.has(key)) seen.set(key, []);
          seen.get(key)!.push(bug);
        }
        for (const [, group] of seen) {
          if (group.length > 1) {
            const dupes = group.slice(1);
            results.push({
              id: makeId(), category: 'duplicate', table: 'bug_reports',
              title: `${dupes.length} duplicerade buggar`,
              detail: `"${group[0].description?.slice(0, 60)}…" — ${group.length} identiska rapporter`,
              ids: dupes.map(d => d.id), autoCleanable: true,
            });
          }
        }
      }

      // ─── 2. Orphan work_items (source_id points to missing bug/incident) ───
      setProgress(30);
      const { data: workItems } = await supabase.from('work_items' as any).select('id, title, source_type, source_id, status').limit(500);
      if (workItems) {
        const bugSourced = (workItems as any[]).filter(w => w.source_type === 'bug_report' && w.source_id);
        if (bugSourced.length > 0) {
          const sourceIds = [...new Set(bugSourced.map(w => w.source_id))];
          const { data: existingBugs } = await supabase.from('bug_reports').select('id').in('id', sourceIds.slice(0, 100));
          const existingSet = new Set((existingBugs || []).map(b => b.id));
          const orphans = bugSourced.filter(w => !existingSet.has(w.source_id));
          if (orphans.length > 0) {
            results.push({
              id: makeId(), category: 'orphan', table: 'work_items',
              title: `${orphans.length} föräldralösa work items`,
              detail: 'Käll-buggen har raderats men work item finns kvar',
              ids: orphans.map((o: any) => o.id), autoCleanable: true,
            });
          }
        }

        // Stale work_items: in_progress > 14 days without update
        const stale = (workItems as any[]).filter(w => {
          if (w.status !== 'in_progress' && w.status !== 'open') return false;
          const updated = new Date(w.updated_at || w.created_at || 0);
          return Date.now() - updated.getTime() > 14 * 86400000;
        });
        if (stale.length > 0) {
          results.push({
            id: makeId(), category: 'stale', table: 'work_items',
            title: `${stale.length} inaktiva work items (>14d)`,
            detail: 'Öppna/pågående uppgifter utan aktivitet på 14+ dagar',
            ids: stale.map((s: any) => s.id), autoCleanable: false,
          });
        }
      }

      // ─── 3. Outdated issues: resolved bugs older than 90 days ───
      setProgress(50);
      const cutoff90 = new Date(Date.now() - 90 * 86400000).toISOString();
      const { data: oldBugs } = await supabase.from('bug_reports').select('id').eq('status', 'resolved').lt('resolved_at', cutoff90).limit(200);
      if (oldBugs && oldBugs.length > 0) {
        results.push({
          id: makeId(), category: 'outdated', table: 'bug_reports',
          title: `${oldBugs.length} lösta buggar (>90d)`,
          detail: 'Lösta buggrapporter äldre än 90 dagar kan arkiveras',
          ids: oldBugs.map(b => b.id), autoCleanable: true,
        });
      }

      // ─── 4. Stale activity logs older than 60 days ───
      setProgress(65);
      const cutoff60 = new Date(Date.now() - 60 * 86400000).toISOString();
      const { data: oldLogs, count: logCount } = await supabase.from('activity_logs').select('id', { count: 'exact' }).lt('created_at', cutoff60).limit(1);
      if (logCount && logCount > 100) {
        results.push({
          id: makeId(), category: 'stale', table: 'activity_logs',
          title: `~${logCount} gamla aktivitetsloggar (>60d)`,
          detail: 'Aktivitetsloggar äldre än 60 dagar som kan rensas',
          ids: [], autoCleanable: false,
        });
      }

      // ─── 5. Stale automation_logs older than 30 days ───
      setProgress(75);
      const cutoff30 = new Date(Date.now() - 30 * 86400000).toISOString();
      const { data: oldAutoLogs, count: autoLogCount } = await supabase.from('automation_logs').select('id', { count: 'exact' }).lt('created_at', cutoff30).limit(1);
      if (autoLogCount && autoLogCount > 50) {
        results.push({
          id: makeId(), category: 'stale', table: 'automation_logs',
          title: `~${autoLogCount} gamla automationsloggar (>30d)`,
          detail: 'Automationsloggar äldre än 30 dagar',
          ids: [], autoCleanable: false,
        });
      }

      // ─── 6. Duplicate scan results (same scan_type within 5min) ───
      setProgress(85);
      const { data: scans } = await supabase.from('ai_scan_results').select('id, scan_type, created_at').order('created_at', { ascending: false }).limit(100);
      if (scans && scans.length > 1) {
        const dupScans: string[] = [];
        for (let i = 1; i < scans.length; i++) {
          if (scans[i].scan_type === scans[i-1].scan_type) {
            const diff = new Date(scans[i-1].created_at).getTime() - new Date(scans[i].created_at).getTime();
            if (diff < 300000) dupScans.push(scans[i].id);
          }
        }
        if (dupScans.length > 0) {
          results.push({
            id: makeId(), category: 'duplicate', table: 'ai_scan_results',
            title: `${dupScans.length} duplicerade skanningar`,
            detail: 'Skanningar av samma typ inom 5 minuter',
            ids: dupScans, autoCleanable: true,
          });
        }
      }

      setProgress(100);
      setFindings(results);
      setLastRun(new Date().toISOString());

      if (results.length === 0) {
        toast.success('Systemet är rent — inget att städa!');
      } else {
        const total = results.reduce((s, f) => s + f.ids.length, 0);
        toast.info(`Hittade ${results.length} problem med ~${total} objekt`);
      }
    } catch (err: any) {
      toast.error(`Skanningsfel: ${err?.message || 'Okänt fel'}`);
    } finally {
      setScanning(false);
    }
  }, []);

  const autoClean = useCallback(async () => {
    setCleaning(true);
    let totalCleaned = 0;

    for (const finding of findings.filter(f => f.autoCleanable && f.ids.length > 0)) {
      try {
        if (finding.category === 'duplicate' && finding.table === 'bug_reports') {
          // Mark duplicates as resolved
          for (const id of finding.ids) {
            await supabase.from('bug_reports').update({ status: 'duplicate', resolution_notes: 'Auto-rensad: duplicat' }).eq('id', id);
            totalCleaned++;
          }
        } else if (finding.category === 'orphan' && finding.table === 'work_items') {
          // Mark orphans as cancelled
          for (const id of finding.ids) {
            await (supabase.from('work_items' as any) as any).update({ status: 'cancelled', resolution_notes: 'Auto-rensad: källa saknas' }).eq('id', id);
            totalCleaned++;
          }
        } else if (finding.category === 'outdated' && finding.table === 'bug_reports') {
          // Already resolved — just mark as cleaned (no delete, keep history)
          totalCleaned += finding.ids.length;
        } else if (finding.category === 'duplicate' && finding.table === 'ai_scan_results') {
          for (const id of finding.ids) {
            await supabase.from('ai_scan_results').delete().eq('id', id);
            totalCleaned++;
          }
        }
      } catch (err) {
      }
    }

    setCleaned(totalCleaned);
    queryClient.invalidateQueries({ queryKey: ['system-trust-score'] });
    queryClient.invalidateQueries({ queryKey: ['workbench-stats'] });
    toast.success(`Auto-rensning klar — ${totalCleaned} objekt hanterade`);
    setCleaning(false);
  }, [findings, queryClient]);

  const stats = {
    duplicates: findings.filter(f => f.category === 'duplicate').reduce((s, f) => s + f.ids.length, 0),
    orphans: findings.filter(f => f.category === 'orphan').reduce((s, f) => s + f.ids.length, 0),
    stale: findings.filter(f => f.category === 'stale').reduce((s, f) => s + (f.ids.length || 1), 0),
    outdated: findings.filter(f => f.category === 'outdated').reduce((s, f) => s + f.ids.length, 0),
  };
  const totalIssues = stats.duplicates + stats.orphans + stats.stale + stats.outdated;
  const cleanableCount = findings.filter(f => f.autoCleanable).reduce((s, f) => s + f.ids.length, 0);

  const catConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
    duplicate: { label: 'Duplicat', color: 'text-blue-500', icon: GitMerge },
    orphan: { label: 'Föräldralösa', color: 'text-orange-500', icon: AlertTriangle },
    stale: { label: 'Inaktiva', color: 'text-yellow-600', icon: Clock },
    outdated: { label: 'Föråldrade', color: 'text-muted-foreground', icon: History },
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardContent className="py-5 space-y-3">
          <div className="flex items-center gap-2">
            <Wrench className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">Auto Cleanup System</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Skannar efter duplicerade buggar, föräldralösa uppgifter, gamla loggar och föråldrade problem — rensar automatiskt det som är säkert.
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <Button onClick={scan} disabled={scanning || cleaning} size="sm" className="gap-1.5">
              {scanning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Radar className="w-3.5 h-3.5" />}
              Skanna system
            </Button>
            {findings.length > 0 && cleanableCount > 0 && (
              <Button onClick={autoClean} disabled={cleaning || scanning} size="sm" variant="destructive" className="gap-1.5">
                {cleaning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wrench className="w-3.5 h-3.5" />}
                Rensa {cleanableCount} objekt
              </Button>
            )}
            {lastRun && (
              <span className="text-[10px] text-muted-foreground ml-auto">
                Senast: {new Date(lastRun).toLocaleString('sv-SE')}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Progress */}
      {scanning && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><Loader2 className="w-3 h-3 animate-spin" />Skannar…</span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      )}

      {/* Cleaned banner */}
      {cleaned > 0 && (
        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="py-3 flex items-center gap-2 text-sm text-green-700">
            <CheckCircle className="w-4 h-4" /> {cleaned} objekt rensade
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      {findings.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {([
            { key: 'duplicates', label: 'Duplicat', value: stats.duplicates, icon: GitMerge, color: 'text-blue-500' },
            { key: 'orphans', label: 'Föräldralösa', value: stats.orphans, icon: AlertTriangle, color: 'text-orange-500' },
            { key: 'stale', label: 'Inaktiva', value: stats.stale, icon: Clock, color: 'text-yellow-600' },
            { key: 'outdated', label: 'Föråldrade', value: stats.outdated, icon: History, color: 'text-muted-foreground' },
          ] as const).map(s => (
            <Card key={s.key}>
              <CardContent className="p-3 flex items-center gap-2">
                <s.icon className={cn('w-4 h-4', s.color)} />
                <div>
                  <p className="text-lg font-bold leading-none">{s.value}</p>
                  <p className="text-[10px] text-muted-foreground">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Findings list */}
      {findings.length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="w-4 h-4" />
              {findings.length} problem hittade ({totalIssues} objekt)
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <ScrollArea className="max-h-[50vh]">
              <div className="space-y-2 pr-2">
                {findings.map(f => {
                  const cc = catConfig[f.category];
                  const CIcon = cc?.icon || AlertTriangle;
                  return (
                    <div key={f.id} className={cn(
                      'border rounded-lg p-3 space-y-1',
                      f.autoCleanable ? 'border-primary/20' : 'border-border'
                    )}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <CIcon className={cn('w-4 h-4', cc?.color)} />
                          <span className="text-sm font-medium">{f.title}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline" className="text-[10px]">{f.table}</Badge>
                          {f.autoCleanable && (
                            <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary">Auto</Badge>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">{f.detail}</p>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {!scanning && findings.length === 0 && !lastRun && (
        <Card>
          <CardContent className="py-12 text-center">
            <Wrench className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">Auto Cleanup System</p>
            <p className="text-xs text-muted-foreground/70 mt-1 max-w-md mx-auto">
              Hittar och rensar duplicerade buggar, föräldralösa uppgifter, inaktiva work items och gamla loggar för ett rent och snabbt system.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

// ── Auto-Fix Engine Tab ──
