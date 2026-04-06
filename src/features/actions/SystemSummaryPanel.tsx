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
import { useState } from 'react';
import type { SystemAction } from './AutoFixEngine';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Info,
  Flame,
  AlertCircle,
  Wrench,
  Database,
  Monitor,
  Layers,
  HelpCircle,
  Tag,
  Activity,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

export type Priority = 'critical' | 'warning' | 'minor';

/** Explanation shown when the user taps "Explain" on a card. */
export interface ExplainBlock {
  /** Why the issue happens in plain language */
  why: string;
  /** Which scan step / scanner detected it */
  scanStep: string;
  /** Which part of the system is affected */
  affectedPart: string;
}

export interface SummaryItem {
  id: string;
  /** Human-readable title */
  title: string;
  /** Short plain-language explanation */
  description: string;
  /** What happens if left unfixed */
  consequence: string;
  /** Suggested fix in plain language */
  suggestedFix: string;
  /** Simple category label */
  category: 'UI problem' | 'Data issue' | 'Feature broken' | 'Config issue';
  priority: Priority;
  /**
   * Composite impact score (0–100).
   * Higher = more urgent to fix.
   * Factors: severity weight + flow importance + fixability penalty.
   */
  impactScore: number;
  /** User-facing flow tags, e.g. "Checkout Flow", "User Login" */
  flowTags: string[];
  /** Deep-dive explanation shown on demand */
  explain: ExplainBlock;
  /** Original technical data, shown only on expand */
  _raw: SystemAction;
}

// ── Human-readable translation helpers ────────────────────────────────────────

const KEYWORD_RULES: Array<{
  test: RegExp;
  title: (a: SystemAction) => string;
  description: string;
  consequence: string;
  suggestedFix: string;
  category: SummaryItem['category'];
  priority: Priority;
}> = [
  {
    test: /checkout/i,
    title: () => 'Checkout is not working',
    description: 'Users cannot complete purchases.',
    consequence: 'Lost sales and poor customer experience.',
    suggestedFix: 'Inspect the checkout handler and ensure it processes orders correctly.',
    category: 'Feature broken',
    priority: 'critical',
  },
  {
    test: /payment|stripe/i,
    title: () => 'Payment processing has an issue',
    description: 'The payment flow may fail or behave unexpectedly.',
    consequence: 'Users cannot pay; transactions may fail silently.',
    suggestedFix: 'Verify payment integration settings and handler responses.',
    category: 'Feature broken',
    priority: 'critical',
  },
  {
    test: /auth|login|session/i,
    title: () => 'Login or session issue detected',
    description: 'Users may be unable to sign in or may lose their session.',
    consequence: 'Users get logged out or cannot access the app.',
    suggestedFix: 'Check authentication handlers and session token expiry.',
    category: 'Feature broken',
    priority: 'critical',
  },
  {
    test: /missing|not.?found|404/i,
    title: (a) => `"${a.component}" feature is missing`,
    description: 'A required component or page cannot be found.',
    consequence: 'Users see an error or blank page.',
    suggestedFix: 'Verify the route and component are registered correctly.',
    category: 'UI problem',
    priority: 'warning',
  },
  {
    test: /permission|access|role/i,
    title: () => 'Access permission problem',
    description: 'Certain users may see content they should not, or be blocked from things they need.',
    consequence: 'Security risk or broken user flows.',
    suggestedFix: 'Review role and permission configuration.',
    category: 'Config issue',
    priority: 'warning',
  },
  {
    test: /sync|mismatch|stale/i,
    title: (a) => `"${a.component}" data is out of sync`,
    description: 'The data shown does not match what is stored.',
    consequence: 'Users see outdated or incorrect information.',
    suggestedFix: 'Trigger a data refresh or fix the synchronisation logic.',
    category: 'Data issue',
    priority: 'warning',
  },
  {
    test: /null|undefined|crash|error/i,
    title: (a) => `"${a.component}" has an unexpected error`,
    description: 'The component is crashing or producing an error.',
    consequence: 'Part of the page may not render.',
    suggestedFix: 'Add error handling and check for null values.',
    category: 'UI problem',
    priority: 'warning',
  },
  {
    test: /config|setting/i,
    title: (a) => `"${a.component}" is misconfigured`,
    description: 'A setting or configuration value is incorrect.',
    consequence: 'Feature may behave unexpectedly.',
    suggestedFix: 'Review and correct the configuration for this component.',
    category: 'Config issue',
    priority: 'minor',
  },
  {
    test: /ui|display|render|style|layout/i,
    title: (a) => `"${a.component}" looks wrong`,
    description: 'The visual display of this section is incorrect.',
    consequence: 'Poor user experience; content may be hard to read.',
    suggestedFix: 'Inspect the layout and styling for this component.',
    category: 'UI problem',
    priority: 'minor',
  },
  {
    test: /db|database|query/i,
    title: (a) => `"${a.component}" has a database issue`,
    description: 'A database query or connection is not working as expected.',
    consequence: 'Data may not load or save correctly.',
    suggestedFix: 'Check database queries and connection settings.',
    category: 'Data issue',
    priority: 'warning',
  },
];

