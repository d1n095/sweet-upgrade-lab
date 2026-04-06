/**
 * AutomationPanel
 *
 * UI panel for the automation engine.
 * Shows automation tasks with status, value impact, controls, and log.
 *
 * NO backend calls. NO imports from scan/invoke/pipeline systems.
 * All execution goes via ExecutionEngine through AutomationScheduler.
 */
import { useState, useEffect, useCallback } from 'react';
import {
  buildAutomationTasks,
  updateTaskStatus,
  type AutomationTask,
  type TaskStatus,
} from './AutomationEngine';
import {
  setSchedulerTasks,
  setSchedulerEnabled,
  onSchedulerTasksChange,
  runSchedulerNow,
  getSchedulerStatus,
  getAutomationLog,
  clearAutomationLog,
  type AutomationLogEntry,
} from './AutomationScheduler';
import { executeAction, rollbackExecution } from '../actions/ExecutionEngine';
import type { SystemAction, FixResult } from '../actions/AutoFixEngine';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  CheckCircle2,
  XCircle,
  Clock,
  Play,
  RotateCcw,
  Zap,
  Trash2,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Value icons ────────────────────────────────────────────────────────────────

const VALUE_EMOJI: Record<string, string> = {
  revenue: '🔥',
  ux: '👁',
  stability: '⚙',
};

// ── Props ──────────────────────────────────────────────────────────────────────

interface AutomationPanelProps {
  actions?: SystemAction[];
  fixResults?: FixResult[];
}

// ── Component ──────────────────────────────────────────────────────────────────

