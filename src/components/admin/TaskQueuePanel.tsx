import { useAiQueueStore, type QueueTask, type QueueTaskPriority, type QueueTaskStatus, type FailureReport, type RegressionEntry } from '@/stores/taskQueueStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import {
  Play, Pause, RotateCcw, Trash2, AlertTriangle, CheckCircle,
  XCircle, Clock, Zap, ArrowUp, Loader2, Ban, Layers,
  ShieldCheck, FileWarning, ChevronDown, ChevronUp, Undo2, GitBranch,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useState } from 'react';

const statusConfig: Record<QueueTaskStatus, { label: string; color: string; icon: React.ElementType }> = {
  queued: { label: 'Köad', color: 'bg-muted text-muted-foreground', icon: Clock },
  running: { label: 'Körs', color: 'bg-primary/15 text-primary', icon: Loader2 },
  validating: { label: 'Validerar', color: 'bg-accent text-accent-foreground', icon: ShieldCheck },
  completed: { label: 'Klar', color: 'bg-green-500/15 text-green-600', icon: CheckCircle },
  failed: { label: 'Misslyckad', color: 'bg-destructive/15 text-destructive', icon: XCircle },
  blocked: { label: 'Blockerad', color: 'bg-orange-500/15 text-orange-600', icon: Ban },
  regressed: { label: 'Regression', color: 'bg-purple-500/15 text-purple-600', icon: Undo2 },
};

const priorityConfig: Record<QueueTaskPriority, { label: string; color: string; icon: React.ElementType }> = {
  critical: { label: 'Kritisk', color: 'bg-destructive/15 text-destructive', icon: AlertTriangle },
  high: { label: 'Hög', color: 'bg-orange-500/15 text-orange-600', icon: ArrowUp },
  normal: { label: 'Normal', color: 'bg-muted text-muted-foreground', icon: Layers },
};

