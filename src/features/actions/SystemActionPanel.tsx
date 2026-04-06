/**
 * SystemActionPanel
 *
 * Simple UI for the Level 3 fix system.
 * Lists actions and provides:
 *  - "Simulate Fix" — calls generateFixResult, shows expected result (no real changes)
 *  - "Execute Fix"  — NOT yet implemented; shows the generated fix prompt only
 *
 * NO backend calls. NO imports from existing action/verification systems.
 */
import { useState } from 'react';
import {
  generateFixResult,
  type SystemAction,
  type FixResult,
} from './AutoFixEngine';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  CheckCircle2,
  FlaskConical,
  Play,
  Trash2,
  Wrench,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Log entry (local state only) ───────────────────────────────────────────────

interface LogEntry {
  id: string;
  ts: number;
  action_id: string;
  fix_type: string;
  execution_mode: string;
  message: string;
  mode: 'simulate' | 'execute';
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
  const [activeResult, setActiveResult] = useState<FixResult | null>(null);
  const [activeAction, setActiveAction] = useState<SystemAction | null>(null);

  const addLog = (result: FixResult, mode: 'simulate' | 'execute') => {
    setLog((prev) => [
      ...prev.slice(-199),
      {
        id: mkLogId(),
        ts: Date.now(),
        action_id: result.action_id,
        fix_type: result.fix_type,
        execution_mode: result.execution_mode,
        message: result.message,
        mode,
      },
    ]);
  };

  const handleSimulate = (action: SystemAction) => {
    const result = generateFixResult(action);
    setActiveAction(action);
    setActiveResult(result);
    addLog(result, 'simulate');
  };

  const handleExecute = (action: SystemAction) => {
    // Real execution is not yet implemented.
    // Generate and display the fix prompt so the operator can act manually.
    const result = generateFixResult(action);
    setActiveAction(action);
    setActiveResult({ ...result, message: '[Execute] ' + result.message });
    addLog({ ...result, message: '[Execute] ' + result.message }, 'execute');
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Wrench className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">System Action Panel</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => { setLog([]); setActiveResult(null); setActiveAction(null); }}
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
                onSimulate={() => handleSimulate(action)}
                onExecute={() => handleExecute(action)}
              />
            ))}
          </div>
        </ScrollArea>
      )}

      {/* Active result */}
      {activeResult && (
        <>
          <Separator />
          <ResultPanel result={activeResult} />
        </>
      )}

      {/* Log */}
      {log.length > 0 && (
        <>
          <Separator />
          <LogPanel entries={log} />
        </>
      )}
    </div>
  );
};

// ── Sub-components ─────────────────────────────────────────────────────────────

interface ActionRowProps {
  action: SystemAction;
  isSelected: boolean;
  onSimulate: () => void;
  onExecute: () => void;
}

function ActionRow({ action, isSelected, onSimulate, onExecute }: ActionRowProps) {
  return (
    <Card
      className={cn(
        'border-border/50',
        isSelected && 'border-primary/40',
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
          >
            <FlaskConical className="h-3 w-3" />
            Simulate Fix
          </Button>
          <Button
            variant="default"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={onExecute}
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
    <div className="rounded-md border border-blue-300 bg-blue-50 dark:bg-blue-950/20 p-3 space-y-2 text-xs">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4 text-blue-600" />
        <span className="font-medium">Fix Result</span>
        <Badge variant="outline" className="text-[9px]">{result.fix_type}</Badge>
        <Badge variant="outline" className="text-[9px]">{result.execution_mode}</Badge>
        <Badge variant="outline" className="text-[9px] text-blue-600">simulated</Badge>
      </div>
      <p className="text-muted-foreground">{result.message}</p>
      <pre className="bg-muted rounded p-2 text-[10px] font-mono whitespace-pre-wrap overflow-x-auto">
        {result.fix_prompt}
      </pre>
    </div>
  );
}

function LogPanel({ entries }: { entries: LogEntry[] }) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
        Fix Log
      </p>
      <ScrollArea className="h-[16vh]">
        <div className="space-y-0.5">
          {[...entries].reverse().map((entry) => (
            <div
              key={entry.id}
              className="flex items-center gap-2 text-[10px] px-1 py-0.5 rounded hover:bg-muted/50"
            >
              <CheckCircle2 className="h-3 w-3 shrink-0 text-blue-500" />
              <span className="font-mono text-muted-foreground w-16 shrink-0 tabular-nums">
                {new Date(entry.ts).toLocaleTimeString('sv-SE')}
              </span>
              <Badge variant="outline" className="text-[8px] shrink-0">{entry.fix_type}</Badge>
              <span className="truncate flex-1">{entry.message}</span>
              <Badge
                variant="outline"
                className={cn('text-[8px] shrink-0', entry.mode === 'simulate' ? 'text-blue-600' : 'text-primary')}
              >
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
