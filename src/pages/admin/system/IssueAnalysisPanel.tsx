import React, { useMemo, useState } from 'react';
import { AlertTriangle, Bug, CheckCircle, ChevronDown, ChevronRight, Copy, FileText, Inbox, Layers, X, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { createWorkItemWithDedup } from '@/utils/workItemDedup';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ParsedIssue {
  /** stable key for React */
  _key: string;
  /** Human-readable category (broken_flows, fake_features, etc.) */
  _category: string;
  id: string;
  /** issue type identifier, e.g. "missing_field", "orphan_file", "broken_flow" */
  type: string;
  title: string;
  description: string;
  /** file or component path */
  file: string;
  /** alias for file, used in fix generation */
  path: string;
  /** specific missing field name if type === "missing_field" */
  missing_field: string;
  /** component or service name */
  component: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  fix_suggestion: string;
  /** occurrence count */
  count: number;
  /** generated fix prompt */
  prompt: string;
  /** raw original object for deep inspection */
  _raw: any;
}

/** A cluster of related issues sharing the same root cause. */
export interface RootCauseGroup {
  /** stable key for React */
  _key: string;
  /** Human-readable root cause label, e.g. "Broken data mapping in orders pipeline" */
  root_cause: string;
  /** Short description of what went wrong */
  description: string;
  /** Dominant issue type in this group */
  type: string;
  /** Shared component / data source */
  component: string;
  /** All symptoms (individual issues) belonging to this root cause */
  symptoms: ParsedIssue[];
  /** Sum of occurrence counts across all symptoms */
  total_impact: number;
  /** Worst severity across all symptoms */
  severity: ParsedIssue['severity'];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizeSeverity(v: string | undefined): ParsedIssue['severity'] {
  const s = (v ?? '').toLowerCase();
  if (s === 'critical') return 'critical';
  if (s === 'high' || s === 'error') return 'high';
  if (s === 'medium' || s === 'warning') return 'medium';
  if (s === 'low') return 'low';
  return 'info';
}

function generateFixPrompt(issue: Omit<ParsedIssue, 'prompt' | '_key'>): string {
  if (issue.type === 'missing_field') {
    return `ISSUE:
Missing field "${issue.missing_field}" in ${issue.component || issue.file || '(unknown component)'}

ROOT CAUSE:
Data is returned without required property "${issue.missing_field}", breaking downstream logic.

FIX:

1. Locate source:
   - ${issue.component || issue.file}
   - Check DB query or API response

2. Ensure field exists:
   - Add "${issue.missing_field}" to SELECT query
   OR
   - Map correct field name from DB

3. Verify type alignment:
   - frontend type must include "${issue.missing_field}"

4. Re-run scan and confirm:
   - issue disappears

CONTEXT:
Seen ${issue.count} times
Severity: ${issue.severity}`;
  }

  if (issue.type === 'orphan_file') {
    return `ISSUE:
Orphan file detected: ${issue.path || issue.file}

ROOT CAUSE:
File is not imported or referenced anywhere in the project.

FIX OPTIONS:

1. If unused:
   - DELETE file

2. If missing reference:
   - import into correct module

3. Verify:
   - run scan → orphan count reduced`;
  }

  const file = issue.file || issue.path || '(unknown file)';
  const lines = [
    `Fix ${issue.title} in ${file}`,
    '',
    'Problem:',
    issue.description || '(no description available)',
    '',
    'Expected:',
    issue.fix_suggestion
      ? `The system should ${issue.fix_suggestion.charAt(0).toLowerCase()}${issue.fix_suggestion.slice(1)}`
      : 'The issue should be resolved so the system behaves correctly.',
    '',
    'Fix:',
    issue.fix_suggestion || `1. Investigate component: ${issue.component || file}\n2. Trace data flow and restore expected structure.`,
  ];
  return lines.join('\n');
}

function parseIssues(unifiedResult: any): ParsedIssue[] {
  if (!unifiedResult || typeof unifiedResult !== 'object') return [];

  const CATEGORY_KEYS: Array<{ key: string; label: string }> = [
    { key: 'broken_flows', label: 'Broken Flow' },
    { key: 'fake_features', label: 'Fake Feature' },
    { key: 'interaction_failures', label: 'Interaction Failure' },
    { key: 'data_issues', label: 'Data Issue' },
    { key: 'issues', label: 'Issue' },
    { key: 'detected_issues', label: 'Detected Issue' },
    { key: 'master_list', label: 'Issue' },
  ];

  const parsed: ParsedIssue[] = [];
  const seen = new Set<string>();

  for (const { key, label } of CATEGORY_KEYS) {
    const raw = unifiedResult[key];
    if (!raw) continue;

    // master_list may be an object with a nested array
    const arr: any[] = Array.isArray(raw) ? raw : Array.isArray(raw?.issues) ? raw.issues : [];

    for (let i = 0; i < arr.length; i++) {
      const item = arr[i];
      if (!item || typeof item !== 'object') continue;

      const id: string = item.id ?? item._id ?? `${key}-${i}`;
      const dedup = `${key}-${id}`;
      if (seen.has(dedup)) continue;
      seen.add(dedup);

      const title: string =
        item.title ?? item.name ?? item.message ?? item.description ?? `(untitled ${label} #${i + 1})`;

      const description: string =
        item.description ?? item.reason ?? item.details ?? item.message ?? '';

      const file: string =
        item.file ?? item.source_file ?? item.path ?? item.component ?? item.route ?? item.target ?? '';

      const severity = normalizeSeverity(
        item.severity ?? item.priority ?? item.level ?? item.analysis_rating,
      );

      const fix_suggestion: string =
        item.fix_suggestion ?? item.fix ?? item.recommended_fix ?? item.suggestion ?? item.action ?? '';

      const type: string =
        item.type ?? item.issue_type ?? item.kind ?? key.replace(/s$/, '');  // e.g. "broken_flows" → "broken_flow"

      const component: string =
        item.component ?? item.service ?? item.module ?? '';

      const path: string =
        item.path ?? item.file ?? item.source_file ?? item.route ?? item.target ?? '';

      const missing_field: string =
        item.missing_field ?? item.missing_fields?.[0] ?? item.field ?? '';

      const count: number =
        typeof item.count === 'number' ? item.count :
        typeof item.occurrences === 'number' ? item.occurrences : 1;

      const partial = { _category: label, id, type, title, description, file, path, component, missing_field, severity, fix_suggestion, count, _raw: item };
      const prompt = generateFixPrompt(partial);

      parsed.push({
        ...partial,
        _key: dedup,
        prompt,
      });
    }
  }

  return parsed;
}

// ── Root-cause grouping ───────────────────────────────────────────────────────

const SEVERITY_RANK: Record<ParsedIssue['severity'], number> = {
  critical: 4, high: 3, medium: 2, low: 1, info: 0,
};

function worstSeverity(issues: ParsedIssue[]): ParsedIssue['severity'] {
  return issues.reduce<ParsedIssue['severity']>((worst, issue) => {
    return SEVERITY_RANK[issue.severity] > SEVERITY_RANK[worst] ? issue.severity : worst;
  }, 'info');
}

function deriveGroupKey(issue: ParsedIssue): string {
  const comp = (issue.component || '').trim();
  const type = (issue.type || '').trim();
  // Use component as primary axis; fall back to category if blank
  const bucket = comp || issue._category;
  return `${type}::${bucket}`;
}

function deriveRootCauseLabel(type: string, component: string, category: string, symptoms: ParsedIssue[]): string {
  const loc = component || category;

  if (type === 'missing_field' || type === 'data_issue') {
    return `Broken data mapping in ${loc}`;
  }
  if (type === 'broken_flow' || type === 'broken_flows') {
    return `${loc} pipeline broken`;
  }
  if (type === 'fake_feature' || type === 'fake_features') {
    return `Fake feature in ${loc}`;
  }
  if (type === 'interaction_failure' || type === 'interaction_failures') {
    return `UI interaction layer broken: ${loc}`;
  }
  if (type === 'orphan_file') {
    return `Orphan files in ${loc}`;
  }

  // Generic fallback
  const n = symptoms.length;
  return `${n} issue${n !== 1 ? 's' : ''} in ${loc}`;
}

function deriveGroupDescription(type: string, symptoms: ParsedIssue[]): string {
  if (type === 'missing_field') {
    const fields = [...new Set(symptoms.map(s => s.missing_field).filter(Boolean))];
    if (fields.length > 0) {
      return `Missing field${fields.length > 1 ? 's' : ''}: ${fields.slice(0, 4).join(', ')}${fields.length > 4 ? ', …' : ''}`;
    }
  }
  // Use the most common description across symptoms
  const descs = symptoms.map(s => s.description).filter(Boolean);
  return descs[0] ?? `${symptoms.length} related issue${symptoms.length !== 1 ? 's' : ''} detected`;
}

export function groupByRootCause(issues: ParsedIssue[]): RootCauseGroup[] {
  // Accumulate issues per group key
  const buckets = new Map<string, ParsedIssue[]>();
  for (const issue of issues) {
    const key = deriveGroupKey(issue);
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.push(issue);
    } else {
      buckets.set(key, [issue]);
    }
  }

  const groups: RootCauseGroup[] = [];
  for (const [key, symptoms] of buckets.entries()) {
    const [type, bucket] = key.split('::');
    const component = symptoms[0]?.component || '';
    const category = symptoms[0]?._category || '';
    const loc = component || bucket;

    const root_cause = deriveRootCauseLabel(type, loc, category, symptoms);
    const description = deriveGroupDescription(type, symptoms);
    const total_impact = symptoms.reduce((sum, s) => sum + s.count, 0);
    const severity = worstSeverity(symptoms);

    groups.push({
      _key: key,
      root_cause,
      description,
      type,
      component: loc,
      symptoms,
      total_impact,
      severity,
    });
  }

  // Sort: worst severity first, then by total_impact descending
  groups.sort((a, b) => {
    const rankDiff = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
    return rankDiff !== 0 ? rankDiff : b.total_impact - a.total_impact;
  });

  return groups;
}

// ── Severity styling ──────────────────────────────────────────────────────────

function severityColor(s: ParsedIssue['severity']): string {
  switch (s) {
    case 'critical': return 'text-red-500 border-red-500/30 bg-red-500/10';
    case 'high':     return 'text-orange-500 border-orange-500/30 bg-orange-500/10';
    case 'medium':   return 'text-yellow-500 border-yellow-500/30 bg-yellow-500/10';
    case 'low':      return 'text-blue-400 border-blue-400/30 bg-blue-400/10';
    default:         return 'text-muted-foreground border-border bg-muted/20';
  }
}

function SeverityBadge({ severity }: { severity: ParsedIssue['severity'] }) {
  return (
    <span className={cn('text-[9px] font-mono border rounded px-1 py-0.5 uppercase', severityColor(severity))}>
      {severity}
    </span>
  );
}

// ── Detail Panel ──────────────────────────────────────────────────────────────

function IssueDetailPanel({
  issue,
  onClose,
  onAddToWorkbench,
}: {
  issue: ParsedIssue;
  onClose: () => void;
  onAddToWorkbench?: (issue: ParsedIssue) => Promise<void>;
}) {
  const [copied, setCopied] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addedMsg, setAddedMsg] = useState<string | null>(null);

  function copyPrompt() {
    navigator.clipboard.writeText(generateFixPrompt(issue)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  async function handleAddToWorkbench() {
    if (!onAddToWorkbench) return;
    setAdding(true);
    setAddedMsg(null);
    try {
      await onAddToWorkbench(issue);
      setAddedMsg('Added!');
      setTimeout(() => setAddedMsg(null), 3000);
    } catch {
      setAddedMsg('Failed');
      setTimeout(() => setAddedMsg(null), 3000);
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="border border-border rounded-lg bg-card p-4 space-y-4 text-sm">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <SeverityBadge severity={issue.severity} />
            <Badge variant="outline" className="text-[9px]">{issue._category}</Badge>
          </div>
          <h3 className="font-semibold text-foreground mt-1 break-words">{issue.title}</h3>
        </div>
        <button onClick={onClose} className="shrink-0 text-muted-foreground hover:text-foreground transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Description */}
      {issue.description ? (
        <section className="space-y-1">
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Description</p>
          <p className="text-xs text-foreground leading-relaxed">{issue.description}</p>
        </section>
      ) : null}

      {/* Why it's a problem */}
      <section className="space-y-1">
        <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" /> Why it's a problem
        </p>
        <p className="text-xs text-foreground leading-relaxed">
          {issue._raw?.reason ?? issue._raw?.why ?? issue._raw?.root_cause ?? issue.description ?? '(no root cause information available)'}
        </p>
      </section>

      {/* Affected file */}
      {issue.file ? (
        <section className="space-y-1">
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide flex items-center gap-1">
            <FileText className="w-3 h-3" /> Affected file
          </p>
          <code className="text-[11px] font-mono bg-muted/40 border border-border rounded px-2 py-1 block break-all text-foreground">
            {issue.file}
          </code>
          {(issue._raw?.line ?? issue._raw?.line_number) && (
            <p className="text-[10px] text-muted-foreground">Line: {issue._raw.line ?? issue._raw.line_number}</p>
          )}
        </section>
      ) : null}

      {/* Fix suggestion */}
      {issue.fix_suggestion ? (
        <section className="space-y-1">
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide flex items-center gap-1">
            <CheckCircle className="w-3 h-3 text-green-500" /> Fix suggestion
          </p>
          <p className="text-xs text-foreground leading-relaxed">{issue.fix_suggestion}</p>
        </section>
      ) : null}

      {/* Generated prompt */}
      <section className="space-y-1">
        <div className="flex items-center justify-between">
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide flex items-center gap-1">
            <Zap className="w-3 h-3 text-yellow-400" /> Generated prompt
          </p>
          <Button variant="outline" size="sm" className="h-6 text-[10px] gap-1" onClick={copyPrompt}>
            <Copy className="w-3 h-3" />
            {copied ? 'Copied!' : 'Copy'}
          </Button>
        </div>
        <pre className="text-[10px] font-mono bg-muted/40 border border-border rounded-md p-2 whitespace-pre-wrap break-words text-foreground overflow-auto max-h-[200px]">
          {generateFixPrompt(issue)}
        </pre>
      </section>

      {/* Add to Workbench */}
      {onAddToWorkbench && (
        <Button
          size="sm"
          variant="secondary"
          className="w-full h-7 text-[11px] gap-1.5"
          onClick={handleAddToWorkbench}
          disabled={adding}
        >
          <Inbox className="w-3 h-3" />
          {addedMsg ?? (adding ? 'Adding…' : 'Add to Workbench')}
        </Button>
      )}
    </div>
  );
}

// ── Root Cause Card ───────────────────────────────────────────────────────────

function RootCauseCard({
  group,
  selectedKey,
  onSelectIssue,
  isTop = false,
}: {
  group: RootCauseGroup;
  selectedKey: string | null;
  onSelectIssue: (key: string) => void;
  isTop?: boolean;
}) {
  const [expanded, setExpanded] = useState(isTop);

  function handleFixClick(e: React.MouseEvent) {
    e.stopPropagation();
    const first = group.symptoms[0];
    if (first) {
      setExpanded(true);
      onSelectIssue(first._key);
    }
  }

  return (
    <div className={cn('border rounded-lg transition-colors', severityColor(group.severity))}>
      {/* Group header */}
      <button
        className="w-full text-left px-3 py-3 flex items-start gap-2"
        onClick={() => setExpanded(v => !v)}
      >
        <Layers className="w-3.5 h-3.5 mt-0.5 shrink-0 opacity-70" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <SeverityBadge severity={group.severity} />
            <span className="text-[9px] opacity-60">
              {group.symptoms.length} issue{group.symptoms.length !== 1 ? 's' : ''}
              {group.total_impact > group.symptoms.length ? ` · ${group.total_impact} occurrences` : ''}
            </span>
          </div>
          <p className="text-sm font-semibold text-foreground mt-1">{group.root_cause}</p>
          <p className="text-xs opacity-70 mt-0.5">{group.description}</p>
        </div>
        {expanded
          ? <ChevronDown className="w-3.5 h-3.5 shrink-0 mt-1 opacity-50" />
          : <ChevronRight className="w-3.5 h-3.5 shrink-0 mt-1 opacity-50" />
        }
      </button>

      {/* Top-group CTA */}
      {isTop && (
        <div className="px-3 pb-3">
          <Button
            className="w-full gap-2"
            size="sm"
            onClick={handleFixClick}
          >
            <Zap className="w-3.5 h-3.5" />
            Fix this issue
          </Button>
        </div>
      )}

      {/* Symptom list */}
      {expanded && (
        <div className="border-t border-current/10 divide-y divide-current/10">
          {group.symptoms.map(issue => (
            <button
              key={issue._key}
              onClick={() => onSelectIssue(issue._key)}
              className={cn(
                'w-full text-left px-4 py-2 flex items-start gap-2 transition-colors',
                selectedKey === issue._key
                  ? 'bg-primary/10'
                  : 'hover:bg-muted/30',
              )}
            >
              <Bug className="w-3 h-3 mt-0.5 shrink-0 opacity-50" />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-medium text-foreground truncate">{issue.title}</p>
                {issue.file && (
                  <p className="text-[9px] font-mono text-muted-foreground truncate">{issue.file}</p>
                )}
              </div>
              <ChevronRight className={cn('w-3 h-3 shrink-0 mt-0.5 text-muted-foreground transition-transform', selectedKey === issue._key && 'rotate-90')} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export interface IssueAnalysisPanelProps {
  scanRunId: string | null;
  unifiedResult: any;
}

export function IssueAnalysisPanel({ scanRunId, unifiedResult }: IssueAnalysisPanelProps) {
  const issues = useMemo(() => parseIssues(unifiedResult), [unifiedResult]);
  const groups = useMemo(() => groupByRootCause(issues), [issues]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const selectedIssue = issues.find(i => i._key === selectedKey) ?? null;

  const hasCritical = groups.some(g => g.severity === 'critical');

  const topGroup   = groups[0] ?? null;
  const nextGroups = groups.slice(1, 3);
  const restGroups = groups.slice(3);

  async function addWorkItem(issue: ParsedIssue) {
    await createWorkItemWithDedup({
      title: `[${issue._category}] ${issue.title}`.slice(0, 117) + (`[${issue._category}] ${issue.title}`.length > 117 ? '…' : ''),
      description: `${generateFixPrompt(issue)}\n\nScan run: ${scanRunId ?? 'unknown'}`,
      item_type: 'bug',
      priority: issue.severity === 'critical' || issue.severity === 'high' ? 'high' : 'medium',
      status: 'open',
      source_type: 'scan',
      source_id: scanRunId ?? 'scan_manual',
      source_file: issue.path || issue.file || null,
      source_component: issue.component || null,
    });
  }

  function selectIssue(key: string) {
    setSelectedKey(prev => prev === key ? null : key);
  }

  return (
    <div className="space-y-4">
      {/* Failsafe — no data yet */}
      {!unifiedResult && (
        <div className="border border-yellow-500/40 rounded-md bg-yellow-500/10 px-3 py-2 text-xs text-yellow-500 font-medium">
          No scan data available — run a scan first.
        </div>
      )}
      {unifiedResult && issues.length === 0 && (
        <div className="border border-red-500/40 rounded-md bg-red-500/10 px-3 py-2 text-xs text-red-500 font-medium">
          No issues found in scan results.
        </div>
      )}

      {groups.length > 0 && (
        <>
          {/* Status banner */}
          <div className={cn(
            'rounded-lg px-4 py-3 flex items-center gap-3',
            hasCritical
              ? 'bg-red-500/10 border border-red-500/30 text-red-500'
              : 'bg-green-500/10 border border-green-500/30 text-green-600',
          )}>
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <p className="text-sm font-medium">
              {hasCritical
                ? 'Your system has a critical issue affecting core functionality'
                : 'System is functional but can be improved'}
            </p>
          </div>

          <div className={cn('grid gap-4', selectedIssue ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1')}>
            {/* Left column — prioritised groups */}
            <div className="space-y-4">
              {/* Fix this first */}
              {topGroup && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    🔥 Fix this first
                  </p>
                  <RootCauseCard
                    group={topGroup}
                    selectedKey={selectedKey}
                    onSelectIssue={selectIssue}
                    isTop
                  />
                </div>
              )}

              {/* Next */}
              {nextGroups.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                    ⚠️ Next
                  </p>
                  {nextGroups.map(group => (
                    <RootCauseCard
                      key={group._key}
                      group={group}
                      selectedKey={selectedKey}
                      onSelectIssue={selectIssue}
                    />
                  ))}
                </div>
              )}

              {/* Remaining groups */}
              {restGroups.length > 0 && (
                <div className="space-y-1.5">
                  {showAll && restGroups.map(group => (
                    <RootCauseCard
                      key={group._key}
                      group={group}
                      selectedKey={selectedKey}
                      onSelectIssue={selectIssue}
                    />
                  ))}
                  <button
                    onClick={() => setShowAll(v => !v)}
                    className="w-full text-xs text-muted-foreground hover:text-foreground border border-dashed border-border rounded-md py-2 transition-colors"
                  >
                    {showAll ? 'Hide extra issues' : `Show all issues (${restGroups.length} more)`}
                  </button>
                </div>
              )}
            </div>

            {/* Detail panel */}
            {selectedIssue && (
              <IssueDetailPanel
                issue={selectedIssue}
                onClose={() => setSelectedKey(null)}
                onAddToWorkbench={addWorkItem}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default IssueAnalysisPanel;