const FailureReportCard = ({ report }: { report: FailureReport }) => {
  const [expanded, setExpanded] = useState(false);
  const failedCount = report.checks.filter((c) => !c.passed).length;
  const passedCount = report.checks.filter((c) => c.passed).length;

  return (
    <div className="border border-destructive/30 rounded-lg p-3 bg-destructive/5 space-y-2">
      <button onClick={() => setExpanded(!expanded)} className="w-full text-left">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-destructive flex items-center gap-1.5">
              <FileWarning className="w-3.5 h-3.5 shrink-0" />
              {report.what}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              <span className="font-medium">Var:</span> {report.where}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant="outline" className="text-[10px] bg-destructive/10 text-destructive border-destructive/20">
              {failedCount} fel
            </Badge>
            {passedCount > 0 && (
              <Badge variant="outline" className="text-[10px] bg-green-500/10 text-green-600 border-green-500/20">
                {passedCount} ok
              </Badge>
            )}
            {expanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
          </div>
        </div>
      </button>

      {expanded && (
        <div className="space-y-2 pt-1 border-t border-destructive/10">
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Orsak</p>
            <p className="text-xs text-foreground">{report.why}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Kontroller</p>
            <div className="space-y-1">
              {report.checks.map((c, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  {c.passed ? (
                    <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0">
                    <span className={cn('font-medium', c.passed ? 'text-green-600' : 'text-destructive')}>
                      {c.name}
                    </span>
                    {c.detail && <p className="text-muted-foreground text-[11px] mt-0.5">{c.detail}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground/60">{new Date(report.timestamp).toLocaleString('sv-SE')}</p>
        </div>
      )}
    </div>
  );
};

const RegressionCard = ({ entry }: { entry: RegressionEntry }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-purple-500/30 rounded-lg p-3 bg-purple-500/5 space-y-1">
      <button onClick={() => setExpanded(!expanded)} className="w-full text-left">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Undo2 className="w-3.5 h-3.5 text-purple-500 shrink-0" />
            <span className="text-sm font-medium truncate">{entry.taskTitle}</span>
            <Badge variant="outline" className="text-[10px] bg-purple-500/10 text-purple-600 border-purple-500/20 shrink-0">
              {entry.affectedKey}
            </Badge>
            {entry.reopened && (
              <Badge variant="outline" className="text-[10px] bg-destructive/10 text-destructive border-destructive/20 shrink-0">
                Återöppnad
              </Badge>
            )}
          </div>
          {expanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
        </div>
      </button>
      {expanded && (
        <div className="space-y-2 pt-2 border-t border-purple-500/10 mt-1">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">Före</p>
              <pre className="text-[11px] bg-muted/50 p-1.5 rounded text-foreground overflow-x-auto max-h-20">
                {JSON.stringify(entry.previousValue, null, 2)?.slice(0, 200)}
              </pre>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">Efter</p>
              <pre className="text-[11px] bg-muted/50 p-1.5 rounded text-foreground overflow-x-auto max-h-20">
                {JSON.stringify(entry.currentValue, null, 2)?.slice(0, 200)}
              </pre>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground/60">{new Date(entry.detectedAt).toLocaleString('sv-SE')}</p>
        </div>
      )}
    </div>
  );
};

const TaskRow = ({ task }: { task: QueueTask }) => {
  const { retryTask, removeTask, cancelTask } = useAiQueueStore();
  const [showReport, setShowReport] = useState(false);
  const sc = statusConfig[task.status];
  const pc = priorityConfig[task.priority];
  const StatusIcon = sc.icon;

  return (
    <div className="space-y-0">
      <div className={cn(
        'flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/30 transition-colors',
        task.status === 'regressed' ? 'border-purple-500/30' : 'border-border'
      )}>
        <div className={cn('mt-0.5 w-7 h-7 rounded-md flex items-center justify-center shrink-0', sc.color)}>
          <StatusIcon className={cn('w-4 h-4', (task.status === 'running' || task.status === 'validating') && 'animate-spin')} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm truncate">{task.title}</span>
            <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', pc.color)}>
              <pc.icon className="w-2.5 h-2.5 mr-0.5" />
              {pc.label}
            </Badge>
            <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', sc.color)}>
              {sc.label}
            </Badge>
          </div>
          {task.description && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{task.description}</p>
          )}
          {task.error && (
            <p className="text-xs text-destructive mt-1 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 shrink-0" />
              {task.error}
            </p>
          )}
          {task.dependsOn && task.dependsOn.length > 0 && (
            <p className="text-[10px] text-muted-foreground/70 mt-0.5">
              Beroende: {task.dependsOn.join(', ')}
            </p>
          )}
          {task.failureReport && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-[11px] text-destructive mt-1 px-2 gap-1"
              onClick={() => setShowReport(!showReport)}
            >
              <FileWarning className="w-3 h-3" />
              {showReport ? 'Dölj rapport' : task.status === 'regressed' ? 'Visa regressionsrapport' : 'Visa felrapport'}
            </Button>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {(task.status === 'failed' || task.status === 'blocked' || task.status === 'regressed') && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => retryTask(task.id)}>
              <RotateCcw className="w-3.5 h-3.5" />
            </Button>
          )}
          {task.status === 'queued' && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => cancelTask(task.id)}>
              <Pause className="w-3.5 h-3.5" />
            </Button>
          )}
          {(task.status === 'completed' || task.status === 'failed' || task.status === 'blocked' || task.status === 'regressed') && (
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => removeTask(task.id)}>
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>
      {showReport && task.failureReport && (
        <div className="ml-10 mt-1">
          <FailureReportCard report={task.failureReport} />
        </div>
      )}
    </div>
  );
};

const TaskQueuePanel = () => {
  const { tasks, maxConcurrent, clearCompleted, addTask, processQueue, failureLog, clearFailureLog, regressionLog, clearRegressionLog } = useAiQueueStore();

  const running = tasks.filter((t) => t.status === 'running' || t.status === 'validating');
  const queued = tasks.filter((t) => t.status === 'queued');
  const blocked = tasks.filter((t) => t.status === 'blocked');
  const completed = tasks.filter((t) => t.status === 'completed');
  const failed = tasks.filter((t) => t.status === 'failed');
  const regressed = tasks.filter((t) => t.status === 'regressed');

  const totalDone = completed.length + failed.length + regressed.length;
  const totalAll = tasks.length;
  const progress = totalAll > 0 ? Math.round((totalDone / totalAll) * 100) : 0;

  const addDemoTasks = () => {
    // Simulated state for regression detection
    let simulatedState = { userCount: 42, errorRate: 0.02, uiLoaded: true, dataIntact: true };

    const id1 = addTask({
      title: 'Systemhälsoskanning',
      priority: 'critical',
      description: 'Kontrollerar hela systemets hälsa',
      executor: async () => ({ status: 'ok', score: 92 }),
      validator: async (result) => [
        { name: 'Resultat finns', passed: !!result },
        { name: 'Hälsopoäng > 50', passed: result?.score > 50 },
      ],
    });

    const id2 = addTask({
      title: 'Buggfix: Felhantering',
      priority: 'high',
      description: 'Fixar error-rate i checkout',
      dependsOn: [id1],
      executor: async () => {
        // Simulate: fix reduces error rate but accidentally breaks userCount
        simulatedState = { ...simulatedState, errorRate: 0.001, userCount: 0 };
        return { fixed: true };
      },
      snapshotBefore: async () => ({ ...simulatedState }),
      snapshotAfter: async () => ({ ...simulatedState }),
      guardKeys: ['userCount', 'uiLoaded', 'dataIntact'],
      expectChangedKeys: ['errorRate'],
      validator: async (result) => [
        { name: 'Fix applicerad', passed: !!result?.fixed },
      ],
    });

    addTask({
      title: 'Prestandaoptimering',
      priority: 'normal',
      description: 'Optimera databas-frågor',
      dependsOn: [id2],
      executor: async () => ({ optimized: true }),
    });

    addTask({
      title: 'UX-förbättring',
      priority: 'normal',
      description: 'Förbättra mobilvy',
      executor: async () => ({ improved: true }),
    });

    toast.success('4 demo-uppgifter med regressionsdetektering tillagda');
  };

  return (
    <div className="space-y-4">
      {/* Status overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        {[
          { label: 'Körs', count: running.length, max: maxConcurrent, color: 'text-primary', icon: Play },
          { label: 'Köade', count: queued.length, color: 'text-muted-foreground', icon: Clock },
          { label: 'Blockerade', count: blocked.length, color: 'text-orange-500', icon: Ban },
          { label: 'Klara', count: completed.length, color: 'text-green-500', icon: CheckCircle },
          { label: 'Misslyckade', count: failed.length, color: 'text-destructive', icon: XCircle },
          { label: 'Regressioner', count: regressed.length, color: 'text-purple-500', icon: Undo2 },
          { label: 'Felloggar', count: failureLog.length + regressionLog.length, color: 'text-destructive', icon: FileWarning },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-3 flex items-center gap-2">
              <s.icon className={cn('w-4 h-4', s.color)} />
              <div>
                <p className="text-lg font-bold leading-none">
                  {s.count}
                  {'max' in s && typeof (s as any).max === 'number' && (
                    <span className="text-xs font-normal text-muted-foreground">/{(s as any).max}</span>
                  )}
                </p>
                <p className="text-[10px] text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Progress bar */}
      {totalAll > 0 && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Framsteg</span>
            <span>{totalDone}/{totalAll} ({progress}%)</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button size="sm" variant="outline" onClick={addDemoTasks} className="gap-1.5 text-xs">
          <GitBranch className="w-3.5 h-3.5" />
          Demo (med regression)
        </Button>
        <Button size="sm" variant="outline" onClick={() => processQueue()} className="gap-1.5 text-xs">
          <Play className="w-3.5 h-3.5" />
          Kör kö
        </Button>
        {completed.length > 0 && (
          <Button size="sm" variant="ghost" onClick={clearCompleted} className="gap-1.5 text-xs">
            <Trash2 className="w-3.5 h-3.5" />
            Rensa klara
          </Button>
        )}
        <div className="ml-auto text-[10px] text-muted-foreground">
          Max {maxConcurrent} parallella · Validering + Regression aktiv
        </div>
      </div>

      {/* Running tasks */}
      {running.length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Loader2 className="w-4 h-4 text-primary animate-spin" />
              Körs / Validerar ({running.length}/{maxConcurrent})
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 space-y-2">
            {running.map((t) => <TaskRow key={t.id} task={t} />)}
          </CardContent>
        </Card>
      )}

      {/* Regressed tasks */}
      {regressed.length > 0 && (
        <Card className="border-purple-500/30">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2 text-purple-600">
              <Undo2 className="w-4 h-4" />
              Regressioner ({regressed.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <ScrollArea className="max-h-[35vh]">
              <div className="space-y-2 pr-2">
                {regressed.map((t) => <TaskRow key={t.id} task={t} />)}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Failed tasks */}
      {failed.length > 0 && (
        <Card className="border-destructive/30">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2 text-destructive">
              <XCircle className="w-4 h-4" />
              Misslyckade ({failed.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <ScrollArea className="max-h-[35vh]">
              <div className="space-y-2 pr-2">
                {failed.map((t) => <TaskRow key={t.id} task={t} />)}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Blocked tasks */}
      {blocked.length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Ban className="w-4 h-4 text-orange-500" />
              Blockerade ({blocked.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <ScrollArea className="max-h-[30vh]">
              <div className="space-y-2 pr-2">
                {blocked.map((t) => <TaskRow key={t.id} task={t} />)}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Queued tasks */}
      {queued.length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              Kö ({queued.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <ScrollArea className="max-h-[30vh]">
              <div className="space-y-2 pr-2">
                {queued.map((t) => <TaskRow key={t.id} task={t} />)}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Regression Log */}
      {regressionLog.length > 0 && (
        <Card className="border-purple-500/20">
          <CardHeader className="pb-2 pt-3 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2 text-purple-600">
                <GitBranch className="w-4 h-4" />
                Regressionslogg ({regressionLog.length})
              </CardTitle>
              <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" onClick={clearRegressionLog}>
                <Trash2 className="w-3 h-3 mr-1" />
                Rensa
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <ScrollArea className="max-h-[40vh]">
              <div className="space-y-2 pr-2">
                {[...regressionLog].reverse().map((r, i) => <RegressionCard key={i} entry={r} />)}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Failure Log */}
      {failureLog.length > 0 && (
        <Card className="border-destructive/20">
          <CardHeader className="pb-2 pt-3 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2 text-destructive">
                <FileWarning className="w-4 h-4" />
                Feldetekteringslogg ({failureLog.length})
              </CardTitle>
              <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" onClick={clearFailureLog}>
                <Trash2 className="w-3 h-3 mr-1" />
                Rensa
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <ScrollArea className="max-h-[40vh]">
              <div className="space-y-2 pr-2">
                {[...failureLog].reverse().map((r, i) => <FailureReportCard key={i} report={r} />)}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Completed */}
      {completed.length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              Klara ({completed.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <ScrollArea className="max-h-[30vh]">
              <div className="space-y-2 pr-2">
                {completed.map((t) => <TaskRow key={t.id} task={t} />)}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {tasks.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Layers className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">Kön är tom</p>
            <p className="text-xs text-muted-foreground/70 mt-1 max-w-md mx-auto">
              Varje uppgift valideras och jämförs mot sitt tidigare tillstånd efter exekvering.
              Om en fix bryter något annat detekteras det som regression — uppgiften återöppnas och beroende uppgifter stoppas.
            </p>
            <Button size="sm" variant="outline" onClick={addDemoTasks} className="mt-4 gap-1.5 text-xs">
              <GitBranch className="w-3.5 h-3.5" />
              Testa med regressionsdetektering
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default TaskQueuePanel;
