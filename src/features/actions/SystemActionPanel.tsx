/**
 * SystemActionPanel
 *
 * UI for the safe execution system.
 * Provides per-action:
 *  - "Simulate Fix"  — dry-run; shows impact + risk (no real changes)
 *  - "Apply Fix (Local)" — confirmation gate required; blocked when risk=high
 *  - "Rollback"      — available after a successful execution
 *
 * NO backend calls. NO imports from existing action/verification systems.
 * All try/catch — UI never crashes.
 */
import { useState } from 'react';
import { generateFixResult, type SystemAction, type FixResult } from './AutoFixEngine';
import {
  simulateExecution,
  executeAction,
  rollbackExecution,
  getRollbackSnapshot,
  type DryRunResult,
  type ExecutionResult,
  type RollbackResult,
} from './ExecutionEngine';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
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
  FlaskConical,
  Play,
  RotateCcw,
  Trash2,
  Wrench,
  ShieldAlert,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Types ──────────────────────────────────────────────────────────────────────

type ActiveView =
  | { kind: 'simulate'; dryRun: DryRunResult; fixResult: FixResult }
  | { kind: 'execute'; result: ExecutionResult }
  | { kind: 'rollback'; result: RollbackResult };

interface LogEntry {
  id: string;
  ts: number;
  action_id: string;
  success: boolean;
  message: string;
  mode: 'simulate' | 'execute' | 'rollback';
}

let _logCounter = 0;
const mkLogId = () => `fl-${++_logCounter}-${Date.now()}`;

// ── Props ──────────────────────────────────────────────────────────────────────

interface SystemActionPanelProps {
  actions?: SystemAction[];
}

// ── Component ──────────────────────────────────────────────────────────────────

