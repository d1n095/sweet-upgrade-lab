import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ChevronRight, ChevronDown, Clipboard, CheckCircle } from "lucide-react";

// ── ISSUE_WHY: root-cause descriptions per _source ──────────────────────────
const ISSUE_WHY: Record<string, string> = {
  broken_flow:           "A user-facing flow is broken — steps fail to connect or complete.",
  interaction_failure:   "A UI interaction (button, form, link) does not respond as expected.",
  data_issue:            "Data is missing, malformed, or inconsistent in the database layer.",
  fake_feature:          "A feature is present in the UI but has no working backend implementation.",
  general:               "A general issue was detected by the scanner.",
};

// ── ISSUE_FIX: suggested fix direction per _source ───────────────────────────
const ISSUE_FIX: Record<string, string> = {
  broken_flow:           "Trace the flow steps, verify each handler fires, fix the broken step.",
  interaction_failure:   "Inspect the event handler and its dependencies; ensure side-effects complete.",
  data_issue:            "Audit the relevant DB table/query; add missing rows or fix constraints.",
  fake_feature:          "Implement the missing backend handler or remove the UI placeholder.",
  general:               "Review the issue details and apply the suggested fix.",
};

interface Issue {
  title?: string;
  description?: string;
  component?: string;
  route?: string;
  target?: string;
  area?: string;
  page?: string;
  element?: string;
  _source?: string;
  _impact_score?: number;
  _impact_label?: string;
  type?: string;
  category?: string;
  [key: string]: unknown;
}

interface IssueAnalysisPanelProps {
  latestRun: {
    id: string;
    unified_result?: Record<string, unknown> | null;
  } | null | undefined;
}

function impactColor(score: number | undefined): string {
  if (!score) return "text-muted-foreground";
  if (score >= 5) return "text-red-500";
  if (score >= 4) return "text-orange-500";
  if (score >= 3) return "text-yellow-500";
  return "text-green-500";
}

function impactBg(score: number | undefined): string {
  if (!score) return "";
  if (score >= 5) return "border-red-500/30 bg-red-500/5";
  if (score >= 4) return "border-orange-500/30 bg-orange-500/5";
  if (score >= 3) return "border-yellow-500/30 bg-yellow-500/5";
  return "border-green-500/30 bg-green-500/5";
}

function issueTitle(issue: Issue): string {
  return issue.title || issue.description || issue.element || issue.type || "Unnamed issue";
}

function issueTarget(issue: Issue): string {
  return issue.component || issue.route || issue.target || issue.area || issue.page || issue.element || "unknown";
}

