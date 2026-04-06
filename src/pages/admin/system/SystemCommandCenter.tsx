import React, { useState } from "react";
import { AlertTriangle, CheckCircle, XCircle, Zap, AlertCircle, ExternalLink, Play, Clipboard, ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface ScanRun {
  id?: string;
  status?: string;
  system_health_score?: number | null;
  unified_result?: {
    broken_flows?: any[];
    fake_features?: any[];
    interaction_failures?: any[];
    data_issues?: any[];
    issues?: any[];
  } | null;
  total_new_issues?: number | null;
  work_items_created?: number | null;
}

interface WorkItemRef {
  id: string;
  title: string;
  status: string;
  issue_fingerprint?: string | null;
  occurrence_count?: number | null;
  source_component?: string | null;
  source_file?: string | null;
  source_path?: string | null;
}

interface EnrichedIssue {
  raw: any;
  label: string;
  severity: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  relatedWorkItem: WorkItemRef | null;
  sourceStep: string | null;
  sourceComponent: string | null;
  occurrenceCount: number;
  fixPrompt: string;
}

interface SystemCommandCenterProps {
  latestRun?: ScanRun | null;
  workItems?: WorkItemRef[];
  onSelectItem?: (item: WorkItemRef) => void;
  onMarkInProgress?: (itemId: string) => Promise<void>;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getIssueLabel(item: any): string {
  return (
    item.title ??
    item.message ??
    item.description ??
    item.flow_name ??
    item.feature_name ??
    item.issue_type ??
    "Unknown issue"
  );
}

function getSeverity(item: any): string {
  return item.severity ?? item.analysis_rating ?? "unknown";
}

function severityRank(item: any): number {
  const s = getSeverity(item).toLowerCase();
  if (s === "critical") return 4;
  if (s === "high") return 3;
  if (s === "medium") return 2;
  if (s === "low") return 1;
  return 0;
}

function matchToWorkItem(issue: any, workItems: WorkItemRef[]): WorkItemRef | null {
  const fp: string | null = issue.issue_fingerprint ?? issue.fingerprint ?? null;
  if (fp) {
    const exact = workItems.find((w) => w.issue_fingerprint === fp);
    if (exact) return exact;
  }
  const label = getIssueLabel(issue).toLowerCase().slice(0, 40);
  return (
    workItems.find(
      (w) =>
        w.title.toLowerCase().includes(label) ||
        label.includes(w.title.toLowerCase().slice(0, 40))
    ) ?? null
  );
}

function deriveConfidence(
  matched: WorkItemRef | null
): "HIGH" | "MEDIUM" | "LOW" {
  if (!matched) return "LOW";
  return (matched.occurrence_count ?? 1) > 3 ? "HIGH" : "MEDIUM";
}

function buildFixPrompt(issue: EnrichedIssue): string {
  const lines = [
    `Fix: ${issue.label}`,
    `Severity: ${issue.severity}`,
  ];
  if (issue.sourceStep) lines.push(`Scan step: ${issue.sourceStep}`);
  if (issue.sourceComponent) lines.push(`Component: ${issue.sourceComponent}`);
  if (issue.occurrenceCount > 1) lines.push(`Seen ${issue.occurrenceCount}x`);
  const desc =
    issue.raw.description ??
    issue.raw.expected_behavior ??
    issue.raw.actual_behavior ??
    null;
  if (desc) lines.push(`Details: ${desc}`);
  lines.push("", "Steps to fix:");
  lines.push("1. Identify the root cause in the component listed above.");
  lines.push("2. Add the missing data, fix the broken flow, or restore the expected behavior.");
  lines.push("3. Run a targeted scan to verify the issue is resolved.");
  return lines.join("\n");
}

function collectEnrichedIssues(
  run: ScanRun | null | undefined,
  workItems: WorkItemRef[],
  limit = 3
): EnrichedIssue[] {
  if (!run?.unified_result) return [];
  const ur = run.unified_result;
  const all: any[] = [
    ...(ur.broken_flows ?? []),
    ...(ur.fake_features ?? []),
    ...(ur.interaction_failures ?? []),
    ...(ur.data_issues ?? []),
    ...(ur.issues ?? []),
  ];
  if (all.length === 0) return [];

  const sorted = [...all].sort((a, b) => severityRank(b) - severityRank(a));

  const seen = new Set<string>();
  const result: EnrichedIssue[] = [];

  for (const raw of sorted) {
    if (result.length >= limit) break;
    const label = getIssueLabel(raw);
    if (seen.has(label)) continue;
    seen.add(label);

    const matched = matchToWorkItem(raw, workItems);
    const confidence = deriveConfidence(matched);

    const sourceStep: string | null =
      raw._source ??
      raw.scan_step ??
      raw.source_step ??
      raw.scanner ??
      null;
    const sourceComponent: string | null =
      raw.component ??
      raw.source_component ??
      raw.source_file ??
      raw.file ??
      matched?.source_component ??
      matched?.source_file ??
      null;
    const occurrenceCount: number =
      raw.occurrence_count ??
      matched?.occurrence_count ??
      1;

    const partial: Omit<EnrichedIssue, "fixPrompt"> = {
      raw,
      label,
      severity: getSeverity(raw),
      confidence,
      relatedWorkItem: matched,
      sourceStep,
      sourceComponent,
      occurrenceCount,
    };

    result.push({ ...partial, fixPrompt: buildFixPrompt(partial as EnrichedIssue) });
  }

  return result;
}

function deriveHealth(run: ScanRun | null | undefined): "GOOD" | "WARNING" | "CRITICAL" {
  if (!run) return "WARNING";
  const score = run.system_health_score;
  if (score != null) {
    if (score >= 70) return "GOOD";
    if (score >= 40) return "WARNING";
    return "CRITICAL";
  }
  const ur = run.unified_result;
  const issueCount =
    (ur?.broken_flows?.length ?? 0) +
    (ur?.fake_features?.length ?? 0) +
    (ur?.interaction_failures?.length ?? 0) +
    (ur?.data_issues?.length ?? 0) +
    (ur?.issues?.length ?? 0);
  if (issueCount === 0) return "GOOD";
  if (issueCount <= 5) return "WARNING";
  return "CRITICAL";
}

function describeImpact(health: "GOOD" | "WARNING" | "CRITICAL", issueCount: number): string {
  if (health === "CRITICAL") {
    return `${issueCount} unresolved issue${issueCount !== 1 ? "s" : ""} may cause broken flows, failed orders, or data loss. Act now.`;
  }
  if (health === "WARNING") {
    return `${issueCount} issue${issueCount !== 1 ? "s" : ""} could degrade the user experience or create support load if ignored.`;
  }
  return "System is operating normally. Keep monitoring with regular scans.";
}

const healthConfig = {
  GOOD: {
    bg: "bg-green-500/10 border-green-500/30",
    text: "text-green-400",
    icon: <CheckCircle className="h-6 w-6 text-green-400" />,
    label: "GOOD",
  },
  WARNING: {
    bg: "bg-yellow-500/10 border-yellow-500/30",
    text: "text-yellow-400",
    icon: <AlertTriangle className="h-6 w-6 text-yellow-400" />,
    label: "WARNING",
  },
  CRITICAL: {
    bg: "bg-red-500/10 border-red-500/40",
    text: "text-red-400",
    icon: <XCircle className="h-6 w-6 text-red-400" />,
    label: "CRITICAL",
  },
};

const confidenceConfig = {
  HIGH: { cls: "bg-green-500/20 text-green-400", label: "HIGH confidence" },
  MEDIUM: { cls: "bg-yellow-500/20 text-yellow-400", label: "MEDIUM confidence" },
  LOW: { cls: "bg-muted text-muted-foreground", label: "LOW confidence" },
};

// ── Sub-component: single enriched issue card ─────────────────────────────────

function IssueCard({
  issue,
  index,
  onSelectItem,
  onMarkInProgress,
}: {
  issue: EnrichedIssue;
  index: number;
  onSelectItem?: (item: WorkItemRef) => void;
  onMarkInProgress?: (itemId: string) => Promise<void>;
}) {
  const [copied, setCopied] = useState(false);
  const [marking, setMarking] = useState(false);
  const [marked, setMarked] = useState(false);
  const cc = confidenceConfig[issue.confidence];

  function handleCopy() {
    navigator.clipboard.writeText(issue.fixPrompt).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  async function handleMarkInProgress() {
    if (!issue.relatedWorkItem || !onMarkInProgress) return;
    setMarking(true);
    try {
      await onMarkInProgress(issue.relatedWorkItem.id);
      setMarked(true);
    } finally {
      setMarking(false);
    }
  }

  const severityColor =
    issue.severity === "critical"
      ? "text-red-400"
      : issue.severity === "high"
      ? "text-orange-400"
      : issue.severity === "medium"
      ? "text-yellow-400"
      : "text-muted-foreground";

  const alreadyInProgress =
    issue.relatedWorkItem?.status === "in_progress" || marked;
  const alreadyDone =
    issue.relatedWorkItem?.status === "done" ||
    issue.relatedWorkItem?.status === "completed";

  return (
    <div className="rounded-lg border border-border bg-background/50 p-4 space-y-3">
      {/* Issue header */}
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
          {index + 1}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-foreground leading-snug">{issue.label}</p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {issue.severity !== "unknown" && (
              <span className={`text-xs font-semibold uppercase ${severityColor}`}>
                {issue.severity}
              </span>
            )}
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${cc.cls}`}>
              {cc.label}
            </span>
            {issue.relatedWorkItem && (
              <span className="text-[10px] text-muted-foreground font-mono">
                #{issue.relatedWorkItem.id.slice(0, 8)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Source metadata */}
      {(issue.sourceStep || issue.sourceComponent || issue.occurrenceCount > 1) && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground pl-9">
          {issue.sourceStep && (
            <span>📡 <span className="font-mono">{issue.sourceStep}</span></span>
          )}
          {issue.sourceComponent && (
            <span>📄 <span className="font-mono">{issue.sourceComponent}</span></span>
          )}
          {issue.occurrenceCount > 1 && (
            <span>🔁 Seen <strong className="text-foreground">{issue.occurrenceCount}×</strong></span>
          )}
        </div>
      )}

      {/* Work item status badge */}
      {issue.relatedWorkItem && (
        <div className="pl-9">
          <Badge
            variant={
              alreadyDone
                ? "default"
                : alreadyInProgress
                ? "secondary"
                : "outline"
            }
            className="text-[10px]"
          >
            Work item: {issue.relatedWorkItem.status}
          </Badge>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2 pl-9">
        {issue.relatedWorkItem && onSelectItem && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => onSelectItem(issue.relatedWorkItem!)}
          >
            <ExternalLink className="h-3 w-3" />
            Open issue
          </Button>
        )}

        {issue.relatedWorkItem && onMarkInProgress && !alreadyDone && (
          <Button
            variant={alreadyInProgress ? "secondary" : "outline"}
            size="sm"
            className="h-7 text-xs gap-1"
            disabled={marking || alreadyInProgress}
            onClick={handleMarkInProgress}
          >
            <Play className="h-3 w-3" />
            {marking ? "Updating…" : alreadyInProgress ? "In progress" : "Mark in progress"}
          </Button>
        )}

        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={handleCopy}
        >
          {copied ? (
            <><ClipboardCheck className="h-3 w-3 text-green-400" /> Copied!</>
          ) : (
            <><Clipboard className="h-3 w-3" /> Copy fix prompt</>
          )}
        </Button>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function SystemCommandCenter({
  latestRun,
  workItems = [],
  onSelectItem,
  onMarkInProgress,
}: SystemCommandCenterProps) {
  const health = deriveHealth(latestRun);
  const cfg = healthConfig[health];

  const enrichedIssues = collectEnrichedIssues(latestRun, workItems, 3);

  const ur = latestRun?.unified_result;
  const issueCount =
    (ur?.broken_flows?.length ?? 0) +
    (ur?.fake_features?.length ?? 0) +
    (ur?.interaction_failures?.length ?? 0) +
    (ur?.data_issues?.length ?? 0) +
    (ur?.issues?.length ?? 0);

  const impact = describeImpact(health, issueCount);

  return (
    <div className={`rounded-xl border-2 p-5 space-y-5 ${cfg.bg}`}>
      {/* Header */}
      <div className="flex items-center gap-3">
        <Zap className="h-5 w-5 text-primary" />
        <span className="text-base font-bold text-foreground tracking-wide uppercase">
          Command Center
        </span>
      </div>

      {/* Section 1 — System Status */}
      <div className="flex items-center gap-4">
        {cfg.icon}
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium">
            System Health
          </p>
          <p className={`text-3xl font-extrabold leading-none ${cfg.text}`}>
            {cfg.label}
          </p>
          {latestRun?.system_health_score != null && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Score: {latestRun.system_health_score}/100
            </p>
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-border/40" />

      {/* Section 2 + 3 — Problems + Actions */}
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium">
          {enrichedIssues.length > 1 ? "Top Problems — What To Do" : "Biggest Problem Right Now"}
        </p>

        {enrichedIssues.length > 0 ? (
          <div className="space-y-3">
            {enrichedIssues.map((issue, i) => (
              <IssueCard
                key={i}
                issue={issue}
                index={i}
                onSelectItem={onSelectItem}
                onMarkInProgress={onMarkInProgress}
              />
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2 py-2">
            <AlertCircle className="h-5 w-5 text-muted-foreground shrink-0" />
            <p className="text-base text-muted-foreground italic">
              {latestRun ? "No critical issues detected" : "No scan data available yet — run a scan to get started"}
            </p>
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="border-t border-border/40" />

      {/* Section 4 — Impact */}
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium">
          Impact If Ignored
        </p>
        <p className="text-sm text-foreground/80 leading-relaxed">{impact}</p>
      </div>
    </div>
  );
}
