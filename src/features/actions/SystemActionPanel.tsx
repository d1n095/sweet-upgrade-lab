import React, { useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronRight, Loader2, RotateCcw, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { buildFixAction, simulateFix, type FixAction, type FixType } from './AutoFixEngine';
import { supabase } from '@/integrations/supabase/client';
import { safeInvoke } from '@/lib/safeInvoke';
import { toast } from 'sonner';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ActionIssue {
  _key: string;
  _category: string;
  id: string;
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  file?: string;
  fix_suggestion?: string;
  impact_score?: number;
}

interface Props {
  issue: ActionIssue;
  scanRunId?: string;
  /** When true the panel shows an executing spinner driven by a parent batch run */
  batchExecuting?: boolean;
}

export interface ExecResult {
  workItemUpdated: boolean;
  workItemId: string | null;
  previousStatus: string | null;
  changeLogCreated: boolean;
  applyFixStatus: 'executed' | 'skipped' | 'disabled';
}

// Fix types that are eligible for safeInvoke('apply-fix') call
const SUPPORTED_FIX_TYPES: FixType[] = [
  'fix_route', 'fix_data_mapping', 'fix_validation', 'add_null_guard',
  'restore_handler', 'add_loading_state', 'remove_dead_code',
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const SEVERITY_STYLES: Record<ActionIssue['severity'], string> = {
  critical: 'bg-destructive/15 text-destructive border-destructive/30',
  high: 'bg-orange-500/15 text-orange-600 border-orange-400/30',
  medium: 'bg-yellow-500/15 text-yellow-700 border-yellow-400/30',
  low: 'bg-blue-500/10 text-blue-600 border-blue-400/20',
  info: 'bg-muted text-muted-foreground border-border',
};

const EFFORT_BADGE: Record<FixAction['estimated_effort'], string> = {
  low: 'bg-green-500/10 text-green-700 border-green-400/20',
  medium: 'bg-yellow-500/10 text-yellow-700 border-yellow-400/20',
  high: 'bg-red-500/10 text-red-700 border-red-400/20',
};

// ── Shared execute logic (also used by batch runner) ─────────────────────────

export async function executeIssue(
  issue: ActionIssue,
  scanRunId: string | undefined,
  onApplyFixResolved?: (result: ExecResult) => void,
): Promise<ExecResult> {
  const action = buildFixAction(issue._category, issue.title);

  // 1. Find work_item: prefer source_id match, fallback to title match
  let workItem: { id: string; title: string; status: string } | null = null;
  let matchedBySourceId = false;

  const { data: bySourceId } = await supabase
    .from('work_items')
    .select('id, title, status')
    .eq('source_id', issue.id)
    .eq('source_type', 'scanner')
    .in('status', ['open', 'claimed', 'in_progress'])
    .limit(1);

  if (bySourceId?.[0]) {
    workItem = bySourceId[0];
    matchedBySourceId = true;
  } else {
    const { data: byTitle } = await supabase
      .from('work_items')
      .select('id, title, status')
      .ilike('title', issue.title)
      .eq('source_type', 'scanner')
      .in('status', ['open', 'claimed', 'in_progress'])
      .limit(1);
    workItem = byTitle?.[0] ?? null;
  }

  const previousStatus = workItem?.status ?? null;

  // 2. Update work_item status to 'done' if found
  if (workItem) {
    await supabase
      .from('work_items')
      .update({ status: 'done', completed_at: new Date().toISOString() })
      .eq('id', workItem.id);
  }

  // 3. Log execution in change_log
  await supabase.from('change_log').insert({
    change_type: 'fix_execution',
    description: `Åtgärd utförd: ${action.label} — ${issue.title}`,
    affected_components: [issue._category, action.fix_type],
    source: 'system_action_panel',
    work_item_id: workItem?.id ?? null,
    scan_id: scanRunId ?? null,
    metadata: {
      fix_type: action.fix_type,
      issue_id: issue.id,
      issue_severity: issue.severity,
      issue_category: issue._category,
      work_item_found: !!workItem,
      previous_status: previousStatus,
      match_method: matchedBySourceId ? 'source_id' : 'title',
    },
  });

  // 4. Optional: call apply-fix if fix_type is supported
  let applyFixStatus: ExecResult['applyFixStatus'] = 'disabled';
  if (SUPPORTED_FIX_TYPES.includes(action.fix_type)) {
    applyFixStatus = 'skipped';
    const result: ExecResult = {
      workItemUpdated: !!workItem,
      workItemId: workItem?.id ?? null,
      previousStatus,
      changeLogCreated: true,
      applyFixStatus,
    };
    safeInvoke('apply-fix', {
      body: {
        fix_text: issue.fix_suggestion || action.description,
        issue_title: issue.title,
        issue_category: issue._category,
        issue_severity: issue.severity,
        source_work_item_id: workItem?.id,
      },
    })
      .then((res: any) => {
        if (!res?.skipped && onApplyFixResolved) {
          onApplyFixResolved({ ...result, applyFixStatus: 'executed' });
        }
      })
      .catch(() => {/* silently ignore */});
    return result;
  }

  return {
    workItemUpdated: !!workItem,
    workItemId: workItem?.id ?? null,
    previousStatus,
    changeLogCreated: true,
    applyFixStatus,
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SystemActionPanel({ issue, scanRunId, batchExecuting = false }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [undoing, setUndoing] = useState(false);
  const [simResult, setSimResult] = useState<string | null>(null);
  const [execResult, setExecResult] = useState<ExecResult | null>(null);

  const action = buildFixAction(issue._category, issue.title);
  const isExecuted = execResult !== null;

  const handleSimulate = async () => {
    setSimulating(true);
    setSimResult(null);
    const result = await simulateFix(action);
    setSimResult(result.message);
    setSimulating(false);
  };

  const handleExecute = async () => {
    setExecuting(true);
    setSimResult(null);
    try {
      const result = await executeIssue(issue, scanRunId, (updated) => {
        setExecResult(updated);
      });
      setExecResult(result);
      toast.success(`Åtgärd utförd: ${buildFixAction(issue._category, issue.title).label}`);
    } catch (err: any) {
      setSimResult(`❌ Fel: ${err?.message || 'Okänt fel'}`);
      toast.error('Utförande misslyckades');
    } finally {
      setExecuting(false);
    }
  };

  const handleUndo = async () => {
    if (!execResult?.workItemId || !execResult.previousStatus) return;
    setUndoing(true);
    try {
      await supabase
        .from('work_items')
        .update({ status: execResult.previousStatus, completed_at: null })
        .eq('id', execResult.workItemId);

      await supabase.from('change_log').insert({
        change_type: 'fix_reverted',
        description: `Återställd: ${action.label} — ${issue.title}`,
        affected_components: [issue._category, action.fix_type],
        source: 'system_action_panel',
        work_item_id: execResult.workItemId,
        scan_id: scanRunId ?? null,
        metadata: {
          fix_type: action.fix_type,
          issue_id: issue.id,
          reverted_to: execResult.previousStatus,
        },
      });

      setExecResult(null);
      toast.info(`Återställd: ${issue.title}`);
    } catch (err: any) {
      toast.error('Återställning misslyckades');
    } finally {
      setUndoing(false);
    }
  };

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <button
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-muted/50 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        {expanded ? <ChevronDown className="w-3.5 h-3.5 shrink-0 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />}
        <Badge variant="outline" className={cn('text-[10px] shrink-0', SEVERITY_STYLES[issue.severity])}>
          {issue.severity}
        </Badge>
        <span className="text-xs font-medium truncate flex-1">{issue.title}</span>
        {(executing || batchExecuting) && (
          <Loader2 className="w-3 h-3 shrink-0 animate-spin text-muted-foreground" />
        )}
        {isExecuted && !executing && !batchExecuting && (
          <Badge variant="outline" className="text-[9px] shrink-0 bg-green-500/10 text-green-700 border-green-400/20">
            utförd
          </Badge>
        )}
        <Badge variant="outline" className={cn('text-[9px] shrink-0', EFFORT_BADGE[action.estimated_effort])}>
          {action.estimated_effort}
        </Badge>
      </button>

      {/* Body */}
      {expanded && (
        <div className="px-3 pb-3 pt-1 space-y-2.5 bg-muted/20 border-t border-border">
          {issue.description && (
            <p className="text-xs text-muted-foreground leading-relaxed">{issue.description}</p>
          )}
          {issue.file && (
            <p className="text-[10px] text-muted-foreground font-mono truncate">{issue.file}</p>
          )}

          {/* Suggested fix */}
          <div className="rounded-md border border-border bg-background p-2 space-y-0.5">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Föreslagen åtgärd</p>
            <p className="text-xs font-medium">{action.label}</p>
            <p className="text-[11px] text-muted-foreground">{action.description}</p>
          </div>

          {/* Buttons */}
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="flex-1 gap-1.5 h-7 text-xs"
              disabled={simulating || isExecuted || executing}
              onClick={handleSimulate}
            >
              {simulating ? (
                <span className="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
              ) : (
                <Zap className="w-3 h-3" />
              )}
              Simulera
            </Button>
            {!isExecuted ? (
              <Button
                size="sm"
                variant="default"
                className="flex-1 gap-1.5 h-7 text-xs"
                disabled={executing || simulating}
                onClick={handleExecute}
              >
                {executing ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-3 h-3" />
                )}
                {executing ? 'Utför...' : 'Utför'}
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="flex-1 gap-1.5 h-7 text-xs text-muted-foreground"
                disabled={undoing || !execResult?.workItemId || !execResult?.previousStatus}
                onClick={handleUndo}
              >
                {undoing ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <RotateCcw className="w-3 h-3" />
                )}
                {undoing ? 'Återställer...' : 'Ångra'}
              </Button>
            )}
          </div>

          {/* Execution result panel */}
          {execResult && (
            <div className="rounded-md border border-green-400/20 bg-green-500/5 p-2 space-y-1">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Utföranderesultat</p>
              <div className="flex items-center gap-1.5">
                <span className={cn('text-[10px]', execResult.workItemUpdated ? 'text-green-700' : 'text-muted-foreground')}>
                  {execResult.workItemUpdated ? '✓' : '–'} Work item uppdaterat: {execResult.workItemUpdated ? 'ja' : 'nej'}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-green-700">✓ change_log skapad: ja</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={cn('text-[10px]', execResult.applyFixStatus === 'executed' ? 'text-green-700' : 'text-muted-foreground')}>
                  {execResult.applyFixStatus === 'executed' && '✓ apply-fix: utförd'}
                  {execResult.applyFixStatus === 'skipped' && '– apply-fix: hoppades över (AI av)'}
                  {execResult.applyFixStatus === 'disabled' && '– Auto-fix disabled (AI off)'}
                </span>
              </div>
            </div>
          )}

          {simResult && (
            <p className="text-[11px] text-muted-foreground bg-muted rounded px-2 py-1">{simResult}</p>
          )}
        </div>
      )}
    </div>
  );
}