// ── Flow tag derivation ────────────────────────────────────────────────────────

const FLOW_TAG_RULES: Array<{ test: RegExp; tag: string }> = [
  { test: /checkout/i,               tag: 'Checkout Flow' },
  { test: /payment|stripe|order/i,   tag: 'Checkout Flow' },
  { test: /auth|login|session|signup/i, tag: 'User Login' },
  { test: /admin/i,                  tag: 'Admin Panel' },
  { test: /product|catalog|variant/i, tag: 'Product Catalog' },
  { test: /cart/i,                   tag: 'Cart Flow' },
  { test: /permission|role|access/i, tag: 'Access Control' },
  { test: /db|database|query|sync/i, tag: 'Data Layer' },
  { test: /ui|render|layout|style/i, tag: 'User Interface' },
];

function deriveFlowTags(action: SystemAction): string[] {
  const haystack = `${action.action} ${action.component} ${action.entityType}`;
  const tags = new Set<string>();
  for (const rule of FLOW_TAG_RULES) {
    if (rule.test.test(haystack)) tags.add(rule.tag);
  }
  return tags.size > 0 ? [...tags] : ['General'];
}

// ── Explain block derivation ───────────────────────────────────────────────────

const SCAN_STEP_BY_CATEGORY: Record<SummaryItem['category'], string> = {
  'UI problem':      'UI structure scanner',
  'Data issue':      'Data integrity scanner',
  'Feature broken':  'User flow scanner',
  'Config issue':    'Configuration scanner',
};

const WHY_BY_CATEGORY: Record<SummaryItem['category'], string> = {
  'UI problem':      'A component or layout rule is missing or producing the wrong output. This usually happens when code changes break visual contracts.',
  'Data issue':      'The data pipeline has a gap — either a value was not saved correctly, or the read-back is returning stale or mismatched data.',
  'Feature broken':  'The user-facing flow reaches a point where a required handler or integration is absent or returns an unexpected response.',
  'Config issue':    'A configuration value is set incorrectly or missing. The system falls back to a default that does not match the intended behaviour.',
};

function deriveExplain(action: SystemAction, category: SummaryItem['category']): ExplainBlock {
  return {
    why: WHY_BY_CATEGORY[category],
    scanStep: SCAN_STEP_BY_CATEGORY[category],
    affectedPart: action.component || action.entityType || 'Unknown component',
  };
}

// ── Impact score calculation ───────────────────────────────────────────────────

const SEVERITY_WEIGHT: Record<Priority, number> = {
  critical: 50,
  warning:  25,
  minor:    10,
};

const FLOW_IMPORTANCE: Record<string, number> = {
  'Checkout Flow':   30,
  'User Login':      25,
  'Access Control':  20,
  'Admin Panel':     15,
  'Cart Flow':       15,
  'Product Catalog': 10,
  'Data Layer':      10,
  'User Interface':   5,
  'General':          5,
};

