import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, Loader2, Zap } from 'lucide-react';
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
}

interface Props {
  issue: ActionIssue;
  scanRunId?: string;
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

// ── Component ─────────────────────────────────────────────────────────────────

export function SystemActionPanel({ issue, scanRunId }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [simResult, setSimResult] = useState<string | null>(null);
  const [executed, setExecuted] = useState(false);

  const action = buildFixAction(issue._category, issue.title);

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
      // 1. Look up matching work_item by title (source_type = 'scanner')
      const { data: workItems } = await supabase
        .from('work_items')
        .select('id, title, source_id, source_type')
        .ilike('title', issue.title)
        .eq('source_type', 'scanner')
        .in('status', ['open', 'claimed', 'in_progress'])
        .limit(1);

      const workItem = workItems?.[0] ?? null;

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
        },
      });

      // 4. Optional: call apply-fix if fix_type is supported
      if (SUPPORTED_FIX_TYPES.includes(action.fix_type)) {
        safeInvoke('apply-fix', {
          body: {
            fix_text: issue.fix_suggestion || action.description,
            issue_title: issue.title,
            issue_category: issue._category,
            issue_severity: issue.severity,
            source_work_item_id: workItem?.id,
          },
        }).catch(() => {/* silently ignore — optional */});
      }

      setExecuted(true);
      setSimResult(
        workItem
          ? `✅ Work item uppdaterat till "done": ${workItem.title}`
          : `✅ Loggad i change_log (inget matchande work item hittades)`
      );
      toast.success(`Åtgärd utförd: ${action.label}`);
    } catch (err: any) {
      setSimResult(`❌ Fel: ${err?.message || 'Okänt fel'}`);
      toast.error('Utförande misslyckades');
    } finally {
      setExecuting(false);
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
              disabled={simulating || executed || executing}
              onClick={handleSimulate}
            >
              {simulating ? (
                <span className="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
              ) : (
                <Zap className="w-3 h-3" />
              )}
              Simulera
            </Button>
            <Button
              size="sm"
              variant="default"
              className="flex-1 gap-1.5 h-7 text-xs"
              disabled={executed || executing || simulating}
              onClick={handleExecute}
            >
              {executing ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <CheckCircle2 className="w-3 h-3" />
              )}
              {executing ? 'Utför...' : 'Utför'}
            </Button>
          </div>

          {simResult && (
            <p className="text-[11px] text-muted-foreground bg-muted rounded px-2 py-1">{simResult}</p>
          )}
        </div>
      )}
    </div>
  );
}
