import React, { useMemo, useState, useEffect } from 'react';
import { AlertTriangle, Bug, CheckCircle, ChevronRight, Copy, FileText, X, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ParsedIssue {
  /** stable key for React */
  _key: string;
  /** Human-readable category (broken_flows, fake_features, etc.) */
  _category: string;
  id: string;
  title: string;
  description: string;
  file: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  fix_suggestion: string;
  /** generated fix prompt */
  prompt: string;
  /** raw original object for deep inspection */
  _raw: any;
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

function buildPrompt(issue: Omit<ParsedIssue, 'prompt' | '_key'>): string {
  const file = issue.file || '(unknown file)';
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
    issue.fix_suggestion || '1. Investigate the affected file.\n2. Identify the root cause.\n3. Apply the minimal change to resolve the issue.',
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

      const partial = { _category: label, id, title, description, file, severity, fix_suggestion, _raw: item };
      const prompt = buildPrompt(partial);

      parsed.push({
        ...partial,
        _key: dedup,
        prompt,
      });
    }
  }

  return parsed;
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

function IssueDetailPanel({ issue, onClose }: { issue: ParsedIssue; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  function copyPrompt() {
    navigator.clipboard.writeText(issue.prompt).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
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
          {issue.prompt}
        </pre>
      </section>
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
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  // ── Debug logging (task requirement) ────────────────────────────────────────
  useEffect(() => {
    console.log('[ANALYSIS] scan_run_id:', scanRunId);
    console.log('[ANALYSIS] unified_result raw:', unifiedResult);
    console.log('[ANALYSIS] parsed issues count:', issues.length);
  }, [scanRunId, unifiedResult, issues.length]);

  const selectedIssue = issues.find(i => i._key === selectedKey) ?? null;

  // ── Severity filter ──────────────────────────────────────────────────────────
  const [severityFilter, setSeverityFilter] = useState<ParsedIssue['severity'] | 'all'>('all');
  const visible = severityFilter === 'all' ? issues : issues.filter(i => i.severity === severityFilter);

  return (
    <div className="space-y-3">
      {/* Debug header */}
      <div className="border border-border/50 rounded-md bg-muted/20 px-3 py-2 text-[10px] font-mono space-y-0.5">
        <div><span className="text-muted-foreground">scan_run_id:</span> <span className="text-foreground">{scanRunId ?? '—'}</span></div>
        <div><span className="text-muted-foreground">data_source:</span> <span className="text-green-500">scan_runs.unified_result</span></div>
        <div><span className="text-muted-foreground">parsed_issues:</span> <span className="text-foreground">{issues.length}</span></div>
      </div>

      {/* Failsafe */}
      {!unifiedResult && (
        <div className="border border-yellow-500/40 rounded-md bg-yellow-500/10 px-3 py-2 text-xs text-yellow-500 font-medium">
          No unified_result available — run a scan first.
        </div>
      )}
      {unifiedResult && issues.length === 0 && (
        <div className="border border-red-500/40 rounded-md bg-red-500/10 px-3 py-2 text-xs text-red-500 font-mono font-medium">
          NO PARSEABLE ISSUES FOUND – CHECK unified_result STRUCTURE
        </div>
      )}

      {issues.length > 0 && (
        <>
          {/* Severity filter */}
          <div className="flex gap-1 flex-wrap">
            {(['all', 'critical', 'high', 'medium', 'low', 'info'] as const).map(s => (
              <button
                key={s}
                onClick={() => { setSeverityFilter(s); setSelectedKey(null); }}
                className={cn(
                  'text-[10px] px-2 py-0.5 rounded border transition-colors',
                  severityFilter === s
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border text-muted-foreground hover:bg-muted/50',
                )}
              >
                {s === 'all' ? `All (${issues.length})` : `${s} (${issues.filter(i => i.severity === s).length})`}
              </button>
            ))}
          </div>

          <div className={cn('grid gap-3', selectedIssue ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1')}>
            {/* Issue list */}
            <div className="space-y-1">
              {visible.length === 0 && (
                <p className="text-[10px] text-muted-foreground">No issues at this severity level.</p>
              )}
              {visible.map(issue => (
                <button
                  key={issue._key}
                  onClick={() => setSelectedKey(prev => prev === issue._key ? null : issue._key)}
                  className={cn(
                    'w-full text-left rounded-md border px-3 py-2 transition-colors group flex items-start gap-2',
                    selectedKey === issue._key
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/40 hover:bg-muted/30',
                  )}
                >
                  <Bug className="w-3.5 h-3.5 mt-0.5 shrink-0 text-muted-foreground group-hover:text-primary" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <SeverityBadge severity={issue.severity} />
                      <span className="text-[9px] text-muted-foreground">{issue._category}</span>
                    </div>
                    <p className="text-xs font-medium text-foreground mt-0.5 truncate">{issue.title}</p>
                    {issue.file && (
                      <p className="text-[10px] text-muted-foreground font-mono truncate">{issue.file}</p>
                    )}
                  </div>
                  <ChevronRight className={cn('w-3 h-3 shrink-0 mt-0.5 text-muted-foreground transition-transform', selectedKey === issue._key && 'rotate-90')} />
                </button>
              ))}
            </div>

            {/* Detail panel */}
            {selectedIssue && (
              <IssueDetailPanel issue={selectedIssue} onClose={() => setSelectedKey(null)} />
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default IssueAnalysisPanel;