function calcImpactScore(priority: Priority, flowTags: string[], autoFixable: boolean): number {
  const severityW = SEVERITY_WEIGHT[priority];
  const flowW     = Math.max(...flowTags.map((t) => FLOW_IMPORTANCE[t] ?? 5));
  // Not auto-fixable means harder to recover from, so it has higher urgency.
  const fixPenalty = autoFixable ? 0 : 10;
  return Math.min(100, severityW + flowW + fixPenalty);
}

// ── Main item derivation ───────────────────────────────────────────────────────

function deriveHint(action: SystemAction): Omit<SummaryItem, 'id' | '_raw' | 'impactScore' | 'flowTags' | 'explain'> {
  const haystack = `${action.action} ${action.component} ${action.entityType} ${action.fix_hint ?? ''}`;

  for (const rule of KEYWORD_RULES) {
    if (rule.test.test(haystack)) {
      return {
        title: rule.title(action),
        description: rule.description,
        consequence: rule.consequence,
        suggestedFix: action.fix_hint ?? rule.suggestedFix,
        category: rule.category,
        priority: rule.priority,
      };
    }
  }

  // Fallback: generic readable label from raw action name
  const readable = action.action
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase();

  return {
    title: `Issue in "${action.component}"`,
    description: `A problem was detected: ${readable}.`,
    consequence: 'This may affect part of the application.',
    suggestedFix: action.fix_hint ?? 'Review and fix the reported action.',
    category: 'Feature broken',
    priority: action.auto_fixable ? 'minor' : 'warning',
  };
}

function toSummaryItem(action: SystemAction): SummaryItem {
  const hint      = deriveHint(action);
  const flowTags  = deriveFlowTags(action);
  const explain   = deriveExplain(action, hint.category);
  const impactScore = calcImpactScore(hint.priority, flowTags, action.auto_fixable ?? false);
  return {
    id: action.id,
    ...hint,
    impactScore,
    flowTags,
    explain,
    _raw: action,
  };
}

// ── Score calculation ─────────────────────────────────────────────────────────

function calcScore(items: SummaryItem[]): number {
  const deduction = items.reduce((acc, item) => {
    if (item.priority === 'critical') return acc + 20;
    if (item.priority === 'warning') return acc + 8;
    return acc + 2;
  }, 0);
  return Math.max(0, 100 - deduction);
}

// ── Sub-components ────────────────────────────────────────────────────────────

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

function ImpactBadge({ score }: { score: number }) {
  const color =
    score >= 70 ? 'text-red-700 bg-red-50 border-red-300' :
    score >= 40 ? 'text-yellow-700 bg-yellow-50 border-yellow-300' :
                  'text-slate-600 bg-slate-50 border-slate-300';
  return (
    <span
      title="Impact score — higher means more urgent"
      className={cn('inline-flex items-center gap-0.5 rounded border px-1.5 py-0.5 text-[10px] font-semibold', color)}
    >
      <Activity className="h-2.5 w-2.5" />
      {score}
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

function CategoryIcon({ category }: { category: SummaryItem['category'] }) {
  if (category === 'UI problem') return <Monitor className="h-4 w-4 text-blue-500" />;
  if (category === 'Data issue') return <Database className="h-4 w-4 text-purple-500" />;
  if (category === 'Config issue') return <Layers className="h-4 w-4 text-orange-500" />;
  return <Wrench className="h-4 w-4 text-slate-500" />;
}

function FlowTagList({ tags }: { tags: string[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {tags.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-0.5 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] text-slate-600"
        >
          <Tag className="h-2.5 w-2.5" />
          {tag}
        </span>
      ))}
    </div>
  );
}

