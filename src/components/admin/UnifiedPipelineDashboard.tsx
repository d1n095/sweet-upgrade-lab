import { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import {
  Play, Loader2, CheckCircle, XCircle,
  FileSearch, Bug, ClipboardList, Database, ShieldCheck,
  ArrowRight, Activity, Trash2, ChevronDown, ChevronRight,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { runUnifiedPipeline, type PipelineRun, type PipelineEvent, type PipelineStage } from '@/lib/unifiedPipeline';
import { usePipelineStore, getPrioritized, type PipelineStatus } from '@/stores/pipelineStore';
import { toast } from 'sonner';

const stageConfig: Record<PipelineStage, { label: string; icon: React.ElementType; color: string }> = {
  scan: { label: 'Skanning', icon: FileSearch, color: 'text-blue-500' },
  issues: { label: 'Buggar → Work Items', icon: Bug, color: 'text-orange-500' },
  work_items: { label: 'Work Items → Logg', icon: ClipboardList, color: 'text-purple-500' },
  change_log: { label: 'Logg → Bugg-matchning', icon: Database, color: 'text-primary' },
  verification: { label: 'Verifiering', icon: ShieldCheck, color: 'text-green-500' },
};

const STAGES: PipelineStage[] = ['scan', 'issues', 'work_items', 'change_log', 'verification'];

const ACTION_LABELS: Record<string, string> = {
  log_exists: 'Ändringslogg finns redan',
  bug_already_resolved: 'Bugg redan löst',
  auto_linked: 'Automatiskt länkad',
  already_linked: 'Redan länkad',
  link_failed: 'Länkning misslyckades',
  log_created: 'Ändringslogg skapad',
  bug_resolved: 'Bugg löst',
  check: 'Kontroll',
  gap_detected: 'Lucka detekterad',
  ai_review: 'AI-granskning',
  review_error: 'Granskningsfel',
  blocked: 'Blockerad',
  pipeline_error: 'Pipeline-fel',
};

const UnifiedPipelineDashboard = () => {
  const [running, setRunning] = useState(false);
  const [run, setRun] = useState<PipelineRun | null>(null);
  const [liveEvents, setLiveEvents] = useState<PipelineEvent[]>([]);
  const [progress, setProgress] = useState(0);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  const { workItems, updateStatus, clearDone } = usePipelineStore();
  const prioritized = getPrioritized(workItems);

  const execute = useCallback(async () => {
    setRunning(true);
    setLiveEvents([]);
    setProgress(0);
    setExpandedIdx(null);

    const result = await runUnifiedPipeline((event) => {
      setLiveEvents(prev => {
        const next = [...prev, event];
        return next;
      });
      // Estimate progress by stage
      const stageIdx = STAGES.indexOf(event.stage);
      setProgress(Math.min(95, ((stageIdx + 1) / STAGES.length) * 100));
    });

    setProgress(100);
    setRun(result);
    setRunning(false);

    const totalErrors = Object.values(result.stats).reduce((s, v) => s + v.errors, 0);
    const totalLinked = Object.values(result.stats).reduce((s, v) => s + v.linked, 0);

    if (totalErrors > 0) {
      toast.warning(`Pipeline klar — ${totalLinked} länkade, ${totalErrors} fel`);
    } else {
      toast.success(`Pipeline klar — ${totalLinked} kopplingar verifierade/skapade`);
    }
  }, []);

  const events = run ? run.events : liveEvents;
  const stats = run?.stats;

  useEffect(() => {
    if (events.length === 0 && !running) {
      console.log('LOGS:', events);
    }
  }, [events, running]);

  return (
    <div className="space-y-4">
      {/* Pipeline visualization */}
      <Card>
        <CardContent className="py-5">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">Unified Pipeline</h3>
            <span className="text-xs text-muted-foreground ml-auto">
              scan → issues → work items → change log → verification
            </span>
          </div>

          {/* Stage flow */}
          <div className="flex items-center gap-1 overflow-x-auto pb-2">
            {STAGES.map((stage, i) => {
              const cfg = stageConfig[stage];
              const SIcon = cfg.icon;
              const stageStats = stats?.[stage];
              const hasErrors = stageStats && stageStats.errors > 0;
              const isActive = running && liveEvents.length > 0 &&
                liveEvents[liveEvents.length - 1]?.stage === stage;

              return (
                <div key={stage} className="flex items-center gap-1">
                  <div className={cn(
                    'flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-all',
                    isActive ? 'border-primary bg-primary/10 ring-2 ring-primary/20' :
                    hasErrors ? 'border-destructive/30 bg-destructive/5' :
                    stageStats && stageStats.processed > 0 ? 'border-green-500/30 bg-green-500/5' :
                    'border-border bg-card'
                  )}>
                    {isActive ? (
                      <Loader2 className={cn('w-3.5 h-3.5 animate-spin', cfg.color)} />
                    ) : (
                      <SIcon className={cn('w-3.5 h-3.5', cfg.color)} />
                    )}
                    <span className="whitespace-nowrap">{cfg.label}</span>
                    {stageStats && (
                      <div className="flex gap-1 ml-1">
                        {stageStats.linked > 0 && (
                          <Badge variant="secondary" className="text-[9px] px-1 h-4 bg-green-500/10 text-green-600">
                            {stageStats.linked}✓
                          </Badge>
                        )}
                        {stageStats.errors > 0 && (
                          <Badge variant="secondary" className="text-[9px] px-1 h-4 bg-destructive/10 text-destructive">
                            {stageStats.errors}✗
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                  {i < STAGES.length - 1 && (
                    <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
                  )}
                </div>
              );
            })}
          </div>

          {/* Progress */}
          {running && (
            <div className="mt-3 space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Loader2 className="w-3 h-3 animate-spin" /> Pipeline körs…
                </span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          {/* Controls */}
          <div className="flex items-center gap-2 mt-3">
            <Button size="sm" onClick={execute} disabled={running} className="gap-1.5 text-xs">
              {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
              {run ? 'Kör igen' : 'Kör pipeline'}
            </Button>
            {events.length > 0 && !running && (
              <Button size="sm" variant="ghost" onClick={() => { setRun(null); setLiveEvents([]); }} className="gap-1 text-xs">
                <Trash2 className="w-3.5 h-3.5" /> Rensa
              </Button>
            )}
            {run?.completedAt && (
              <span className="text-[10px] text-muted-foreground ml-auto">
                Klar: {new Date(run.completedAt).toLocaleString('sv-SE')}
                {' · '}{run.events.length} händelser
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Summary stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {STAGES.map(stage => {
            const cfg = stageConfig[stage];
            const s = stats[stage];
            const SIcon = cfg.icon;
            return (
              <Card key={stage}>
                <CardContent className="p-3 flex items-center gap-2">
                  <SIcon className={cn('w-4 h-4', cfg.color)} />
                  <div>
                    <p className="text-lg font-bold leading-none">{s.linked}<span className="text-xs font-normal text-muted-foreground">/{s.processed}</span></p>
                    <p className="text-[10px] text-muted-foreground">{cfg.label}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Event log */}
      {events.length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="w-4 h-4" /> Händelselogg ({events.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <ScrollArea className="max-h-[50vh]" style={{ pointerEvents: 'auto' }}>
              <div className="space-y-1.5 pr-2">
                {[...events].reverse().map((e, i) => {
                  const cfg = stageConfig[e.stage];
                  const SIcon = cfg.icon;
                  const isExpanded = expandedIdx === i;
                  const data = e.linkedIds && Object.keys(e.linkedIds).length > 0
                    ? e.linkedIds
                    : { raw: 'no data' };
                  const actionLabel = ACTION_LABELS[e.action] ?? e.action;
                  return (
                    <div
                      key={i}
                      style={{ pointerEvents: 'auto' }}
                      className={cn(
                        'border rounded-lg p-2.5 cursor-pointer select-none transition-colors',
                        e.success ? 'border-border hover:bg-secondary/30' : 'border-destructive/30 bg-destructive/5 hover:bg-destructive/10'
                      )}
                      onClick={() => {
                        console.log('🧪 LOG CLICK:', e);
                        setExpandedIdx(isExpanded ? null : i);
                      }}
                    >
                      <div className="flex items-start gap-2">
                        <SIcon className={cn('w-4 h-4 mt-0.5 shrink-0', cfg.color)} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Badge variant="outline" className={cn('text-[9px]', cfg.color)}>{cfg.label}</Badge>
                            <Badge variant="outline" className="text-[9px]">{actionLabel}</Badge>
                            {e.success ? (
                              <CheckCircle className="w-3 h-3 text-green-500" />
                            ) : (
                              <XCircle className="w-3 h-3 text-destructive" />
                            )}
                            <span className="text-[10px] text-muted-foreground ml-auto flex items-center gap-1">
                              {new Date(e.timestamp).toLocaleTimeString('sv-SE')}
                              {isExpanded
                                ? <ChevronDown className="w-3 h-3" />
                                : <ChevronRight className="w-3 h-3" />}
                            </span>
                          </div>
                          <p className="text-xs text-foreground mt-0.5">{e.detail}</p>
                        </div>
                      </div>
                      {isExpanded && (
                        <div className="mt-2 pt-2 border-t border-border/50">
                          <pre className="text-[10px] font-mono bg-muted/40 rounded p-2 overflow-x-auto whitespace-pre-wrap break-all">
                            {JSON.stringify(data, null, 2)}
                          </pre>
                          <div className="flex gap-1 mt-1 flex-wrap">
                            {Object.entries(data).map(([k, v]) => (
                              <Badge key={k} variant="secondary" className="text-[8px] font-mono">
                                {k}: {String(v).slice(0, 12)}{String(v).length > 12 ? '…' : ''}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {!running && events.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Activity className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">Unified Pipeline</p>
            <p className="text-xs text-muted-foreground/70 mt-1 max-w-md mx-auto">
              Kopplar ihop alla system: skanningar genererar issues, issues skapar work items,
              slutförda items loggas i ändringsloggen, loggar matchas mot buggar, och allt verifieras av AI.
            </p>
            <Button size="sm" onClick={execute} className="mt-4 gap-1.5 text-xs">
              <Play className="w-3.5 h-3.5" /> Starta pipeline
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Pipeline Work Items */}
      {prioritized.length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Bug className="w-4 h-4 text-orange-500" />
              Pipeline Work Items ({prioritized.length})
              {prioritized.filter(i => i.status === 'new').length > 0 && (
                <Badge variant="destructive" className="text-[9px] ml-1">
                  {prioritized.filter(i => i.status === 'new').length} nya
                </Badge>
              )}
              <Button size="sm" variant="ghost" className="ml-auto text-[10px] h-6 px-2" onClick={clearDone}>
                <Trash2 className="w-3 h-3 mr-1" /> Rensa klara
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <ScrollArea className="max-h-[40vh]">
              <div className="space-y-1.5 pr-2">
                {prioritized.map(item => {
                  const severityColor = item.severity === 'high' ? 'text-destructive' :
                    item.severity === 'medium' ? 'text-orange-500' : 'text-muted-foreground';
                  const statusNext: Record<string, { label: string; next: PipelineStatus }> = {
                    new: { label: 'Starta', next: 'in_progress' },
                    in_progress: { label: 'Klar', next: 'done' },
                    done: { label: 'Avfärda', next: 'dismissed' },
                    dismissed: { label: 'Återöppna', next: 'new' },
                  };
                  const action = statusNext[item.status];
                  return (
                    <div key={item.id} className={cn(
                      'border rounded-lg p-2.5 flex items-start gap-2',
                      item.status === 'done' || item.status === 'dismissed' ? 'opacity-50' : '',
                      item.severity === 'high' ? 'border-destructive/30 bg-destructive/5' : 'border-border',
                    )}>
                      <AlertTriangle className={cn('w-3.5 h-3.5 mt-0.5 shrink-0', severityColor)} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1 flex-wrap">
                          <Badge variant="outline" className={cn('text-[9px]', severityColor)}>{item.severity}</Badge>
                          <Badge variant="outline" className="text-[9px]">{item.status}</Badge>
                          <span className="text-[10px] text-muted-foreground ml-auto">
                            {new Date(item.createdAt).toLocaleTimeString('sv-SE')}
                          </span>
                        </div>
                        <p className="text-[11px] font-medium text-foreground mt-0.5 truncate">{item.file}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.message}</p>
                      </div>
                      {action && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-[10px] h-6 px-2 shrink-0"
                          onClick={() => updateStatus(item.id, action.next)}
                        >
                          {action.label}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default UnifiedPipelineDashboard;