const SystemActionPanel = ({ actions = [] }: SystemActionPanelProps) => {
  const [log, setLog] = useState<LogEntry[]>([]);
  const [activeAction, setActiveAction] = useState<SystemAction | null>(null);
  const [activeView, setActiveView] = useState<ActiveView | null>(null);
  const [pendingExecute, setPendingExecute] = useState<SystemAction | null>(null);
  // Track which action_ids have a rollback snapshot available
  const [rollbackIds, setRollbackIds] = useState<Set<string>>(new Set());

  const addLog = (entry: Omit<LogEntry, 'id' | 'ts'>) => {
    setLog((prev) => [...prev.slice(-199), { id: mkLogId(), ts: Date.now(), ...entry }]);
  };

  // ── Simulate ────────────────────────────────────────────────────────────────

  const handleSimulate = (action: SystemAction) => {
    try {
      const dryRun = simulateExecution(action);
      const fixResult = generateFixResult(action);
      setActiveAction(action);
      setActiveView({ kind: 'simulate', dryRun, fixResult });
      addLog({ action_id: action.id, success: !dryRun.blocked, message: dryRun.impact.split('\n')[0], mode: 'simulate' });
    } catch {
      // fallback — never crash UI
    }
  };

  // ── Execute (with confirmation gate) ────────────────────────────────────────

  const handleExecuteRequest = (action: SystemAction) => {
    // Pre-check: run dry-run and surface high-risk / blocked without opening dialog
    try {
      const dryRun = simulateExecution(action);
      if (dryRun.blocked || dryRun.risk === 'high') {
        const result: ExecutionResult = {
          action_id: action.id,
          success: false,
          changes_applied: [],
          rollback_available: false,
          message: dryRun.block_reason ?? 'High-risk action blocked',
          error: dryRun.blocked ? 'BLOCKED' : 'HIGH_RISK',
        };
        setActiveAction(action);
        setActiveView({ kind: 'execute', result });
        addLog({ action_id: action.id, success: false, message: result.message, mode: 'execute' });
        return;
      }
    } catch {
      // if dry-run throws, still open dialog as a safe fallback
    }
    setPendingExecute(action);
  };

  const handleExecuteConfirm = () => {
    if (!pendingExecute) return;
    const action = pendingExecute;
    setPendingExecute(null);
    try {
      const result = executeAction(action, true);
      setActiveAction(action);
      setActiveView({ kind: 'execute', result });
      addLog({ action_id: action.id, success: result.success, message: result.message, mode: 'execute' });
      if (result.rollback_available) {
        setRollbackIds((prev) => new Set(prev).add(action.id));
      }
    } catch {
      setActiveView({
        kind: 'execute',
        result: {
          action_id: action.id,
          success: false,
          changes_applied: [],
          rollback_available: false,
          message: 'Unexpected error — no changes applied',
          error: 'UNEXPECTED',
        },
      });
    }
  };

  const handleExecuteCancel = () => setPendingExecute(null);

  // ── Rollback ─────────────────────────────────────────────────────────────────

  const handleRollback = (action: SystemAction) => {
    try {
      const result = rollbackExecution(action.id);
      setActiveAction(action);
      setActiveView({ kind: 'rollback', result });
      addLog({ action_id: action.id, success: result.success, message: result.message, mode: 'rollback' });
      if (result.success) {
        setRollbackIds((prev) => {
          const next = new Set(prev);
          next.delete(action.id);
          return next;
        });
      }
    } catch {
      // never crash UI
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Wrench className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">System Action Panel</span>
          <Badge variant="outline" className="text-[9px] text-green-700 border-green-300">
            LOCAL MODE – no external changes
          </Badge>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => { setLog([]); setActiveView(null); setActiveAction(null); }}
          disabled={!log.length}
        >
          <Trash2 className="h-3 w-3 mr-1" /> Clear log
        </Button>
      </div>

      {/* Action list */}
      {actions.length === 0 ? (
        <p className="text-xs text-muted-foreground">No actions to display.</p>
      ) : (
        <ScrollArea className="h-[40vh]">
          <div className="space-y-1.5">
            {actions.map((action) => (
              <ActionRow
                key={action.id || action.action}
                action={action}
                isSelected={activeAction?.id === action.id}
                hasRollback={rollbackIds.has(action.id)}
                onSimulate={() => handleSimulate(action)}
                onExecute={() => handleExecuteRequest(action)}
                onRollback={() => handleRollback(action)}
              />
            ))}
          </div>
        </ScrollArea>
      )}

      {/* Active result */}
      {activeView && (
        <>
          <Separator />
          <ActiveViewPanel view={activeView} />
        </>
      )}

      {/* Log */}
      {log.length > 0 && (
        <>
          <Separator />
          <LogPanel entries={log} />
        </>
      )}

      {/* Confirmation dialog */}
      <AlertDialog open={!!pendingExecute} onOpenChange={(open) => !open && handleExecuteCancel()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apply this fix?</AlertDialogTitle>
            <AlertDialogDescription>
              Action: <span className="font-medium">{pendingExecute?.action}</span>
              {pendingExecute?.component && (
                <span className="text-muted-foreground"> ({pendingExecute.component})</span>
              )}
              <br />
              A rollback snapshot will be stored. This simulates the fix — no schema or core changes.
              <br />
              <span className="text-muted-foreground italic">Local mode – no external changes</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleExecuteCancel}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleExecuteConfirm}>Apply Fix (Local)</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

// ── Sub-components ─────────────────────────────────────────────────────────────

interface ActionRowProps {
  action: SystemAction;
  isSelected: boolean;
  hasRollback: boolean;
  onSimulate: () => void;
  onExecute: () => void;
  onRollback: () => void;
}

function ActionRow({ action, isSelected, hasRollback, onSimulate, onExecute, onRollback }: ActionRowProps) {
  return (
    <Card className={cn('border-border/50', isSelected && 'border-primary/40')}>
      <CardContent className="p-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">{action.action}</p>
            <p className="text-[10px] text-muted-foreground font-mono">{action.component}</p>
          </div>
          {action.auto_fixable && (
            <Badge variant="outline" className="text-[9px] text-green-700 border-green-300">auto</Badge>
          )}
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={onSimulate}>
            <FlaskConical className="h-3 w-3" />
            Simulate Fix
          </Button>
          <Button variant="default" size="sm" className="h-7 text-xs gap-1" onClick={onExecute}>
            <Play className="h-3 w-3" />
            Apply Fix (local)
          </Button>
          {hasRollback && (
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1 text-amber-700 border-amber-400 hover:bg-amber-50" onClick={onRollback}>
              <RotateCcw className="h-3 w-3" />
              Rollback
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ActiveViewPanel({ view }: { view: ActiveView }) {
  if (view.kind === 'simulate') {
    const { dryRun, fixResult } = view;
    return (
      <div className={cn(
        'rounded-md border p-3 space-y-2 text-xs',
        dryRun.blocked ? 'border-destructive/40 bg-destructive/5' : 'border-blue-300 bg-blue-50 dark:bg-blue-950/20',
      )}>
        <div className="flex items-center gap-2 flex-wrap">
          {dryRun.blocked
            ? <ShieldAlert className="h-4 w-4 text-destructive" />
            : <FlaskConical className="h-4 w-4 text-blue-600" />}
          <span className="font-medium">Simulation</span>
          <RiskBadge risk={dryRun.risk} />
          {dryRun.blocked && (
            <Badge variant="destructive" className="text-[9px]">blocked</Badge>
          )}
        </div>
        <pre className="bg-muted rounded p-2 text-[10px] font-mono whitespace-pre-wrap overflow-x-auto">{dryRun.impact}</pre>
        {dryRun.files_affected.length > 0 && (
          <div className="space-y-0.5">
            <p className="text-[9px] font-medium text-muted-foreground uppercase tracking-wide">Files affected</p>
            {dryRun.files_affected.map((f) => (
              <p key={f} className="font-mono text-[10px] text-muted-foreground">{f}</p>
            ))}
          </div>
        )}
        <pre className="bg-muted rounded p-2 text-[10px] font-mono whitespace-pre-wrap overflow-x-auto">{fixResult.fix_prompt}</pre>
      </div>
    );
  }

  if (view.kind === 'execute') {
    const { result } = view;
    return (
      <div className={cn(
        'rounded-md border p-3 space-y-2 text-xs',
        result.success ? 'border-green-300 bg-green-50 dark:bg-green-950/20' : 'border-destructive/40 bg-destructive/5',
      )}>
        <div className="flex items-center gap-2">
          {result.success
            ? <CheckCircle2 className="h-4 w-4 text-green-600" />
            : <XCircle className="h-4 w-4 text-destructive" />}
          <span className="font-medium">Execution {result.success ? 'Applied' : 'Blocked'}</span>
          {result.rollback_available && (
            <Badge variant="outline" className="text-[9px] text-amber-700 border-amber-400">rollback ready</Badge>
          )}
        </div>
        <p className="text-muted-foreground">{result.message}</p>
        {result.error && (
          <p className="text-destructive font-mono text-[10px]">Error: {result.error}</p>
        )}
        {result.changes_applied.length > 0 && (
          <div className="space-y-0.5">
            <p className="text-[9px] font-medium text-muted-foreground uppercase tracking-wide">Changes</p>
            {result.changes_applied.map((c, i) => (
              <p key={i} className="font-mono text-[10px] text-muted-foreground">{c.field}: {String(c.before)} → {String(c.after)}</p>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (view.kind === 'rollback') {
    const { result } = view;
    return (
      <div className={cn(
        'rounded-md border p-3 space-y-2 text-xs',
        result.success ? 'border-amber-300 bg-amber-50 dark:bg-amber-950/20' : 'border-destructive/40 bg-destructive/5',
      )}>
        <div className="flex items-center gap-2">
          <RotateCcw className={cn('h-4 w-4', result.success ? 'text-amber-600' : 'text-destructive')} />
          <span className="font-medium">Rollback {result.success ? 'Complete' : 'Failed'}</span>
        </div>
        <p className="text-muted-foreground">{result.message}</p>
        {result.error && (
          <p className="text-destructive font-mono text-[10px]">Error: {result.error}</p>
        )}
      </div>
    );
  }

  return null;
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
      {risk} risk
    </Badge>
  );
}

function LogPanel({ entries }: { entries: LogEntry[] }) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
        Execution Log
      </p>
      <ScrollArea className="h-[16vh]">
        <div className="space-y-0.5">
          {[...entries].reverse().map((entry) => (
            <div key={entry.id} className="flex items-center gap-2 text-[10px] px-1 py-0.5 rounded hover:bg-muted/50">
              {entry.success
                ? <CheckCircle2 className="h-3 w-3 shrink-0 text-green-500" />
                : <XCircle className="h-3 w-3 shrink-0 text-destructive" />}
              <span className="font-mono text-muted-foreground w-16 shrink-0 tabular-nums">
                {new Date(entry.ts).toLocaleTimeString('sv-SE')}
              </span>
              <span className="truncate flex-1">{entry.message}</span>
              <Badge variant="outline" className={cn(
                'text-[8px] shrink-0',
                entry.mode === 'simulate' && 'text-blue-600',
                entry.mode === 'execute' && 'text-primary',
                entry.mode === 'rollback' && 'text-amber-700',
              )}>
                {entry.mode}
              </Badge>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

export default SystemActionPanel;