function ExplainPanel({ explain }: { explain: ExplainBlock }) {
  return (
    <div className="rounded-md border border-blue-100 bg-blue-50/60 dark:bg-blue-950/20 p-3 space-y-2 text-xs">
      <p className="font-semibold text-blue-700 text-[11px] uppercase tracking-wide">Why this happens</p>
      <p className="text-blue-900 dark:text-blue-200 leading-snug">{explain.why}</p>
      <div className="flex flex-wrap gap-3 pt-1">
        <div>
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Detected by</p>
          <p className="text-blue-800 dark:text-blue-300">{explain.scanStep}</p>
        </div>
        <div>
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Affected part</p>
          <p className="text-blue-800 dark:text-blue-300">{explain.affectedPart}</p>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ item }: { item: SummaryItem }) {
  const [expanded, setExpanded] = useState(false);
  const [showExplain, setShowExplain] = useState(false);

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        {/* Default view */}
        <button
          type="button"
          className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-muted/40 transition-colors"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
        >
          <CategoryIcon category={item.category} />
          <div className="flex-1 min-w-0 space-y-1">
            <p className="text-sm font-medium leading-tight">{item.title}</p>
            <p className="text-xs text-muted-foreground leading-snug">{item.description}</p>
            <FlowTagList tags={item.flowTags} />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <ImpactBadge score={item.impactScore} />
            <Badge variant="outline" className="text-[10px]">{item.category}</Badge>
            {expanded
              ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
              : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          </div>
        </button>

        {/* Expanded details */}
        {expanded && (
          <div className="border-t px-4 py-3 space-y-3 text-xs bg-muted/20">
            {/* Consequence block */}
            <div className="rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/20 px-3 py-2">
              <p className="font-semibold text-amber-700 text-[10px] uppercase tracking-wide mb-0.5">
                If ignored:
              </p>
              <p className="text-amber-900 dark:text-amber-200 leading-snug">{item.consequence}</p>
            </div>

            <div>
              <p className="font-medium text-muted-foreground uppercase tracking-wide text-[10px] mb-0.5">Suggested fix</p>
              <p>{item.suggestedFix}</p>
            </div>

            {/* Explain toggle */}
            <div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1 px-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                onClick={() => setShowExplain((v) => !v)}
              >
                <HelpCircle className="h-3.5 w-3.5" />
                {showExplain ? 'Hide explanation' : 'Explain'}
              </Button>
              {showExplain && <ExplainPanel explain={item.explain} />}
            </div>

            {/* Raw technical data */}
            <details className="mt-1">
              <summary className="cursor-pointer text-[10px] text-muted-foreground hover:text-foreground select-none">
                Technical details
              </summary>
              <pre className="mt-2 rounded bg-background border p-2 text-[10px] overflow-x-auto whitespace-pre-wrap font-mono">
                {JSON.stringify(item._raw, null, 2)}
              </pre>
            </details>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PriorityGroup({
  label,
  icon,
  items,
  defaultOpen = false,
}: {
  label: string;
  icon: React.ReactNode;
  items: SummaryItem[];
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  if (items.length === 0) return null;

  // Sort within group by impact score descending
  const sorted = [...items].sort((a, b) => b.impactScore - a.impactScore);

  return (
    <div className="space-y-2">
      <button
        type="button"
        className="flex items-center gap-2 text-sm font-semibold w-full hover:opacity-80 transition-opacity"
        onClick={() => setOpen((v) => !v)}
      >
        {icon}
        <span>{label}</span>
        <Badge variant="secondary" className="ml-1 text-[10px]">{items.length}</Badge>
        <span className="ml-auto text-muted-foreground">
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </span>
      </button>
      {open && (
        <div className="space-y-2 pl-1">
          {sorted.map((item) => <SummaryCard key={item.id} item={item} />)}
        </div>
      )}
    </div>
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
  const items = actions.map(toSummaryItem);
  const score = calcScore(items);

  const critical = items.filter((i) => i.priority === 'critical');
  const warnings = items.filter((i) => i.priority === 'warning');
  const minor = items.filter((i) => i.priority === 'minor');

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
