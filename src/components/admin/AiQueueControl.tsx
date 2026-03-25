import { useAiQueueStore, type QueueTask, type QueueTaskPriority, type QueueTaskStatus } from '@/stores/aiQueueStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import {
  Play, Pause, RotateCcw, Trash2, AlertTriangle, CheckCircle,
  XCircle, Clock, Zap, ArrowUp, Loader2, Ban, Layers,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const statusConfig: Record<QueueTaskStatus, { label: string; color: string; icon: React.ElementType }> = {
  queued: { label: 'Köad', color: 'bg-muted text-muted-foreground', icon: Clock },
  running: { label: 'Körs', color: 'bg-primary/15 text-primary', icon: Loader2 },
  completed: { label: 'Klar', color: 'bg-green-500/15 text-green-600', icon: CheckCircle },
  failed: { label: 'Misslyckad', color: 'bg-destructive/15 text-destructive', icon: XCircle },
  blocked: { label: 'Blockerad', color: 'bg-orange-500/15 text-orange-600', icon: Ban },
};

const priorityConfig: Record<QueueTaskPriority, { label: string; color: string; icon: React.ElementType }> = {
  critical: { label: 'Kritisk', color: 'bg-destructive/15 text-destructive', icon: AlertTriangle },
  high: { label: 'Hög', color: 'bg-orange-500/15 text-orange-600', icon: ArrowUp },
  normal: { label: 'Normal', color: 'bg-muted text-muted-foreground', icon: Layers },
};

const TaskRow = ({ task }: { task: QueueTask }) => {
  const { retryTask, removeTask, cancelTask } = useAiQueueStore();
  const sc = statusConfig[task.status];
  const pc = priorityConfig[task.priority];
  const StatusIcon = sc.icon;

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card hover:bg-accent/30 transition-colors">
      <div className={cn('mt-0.5 w-7 h-7 rounded-md flex items-center justify-center shrink-0', sc.color)}>
        <StatusIcon className={cn('w-4 h-4', task.status === 'running' && 'animate-spin')} />
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
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {(task.status === 'failed' || task.status === 'blocked') && (
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => retryTask(task.id)}>
            <RotateCcw className="w-3.5 h-3.5" />
          </Button>
        )}
        {task.status === 'queued' && (
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => cancelTask(task.id)}>
            <Pause className="w-3.5 h-3.5" />
          </Button>
        )}
        {(task.status === 'completed' || task.status === 'failed' || task.status === 'blocked') && (
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => removeTask(task.id)}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
};

const AiQueueControl = () => {
  const { tasks, maxConcurrent, clearCompleted, addTask, processQueue } = useAiQueueStore();

  const running = tasks.filter((t) => t.status === 'running');
  const queued = tasks.filter((t) => t.status === 'queued');
  const blocked = tasks.filter((t) => t.status === 'blocked');
  const completed = tasks.filter((t) => t.status === 'completed');
  const failed = tasks.filter((t) => t.status === 'failed');

  const totalDone = completed.length + failed.length;
  const totalAll = tasks.length;
  const progress = totalAll > 0 ? Math.round((totalDone / totalAll) * 100) : 0;

  const addDemoTasks = () => {
    const id1 = addTask({ title: 'Systemhälsoskanning', priority: 'critical', description: 'Kontrollerar hela systemets hälsa' });
    const id2 = addTask({ title: 'Databasintegritet', priority: 'high', description: 'Verifiera datakonsistens', dependsOn: [id1] });
    addTask({ title: 'UX-analys', priority: 'normal', description: 'Analysera användarupplevelse' });
    addTask({ title: 'Prestandaoptimering', priority: 'normal', description: 'Optimera långsamma frågor', dependsOn: [id2] });
    toast.success('4 demo-uppgifter tillagda i kön');
  };

  return (
    <div className="space-y-4">
      {/* Status overview */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {[
          { label: 'Körs', count: running.length, max: maxConcurrent, color: 'text-primary', icon: Play },
          { label: 'Köade', count: queued.length, color: 'text-muted-foreground', icon: Clock },
          { label: 'Blockerade', count: blocked.length, color: 'text-orange-500', icon: Ban },
          { label: 'Klara', count: completed.length, color: 'text-green-500', icon: CheckCircle },
          { label: 'Misslyckade', count: failed.length, color: 'text-destructive', icon: XCircle },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-3 flex items-center gap-2">
              <s.icon className={cn('w-4 h-4', s.color)} />
              <div>
                <p className="text-lg font-bold leading-none">
                  {s.count}
                  {'max' in s && <span className="text-xs font-normal text-muted-foreground">/{s.max}</span>}
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
          <Zap className="w-3.5 h-3.5" />
          Demo-uppgifter
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
          Max {maxConcurrent} parallella
        </div>
      </div>

      {/* Running tasks */}
      {running.length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Loader2 className="w-4 h-4 text-primary animate-spin" />
              Körs nu ({running.length}/{maxConcurrent})
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 space-y-2">
            {running.map((t) => <TaskRow key={t.id} task={t} />)}
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

      {/* Completed / Failed */}
      {(completed.length > 0 || failed.length > 0) && (
        <Card>
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              Historik ({totalDone})
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <ScrollArea className="max-h-[30vh]">
              <div className="space-y-2 pr-2">
                {[...failed, ...completed].map((t) => <TaskRow key={t.id} task={t} />)}
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
            <p className="text-xs text-muted-foreground/70 mt-1">
              Uppgifter som läggs till körs automatiskt med max {maxConcurrent} parallellt
            </p>
            <Button size="sm" variant="outline" onClick={addDemoTasks} className="mt-4 gap-1.5 text-xs">
              <Zap className="w-3.5 h-3.5" />
              Lägg till demo-uppgifter
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AiQueueControl;
