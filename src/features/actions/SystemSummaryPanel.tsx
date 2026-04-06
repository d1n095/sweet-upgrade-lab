/**
 * SystemSummaryPanel
 *
 * UX + interpretation layer for system actions.
 * Turns technical action data into plain, human-readable summaries.
 *
 * - No backend calls.
 * - No safeInvoke.
 * - No network requests.
 * - Pure presentation + local logic only.
 */
import type { SystemAction } from './AutoFixEngine';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  Flame,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toSummaryItem, calcScore } from './summaryRules';
import { PriorityGroup } from './PriorityGroup';

// ── Local UI helpers ──────────────────────────────────────────────────────────

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 80 ? 'text-green-700 bg-green-50 border-green-300' :
    score >= 50 ? 'text-yellow-700 bg-yellow-50 border-yellow-300' :
                  'text-red-700 bg-red-50 border-red-300';
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full border px-3 py-0.5 text-sm font-semibold', color)}>
      {score}/100
    </span>
  );
}

function StatusBadge({ status }: { status: 'healthy' | 'warning' | 'critical' }) {
  if (status === 'healthy') {
    return (
      <Badge className="bg-green-100 text-green-800 border-green-300 gap-1">
        <CheckCircle2 className="h-3 w-3" /> Healthy
      </Badge>
    );
  }
  if (status === 'warning') {
    return (
      <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300 gap-1">
        <AlertTriangle className="h-3 w-3" /> Needs attention
      </Badge>
    );
  }
  return (
    <Badge className="bg-red-100 text-red-800 border-red-300 gap-1">
      <AlertCircle className="h-3 w-3" /> Critical issues
    </Badge>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export interface SystemSummaryPanelProps {
  actions?: SystemAction[];
}

/**
 * SystemSummaryPanel
 *
 * Renders a clean, human-readable summary of system actions.
 * No backend. No safeInvoke. Pure UI + local logic.
 */
export function SystemSummaryPanel({ actions = [] }: SystemSummaryPanelProps) {
  const items    = actions.map(toSummaryItem);
  const score    = calcScore(items);
  const critical = items.filter((i) => i.priority === 'critical');
  const warnings = items.filter((i) => i.priority === 'warning');
  const minor    = items.filter((i) => i.priority === 'minor');

  const status: 'healthy' | 'warning' | 'critical' =
    critical.length > 0 ? 'critical' :
    warnings.length > 0 ? 'warning' :
    'healthy';

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground">
          <CheckCircle2 className="h-8 w-8 text-green-500" />
          <p className="text-sm font-medium">Everything looks good</p>
          <p className="text-xs">No issues detected.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {/* Summary header */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between flex-wrap gap-2">
            <span>System Overview</span>
            <StatusBadge status={status} />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">Health score</span>
            <ScoreBadge score={score} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border bg-red-50 dark:bg-red-950/20 p-3 text-center">
              <p className="text-2xl font-bold text-red-700">{critical.length}</p>
              <p className="text-[11px] text-red-600 mt-0.5">Critical</p>
            </div>
            <div className="rounded-lg border bg-yellow-50 dark:bg-yellow-950/20 p-3 text-center">
              <p className="text-2xl font-bold text-yellow-700">{warnings.length}</p>
              <p className="text-[11px] text-yellow-600 mt-0.5">Warnings</p>
            </div>
            <div className="rounded-lg border bg-blue-50 dark:bg-blue-950/20 p-3 text-center">
              <p className="text-2xl font-bold text-blue-700">{minor.length}</p>
              <p className="text-[11px] text-blue-600 mt-0.5">Minor</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Priority groups */}
      <PriorityGroup
        label="Fix Now"
        icon={<Flame className="h-4 w-4 text-red-500" />}
        items={critical}
        defaultOpen
      />
      <PriorityGroup
        label="Important"
        icon={<AlertTriangle className="h-4 w-4 text-yellow-500" />}
        items={warnings}
        defaultOpen={critical.length === 0}
      />
      <PriorityGroup
        label="Improvements"
        icon={<Info className="h-4 w-4 text-blue-500" />}
        items={minor}
        defaultOpen={false}
      />
    </div>
  );
}

// Re-export types so existing importers don't break
export type { Priority, SummaryItem, ExplainBlock } from './summaryTypes';