const AutomationPanel = ({ actions = [], fixResults = [] }: AutomationPanelProps) => {
  const [tasks, setTasks] = useState<AutomationTask[]>([]);
  const [log, setLog] = useState<AutomationLogEntry[]>([]);
  const [autoFixEnabled, setAutoFixEnabled] = useState(false);
  const [autoOptimizeEnabled, setAutoOptimizeEnabled] = useState(false);
  const [pendingManual, setPendingManual] = useState<AutomationTask | null>(null);
  // Track action_ids that have a rollback snapshot
  const [rollbackIds, setRollbackIds] = useState<Set<string>>(new Set());

  // ── Build tasks whenever inputs change ────────────────────────────────────────

  useEffect(() => {
    try {
      const built = buildAutomationTasks(actions, fixResults);
      setTasks(built);
      setSchedulerTasks(built);
    } catch {
      // never crash
    }
  }, [actions, fixResults]);

  // ── Sync scheduler task mutations back to component ───────────────────────────

  useEffect(() => {
    onSchedulerTasksChange((updated) => {
      setTasks([...updated]);
      setLog([...getAutomationLog()]);
    });
    return () => onSchedulerTasksChange(null);
  }, []);

  // ── Auto-fix toggle ────────────────────────────────────────────────────────────

  const handleAutoFixToggle = useCallback((checked: boolean) => {
    setAutoFixEnabled(checked);
    setSchedulerEnabled(checked);
  }, []);

  // ── Manual execute ─────────────────────────────────────────────────────────────

  const handleManualExecuteRequest = (task: AutomationTask) => {
    setPendingManual(task);
  };

  const handleManualExecuteConfirm = () => {
    if (!pendingManual) return;
    const task = pendingManual;
    setPendingManual(null);
    try {
      const result = executeAction(task.action, true);
      const status: TaskStatus = result.success ? 'done' : 'failed';
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? updateTaskStatus(t, status, result.message) : t)),
      );
      if (result.rollback_available) {
        setRollbackIds((prev) => new Set(prev).add(task.action_id));
      }
    } catch {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === task.id ? updateTaskStatus(t, 'failed', 'Unexpected error') : t,
        ),
      );
    }
  };

  const handleManualExecuteCancel = () => setPendingManual(null);

  // ── Rollback ───────────────────────────────────────────────────────────────────

  const handleRollback = (task: AutomationTask) => {
    try {
      const result = rollbackExecution(task.action_id);
      if (result.success) {
        setRollbackIds((prev) => {
          const next = new Set(prev);
          next.delete(task.action_id);
          return next;
        });
        setTasks((prev) =>
          prev.map((t) =>
            t.id === task.id ? updateTaskStatus(t, 'pending', 'Rolled back') : t,
          ),
        );
      }
    } catch {
      // never crash
    }
  };

  // ── Run now ────────────────────────────────────────────────────────────────────

  const handleRunNow = () => {
    try {
      runSchedulerNow();
      setLog([...getAutomationLog()]);
    } catch {
      // never crash
    }
  };

  const schedulerStatus = getSchedulerStatus();

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Automation Panel</span>
          <Badge variant="outline" className="text-[9px]">
            {tasks.length} tasks
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={handleRunNow}>
            <RefreshCw className="h-3 w-3" />
            Run now
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1"
            disabled={!log.length}
            onClick={() => { clearAutomationLog(); setLog([]); }}
          >
            <Trash2 className="h-3 w-3" />
            Clear log
          </Button>
        </div>
      </div>

      {/* Toggles */}
      <div className="flex flex-wrap gap-4 rounded-md border border-border/40 p-3 bg-muted/20">
        <div className="flex items-center gap-2">
          <Switch
            id="auto-fix-toggle"
            checked={autoFixEnabled}
            onCheckedChange={handleAutoFixToggle}
          />
          <Label htmlFor="auto-fix-toggle" className="text-xs cursor-pointer">
            Enable auto-fix
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            id="auto-optimize-toggle"
            checked={autoOptimizeEnabled}
            onCheckedChange={setAutoOptimizeEnabled}
          />
          <Label htmlFor="auto-optimize-toggle" className="text-xs cursor-pointer">
            Enable auto-optimize
          </Label>
        </div>
        {autoFixEnabled && (
          <Badge variant="outline" className="text-[9px] text-green-700 border-green-300 self-center">
            scheduler active · {schedulerStatus.pendingCount} pending
          </Badge>
        )}
      </div>

      {/* Task list */}
      {tasks.length === 0 ? (
        <p className="text-xs text-muted-foreground">No automation tasks. Provide actions to populate.</p>
      ) : (
        <ScrollArea className="h-[42vh]">
          <div className="space-y-1.5">
            {tasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                autoModeOn={autoFixEnabled || autoOptimizeEnabled}
                hasRollback={rollbackIds.has(task.action_id)}
                onExecute={() => handleManualExecuteRequest(task)}
                onRollback={() => handleRollback(task)}
              />
            ))}
          </div>
        </ScrollArea>
      )}

      {/* Automation log */}
      {log.length > 0 && (
        <>
          <Separator />
          <LogPanel entries={log} />
        </>
      )}

      {/* Confirmation dialog for manual execute */}
      <AlertDialog
        open={!!pendingManual}
        onOpenChange={(open) => !open && handleManualExecuteCancel()}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apply this fix?</AlertDialogTitle>
            <AlertDialogDescription>
              Action: <span className="font-medium">{pendingManual?.action.action}</span>
              {pendingManual?.action.component && (
                <span className="text-muted-foreground"> ({pendingManual.action.component})</span>
              )}
              <br />
              Risk: <span className="font-medium">{pendingManual?.risk_level}</span> ·
              Type: <span className="font-medium">{pendingManual?.fix_type}</span>
              <br />
              A rollback snapshot will be stored. No schema or core changes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleManualExecuteCancel}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleManualExecuteConfirm}>Execute Fix</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

// ── Sub-components ─────────────────────────────────────────────────────────────

interface TaskRowProps {
  task: AutomationTask;
  autoModeOn: boolean;
  hasRollback: boolean;
  onExecute: () => void;
  onRollback: () => void;
}