export function IssueAnalysisPanel({ latestRun }: IssueAnalysisPanelProps) {
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [promptCopied, setPromptCopied] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const unified = latestRun?.unified_result as Record<string, unknown> | null | undefined;

  // ── Parse all issues from unified_result ────────────────────────────────────
  const allIssues: Issue[] = useMemo(() => {
    if (!unified) return [];
    const base = (unified.issues as Issue[] | undefined) ?? [];
    const broken = ((unified.broken_flows as Issue[] | undefined) ?? []).map(i => ({ ...i, _source: i._source ?? "broken_flow" }));
    const interact = ((unified.interaction_failures as Issue[] | undefined) ?? []).map(i => ({ ...i, _source: i._source ?? "interaction_failure" }));
    const data = ((unified.data_issues as Issue[] | undefined) ?? []).map(i => ({ ...i, _source: i._source ?? "data_issue" }));
    const fake = ((unified.fake_features as Issue[] | undefined) ?? []).map(i => ({ ...i, _source: i._source ?? "fake_feature" }));
    // Deduplicate by title+target
    const seen = new Set<string>();
    const merged = [...base, ...broken, ...interact, ...data, ...fake];
    return merged.filter(issue => {
      const key = `${issueTitle(issue)}|${issueTarget(issue)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [unified]);

  // ── Group issues by target ───────────────────────────────────────────────────
  const grouped = useMemo(() => {
    const map = new Map<string, Issue[]>();
    for (const issue of allIssues) {
      const t = issueTarget(issue);
      if (!map.has(t)) map.set(t, []);
      map.get(t)!.push(issue);
    }
    // Sort groups by max impact score descending
    return Array.from(map.entries()).sort((a, b) => {
      const maxA = Math.max(...a[1].map(i => i._impact_score ?? 0));
      const maxB = Math.max(...b[1].map(i => i._impact_score ?? 0));
      return maxB - maxA;
    });
  }, [allIssues]);

  // ── Prompt generator ────────────────────────────────────────────────────────
  const generatePrompt = (issue: Issue): string => {
    const src = issue._source ?? "general";
    const why = ISSUE_WHY[src] ?? ISSUE_WHY.general;
    const fix = ISSUE_FIX[src] ?? ISSUE_FIX.general;
    return [
      `FILE: ${issueTarget(issue)}`,
      `ISSUE: ${issueTitle(issue)}`,
      `SOURCE: ${src}`,
      `WHY: ${why}`,
      `FIX: ${fix}`,
      issue._impact_label ? `IMPACT: ${issue._impact_label} (score ${issue._impact_score ?? "?"}/5)` : "",
      `SCAN_ID: ${latestRun?.id ?? "unknown"}`,
      `DO NOT modify unrelated code.`,
    ].filter(Boolean).join("\n");
  };

  const handleCopyPrompt = (issue: Issue) => {
    navigator.clipboard.writeText(generatePrompt(issue)).then(() => {
      setPromptCopied(true);
      setTimeout(() => setPromptCopied(false), 2000);
    });
  };

  const toggleGroup = (target: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(target)) next.delete(target);
      else next.add(target);
      return next;
    });
  };

  // ── Failsafe: no data ────────────────────────────────────────────────────────
  if (!latestRun) {
    return (
      <Card>
        <CardContent className="p-4">
          <p className="text-[10px] text-muted-foreground">No scan run available. Run a full scan first.</p>
        </CardContent>
      </Card>
    );
  }

  if (!unified) {
    return (
      <Card>
        <CardContent className="p-4">
          <p className="text-[10px] text-yellow-500">⚠ unified_result missing from latest scan_run (id: {latestRun.id?.slice(0, 8)})</p>
        </CardContent>
      </Card>
    );
  }

  if (allIssues.length === 0) {
    return (
      <Card>
        <CardContent className="p-4">
          <p className="text-[10px] text-green-500">✓ No issues found in latest scan.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {/* Summary bar */}
      <Card>
        <CardContent className="p-3 flex items-center gap-4">
          <div className="flex flex-col items-center px-3 py-1.5 rounded-md bg-muted/30 border border-border">
            <span className="text-[9px] text-muted-foreground">total issues</span>
            <span className="text-lg font-bold text-foreground">{allIssues.length}</span>
          </div>
          <div className="flex flex-col items-center px-3 py-1.5 rounded-md bg-muted/30 border border-border">
            <span className="text-[9px] text-muted-foreground">targets</span>
            <span className="text-lg font-bold text-foreground">{grouped.length}</span>
          </div>
          <div className="flex flex-col items-center px-3 py-1.5 rounded-md bg-red-500/10 border border-red-500/20">
            <span className="text-[9px] text-muted-foreground">critical (≥5)</span>
            <span className="text-lg font-bold text-red-500">{allIssues.filter(i => (i._impact_score ?? 0) >= 5).length}</span>
          </div>
          <span className="text-[9px] text-muted-foreground font-mono ml-auto">scan_run: {latestRun.id?.slice(0, 8)}…</span>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {/* Issue list grouped by target */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> Issues by Target
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3">
            <div className="space-y-1 max-h-[500px] overflow-auto">
              {grouped.map(([target, issues]) => {
                const expanded = expandedGroups.has(target);
                const maxScore = Math.max(...issues.map(i => i._impact_score ?? 0));
                return (
                  <div key={target} className={`rounded-md border ${impactBg(maxScore)}`}>
                    <button
                      className="w-full flex items-center gap-2 px-2 py-1.5 text-[10px] text-left"
                      onClick={() => toggleGroup(target)}
                    >
                      {expanded ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />}
                      <span className="font-mono font-medium text-foreground flex-1 truncate">{target}</span>
                      <Badge variant="outline" className={`text-[8px] px-1 py-0 ${impactColor(maxScore)}`}>
                        {issues.length} issue{issues.length !== 1 ? "s" : ""}
                      </Badge>
                    </button>
                    {expanded && (
                      <div className="px-2 pb-1.5 space-y-0.5">
                        {issues.map((issue, i) => (
                          <button
                            key={i}
                            className={`w-full text-left rounded px-2 py-1 text-[9px] transition-colors ${selectedIssue === issue ? "bg-primary/20 text-primary" : "hover:bg-muted/40 text-muted-foreground"}`}
                            onClick={() => setSelectedIssue(issue)}
                          >
                            <span className={`font-medium mr-1 ${impactColor(issue._impact_score)}`}>
                              [{issue._impact_score ?? "?"}]
                            </span>
                            {issueTitle(issue)}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Detail panel */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Issue Detail</CardTitle>
          </CardHeader>
          <CardContent className="p-3">
            {!selectedIssue ? (
              <p className="text-[10px] text-muted-foreground">Select an issue to see details.</p>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold text-foreground">{issueTitle(selectedIssue)}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    {selectedIssue._source && (
                      <Badge variant="outline" className="text-[8px] px-1.5 py-0">{selectedIssue._source}</Badge>
                    )}
                    {selectedIssue._impact_label && (
                      <Badge variant="outline" className={`text-[8px] px-1.5 py-0 ${impactColor(selectedIssue._impact_score)}`}>
                        {selectedIssue._impact_label}
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="rounded-md bg-muted/30 border border-border p-2 space-y-1.5">
                  <p className="text-[9px]">
                    <span className="text-muted-foreground">Target: </span>
                    <span className="font-mono text-foreground">{issueTarget(selectedIssue)}</span>
                  </p>
                  <p className="text-[9px]">
                    <span className="text-muted-foreground">Impact: </span>
                    <span className={`font-semibold ${impactColor(selectedIssue._impact_score)}`}>
                      {selectedIssue._impact_score ?? "?"}/5
                    </span>
                  </p>
                </div>

                {selectedIssue._source && (
                  <div className="space-y-1.5">
                    <div className="rounded-md bg-muted/20 border border-border p-2">
                      <p className="text-[8px] text-muted-foreground font-semibold uppercase tracking-wide mb-0.5">Why</p>
                      <p className="text-[9px] text-foreground">{ISSUE_WHY[selectedIssue._source] ?? ISSUE_WHY.general}</p>
                    </div>
                    <div className="rounded-md bg-muted/20 border border-border p-2">
                      <p className="text-[8px] text-muted-foreground font-semibold uppercase tracking-wide mb-0.5">Fix</p>
                      <p className="text-[9px] text-foreground">{ISSUE_FIX[selectedIssue._source] ?? ISSUE_FIX.general}</p>
                    </div>
                  </div>
                )}

                {/* Prompt generator */}
                <div className="space-y-1">
                  <p className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wide">Prompt</p>
                  <pre className="text-[8px] font-mono bg-muted/30 border border-border rounded-md p-2 whitespace-pre-wrap text-foreground max-h-[140px] overflow-auto">
                    {generatePrompt(selectedIssue)}
                  </pre>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-[9px] h-6 gap-1"
                    onClick={() => handleCopyPrompt(selectedIssue)}
                  >
                    {promptCopied ? <CheckCircle className="h-3 w-3 text-green-500" /> : <Clipboard className="h-3 w-3" />}
                    {promptCopied ? "Copied!" : "Copy Prompt"}
                  </Button>
                </div>

                {/* Raw JSON */}
                <details>
                  <summary className="text-[9px] text-muted-foreground cursor-pointer hover:text-foreground">Raw JSON</summary>
                  <pre className="mt-1 text-[8px] font-mono bg-muted/30 border border-border rounded-md p-2 whitespace-pre-wrap text-muted-foreground max-h-[200px] overflow-auto">
                    {JSON.stringify(selectedIssue, null, 2)}
                  </pre>
                </details>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
