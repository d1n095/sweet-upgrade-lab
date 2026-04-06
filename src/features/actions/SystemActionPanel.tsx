/**
 * SystemActionPanel
 *
 * UI panel for the Level 3 Auto-Fix system.
 * Accepts a list of SystemActions and provides:
 *  - "Execute Fix" button  — real execution with confirmation gate
 *  - "Simulate Fix" button — shows expected result, NO real changes
 *
 * Safety:
 *  - Blocks execution when action.id is missing
 *  - Requires explicit confirm dialog before real execution
 *  - All errors are surfaced safely in the UI
 */
import { useState } from 'react';
import {
  executeAutoFix,
  simulateFix,
  type SystemAction,
  type FixResult,
} from './AutoFixEngine';
import { useFixExecutionLog } from './FixExecutionLog';
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
  Trash2,
  Wrench,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Props ──────────────────────────────────────────────────────────────────────

interface SystemActionPanelProps {
  actions?: SystemAction[];
}

// ── Component ──────────────────────────────────────────────────────────────────

const SystemActionPanel = ({ actions = [] }: SystemActionPanelProps) => {
  const { entries, log, clear } = useFixExecutionLog();
  const [selectedAction, setSelectedAction] = useState<SystemAction | null>(null);
  const [pendingExecute, setPendingExecute] = useState<SystemAction | null>(null);
  const [activeResult, setActiveResult] = useState<FixResult | null>(null);
  const [loading, setLoading] = useState(false);

  // ── Simulate ────────────────────────────────────────────────────────────────

  const handleSimulate = (action: SystemAction) => {
    const result = simulateFix(action);
    log(result);
    setSelectedAction(action);
    setActiveResult(result);
  };

  // ── Execute (with confirm gate) ─────────────────────────────────────────────

  const handleExecuteRequest = (action: SystemAction) => {
    if (!action.id) {
      const blocked: FixResult = {
        action_id: '',
        success: false,
        simulated: false,
        fix_type: 'ui_fix',
        execution_mode: 'manual',
        message: 'Blocked: action.id is missing',
        error: 'NO_ACTION_ID',
      };
      log(blocked);
      setSelectedAction(action);
      setActiveResult(blocked);
      return;
    }
    setPendingExecute(action);
  };

  const handleExecuteConfirm = async () => {
    if (!pendingExecute) return;
    setPendingExecute(null);
    setLoading(true);
    try {
      const result = await executeAutoFix(pendingExecute, true);
      log(result);
      setSelectedAction(pendingExecute);
      setActiveResult(result);
    } catch (err: any) {
      const errResult: FixResult = {
        action_id: pendingExecute.id,
        success: false,
        simulated: false,
        fix_type: 'ui_fix',
        execution_mode: 'manual',
        message: 'Unexpected error during execution',
        error: err?.message ?? 'Unknown error',
      };
      log(errResult);
      setActiveResult(errResult);
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteCancel = () => {
    setPendingExecute(null);
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  const successCount = entries.filter((e) => e.success && !e.simulated).length;
  const failedCount = entries.filter((e) => !e.success).length;
  const simCount = entries.filter((e) => e.simulated).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Wrench className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">System Action Panel</span>
        </div>
        <div className="flex items-center gap-2">
          {successCount > 0 && (
            <Badge variant="secondary" className="text-[10px]">
              {successCount} ✓
            </Badge>
          )}
          {simCount > 0 && (
            <Badge variant="outline" className="text-[10px] text-blue-600">
              {simCount} sim
            </Badge>
          )}
          {failedCount > 0 && (
            <Badge variant="destructive" className="text-[10px]">
              {failedCount} ✗
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={clear}
            disabled={!entries.length}
          >
            <Trash2 className="h-3 w-3 mr-1" /> Clear log
          </Button>
        </div>
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
                isSelected={selectedAction?.id === action.id}
                loading={loading && pendingExecute?.id === action.id}
                onSimulate={() => handleSimulate(action)}
                onExecute={() => handleExecuteRequest(action)}
              />
            ))}
          </div>
        </ScrollArea>
      )}

      {/* Active result panel */}
      {activeResult && (
        <>
          <Separator />
          <ResultPanel result={activeResult} />
        </>
      )}

      {/* Log */}
      {entries.length > 0 && (
        <>
          <Separator />
          <FixLogPanel entries={entries} />
        </>
      )}

      {/* Confirm dialog */}
      <AlertDialog open={!!pendingExecute} onOpenChange={(open) => !open && handleExecuteCancel()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Fix Execution</AlertDialogTitle>
            <AlertDialogDescription>
              This will attempt to apply a real fix for:
              <br />
              <span className="font-medium">{pendingExecute?.action}</span>
              {pendingExecute?.component && (
                <span className="text-muted-foreground"> ({pendingExecute.component})</span>
              )}
              <br />
              This action cannot be undone automatically. Continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleExecuteCancel}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleExecuteConfirm}>Execute Fix</AlertDialogAction>
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
  loading: boolean;
  onSimulate: () => void;
  onExecute: () => void;
}