function TaskRow({ task, autoModeOn, hasRollback, onExecute, onRollback }: TaskRowProps) {
  const emoji = VALUE_EMOJI[task.value_impact.value_type] ?? '⚙';

  return (
    <Card className={cn('border-border/50', task.status === 'done' && 'opacity-70')}>
      <CardContent className="p-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Status icon */}
          <StatusIcon status={task.status} />

          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">
              {emoji} {task.action.action}
            </p>
            <p className="text-[10px] text-muted-foreground font-mono">{task.action.component}</p>
          </div>

          {/* Badges */}
          <RiskBadge risk={task.risk_level} />
          <Badge variant="outline" className="text-[9px]">{task.type}</Badge>
          <Badge
            variant="outline"
            className={cn(
              'text-[9px]',
              task.value_impact.impact === 'high' && 'text-red-700 border-red-300',
              task.value_impact.impact === 'medium' && 'text-amber-700 border-amber-400',
            )}
          >
            {task.value_impact.impact} {task.value_impact.value_type}
          </Badge>

          {/* Actions */}
          {task.status === 'pending' && task.execution_mode !== 'auto' && (
            <Button
              variant="default"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={onExecute}
            >
              <Play className="h-3 w-3" />
              Execute
            </Button>
          )}
          {task.status === 'pending' && task.execution_mode === 'auto' && !autoModeOn && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={onExecute}
            >
              <Play className="h-3 w-3" />
              Execute
            </Button>
          )}
          {hasRollback && task.status === 'done' && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1 text-amber-700 border-amber-400 hover:bg-amber-50"
              onClick={onRollback}
            >
              <RotateCcw className="h-3 w-3" />
              Rollback
            </Button>
          )}
        </div>

        {/* Result message */}
        {task.result_message && (
          <p className="text-[10px] text-muted-foreground mt-1 pl-5">{task.result_message}</p>
        )}
      </CardContent>
    </Card>
  );
}

function StatusIcon({ status }: { status: TaskStatus }) {
  if (status === 'done') return <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />;
  if (status === 'failed') return <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />;
  if (status === 'running') return <RefreshCw className="h-3.5 w-3.5 text-blue-500 shrink-0 animate-spin" />;
  if (status === 'skipped') return <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />;
  return <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />;
}

function RiskBadge({ risk }: { risk: 'low' | 'medium' | 'high' }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'text-[9px]',
        risk === 'low' && 'text-green-700 border-green-300',
        risk === 'medium' && 'text-amber-700 border-amber-400',
        risk === 'high' && 'text-destructive border-destructive/40',
      )}
    >
      {risk}
    </Badge>
  );
}

function LogPanel({ entries }: { entries: AutomationLogEntry[] }) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
        Automation Log
      </p>
      <ScrollArea className="h-[16vh]">
        <div className="space-y-0.5">
          {[...entries].reverse().map((entry) => (
            <div
              key={entry.id}
              className="flex items-center gap-2 text-[10px] px-1 py-0.5 rounded hover:bg-muted/50"
            >
              {entry.status === 'done'
                ? <CheckCircle2 className="h-3 w-3 shrink-0 text-green-500" />
                : <XCircle className="h-3 w-3 shrink-0 text-destructive" />}
              <span className="font-mono text-muted-foreground w-16 shrink-0 tabular-nums">
                {new Date(entry.ts).toLocaleTimeString('sv-SE')}
              </span>
              <span className="truncate flex-1">{entry.message}</span>
              {entry.rollback_available && (
                <Badge variant="outline" className="text-[8px] text-amber-700 border-amber-400 shrink-0">
                  rollback
                </Badge>
              )}
              <Badge
                variant="outline"
                className={cn(
                  'text-[8px] shrink-0',
                  entry.status === 'done' ? 'text-green-700' : 'text-destructive',
                )}
              >
                {entry.status}
              </Badge>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

export default AutomationPanel;