function ActionRow({ action, isSelected, loading, onSimulate, onExecute }: ActionRowProps) {
  return (
    <Card
      className={cn(
        'border-border/50',
        isSelected && 'border-primary/40',
        !action.id && 'opacity-60',
      )}
    >
      <CardContent className="p-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">{action.action}</p>
            <p className="text-[10px] text-muted-foreground font-mono">{action.component}</p>
          </div>
          {action.auto_fixable && (
            <Badge variant="outline" className="text-[9px] text-green-700 border-green-300">
              auto
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={onSimulate}
            disabled={loading}
          >
            <FlaskConical className="h-3 w-3" />
            Simulate Fix
          </Button>
          <Button
            variant="default"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={onExecute}
            disabled={loading || !action.id}
            title={!action.id ? 'Cannot execute: action.id is missing' : undefined}
          >
            <Play className="h-3 w-3" />
            Execute Fix
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ResultPanel({ result }: { result: FixResult }) {
  return (
    <div
      className={cn(
        'rounded-md border p-3 space-y-2 text-xs',
        result.simulated && 'border-blue-300 bg-blue-50 dark:bg-blue-950/20',
        !result.simulated && result.success && 'border-green-300 bg-green-50 dark:bg-green-950/20',
        !result.success && 'border-destructive/40 bg-destructive/5',
      )}
    >
      <div className="flex items-center gap-2">
        {result.success ? (
          <CheckCircle2 className={cn('h-4 w-4', result.simulated ? 'text-blue-600' : 'text-green-600')} />
        ) : (
          <XCircle className="h-4 w-4 text-destructive" />
        )}
        <span className="font-medium">{result.simulated ? 'Simulation Result' : 'Fix Result'}</span>
        <Badge variant="outline" className="text-[9px]">{result.fix_type}</Badge>
        <Badge variant="outline" className="text-[9px]">{result.execution_mode}</Badge>
      </div>
      <p className="text-muted-foreground">{result.message}</p>
      {result.error && (
        <p className="text-destructive font-mono text-[10px]">Error: {result.error}</p>
      )}
      {result.fix_prompt && (
        <pre className="bg-muted rounded p-2 text-[10px] font-mono whitespace-pre-wrap overflow-x-auto">
          {result.fix_prompt}
        </pre>
      )}
    </div>
  );
}

function FixLogPanel({ entries }: { entries: import('./FixExecutionLog').FixLogEntry[] }) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
        Fix Execution Log
      </p>
      <ScrollArea className="h-[20vh]">
        <div className="space-y-0.5">
          {[...entries].reverse().map((entry) => (
            <div
              key={entry.id}
              className="flex items-center gap-2 text-[10px] px-1 py-0.5 rounded hover:bg-muted/50"
            >
              {entry.success ? (
                <CheckCircle2 className={cn('h-3 w-3 shrink-0', entry.simulated ? 'text-blue-500' : 'text-green-500')} />
              ) : (
                <XCircle className="h-3 w-3 text-destructive shrink-0" />
              )}
              <span className="font-mono text-muted-foreground w-16 shrink-0 tabular-nums">
                {new Date(entry.ts).toLocaleTimeString('sv-SE')}
              </span>
              <Badge variant="outline" className="text-[8px] shrink-0">{entry.fix_type}</Badge>
              <span className="truncate flex-1">{entry.message}</span>
              {entry.simulated && (
                <Badge variant="outline" className="text-[8px] text-blue-600 shrink-0">sim</Badge>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

export default SystemActionPanel;
