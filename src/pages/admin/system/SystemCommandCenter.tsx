import React from "react";
import { AlertTriangle, CheckCircle, XCircle, Zap, AlertCircle } from "lucide-react";

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

interface SystemCommandCenterProps {
  latestRun?: ScanRun | null;
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

function pickBiggestProblem(run: ScanRun | null | undefined): any | null {
  if (!run?.unified_result) return null;
  const ur = run.unified_result;
  const all: any[] = [
    ...(ur.broken_flows ?? []),
    ...(ur.fake_features ?? []),
    ...(ur.interaction_failures ?? []),
    ...(ur.data_issues ?? []),
    ...(ur.issues ?? []),
  ];
  if (all.length === 0) return null;

  // Prefer highest severity
  const severityRank = (item: any) => {
    const s = (item.severity ?? item.analysis_rating ?? "").toLowerCase();
    if (s === "critical") return 4;
    if (s === "high") return 3;
    if (s === "medium") return 2;
    if (s === "low") return 1;
    return 0;
  };

  return all.reduce((best, cur) => (severityRank(cur) >= severityRank(best) ? cur : best), all[0]);
}

function buildActions(run: ScanRun | null | undefined, health: "GOOD" | "WARNING" | "CRITICAL"): string[] {
  if (!run) return ["Run a system scan to get started"];

  const ur = run.unified_result;
  const all: any[] = [
    ...(ur?.broken_flows ?? []),
    ...(ur?.fake_features ?? []),
    ...(ur?.interaction_failures ?? []),
    ...(ur?.data_issues ?? []),
    ...(ur?.issues ?? []),
  ];

  if (all.length === 0 && health === "GOOD") {
    return ["System looks healthy — no immediate action needed", "Run another scan to stay up to date"];
  }

  // Deduplicate by type and pick top 3
  const seen = new Set<string>();
  const actions: string[] = [];

  for (const item of all) {
    if (actions.length >= 3) break;
    const title: string =
      item.title ??
      item.message ??
      item.description ??
      item.flow_name ??
      item.feature_name ??
      item.issue_type ??
      "Unknown issue";
    if (!seen.has(title)) {
      seen.add(title);
      actions.push(`Fix: ${title}`);
    }
  }

  if (actions.length === 0) {
    actions.push("Review flagged issues in the Analysis tab");
  }

  return actions.slice(0, 3);
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

export function SystemCommandCenter({ latestRun }: SystemCommandCenterProps) {
  const health = deriveHealth(latestRun);
  const biggestProblem = pickBiggestProblem(latestRun);
  const actions = buildActions(latestRun, health);

  const ur = latestRun?.unified_result;
  const issueCount =
    (ur?.broken_flows?.length ?? 0) +
    (ur?.fake_features?.length ?? 0) +
    (ur?.interaction_failures?.length ?? 0) +
    (ur?.data_issues?.length ?? 0) +
    (ur?.issues?.length ?? 0);

  const impact = describeImpact(health, issueCount);
  const cfg = healthConfig[health];

  const bigProblemLabel: string =
    biggestProblem?.title ??
    biggestProblem?.message ??
    biggestProblem?.description ??
    biggestProblem?.flow_name ??
    biggestProblem?.feature_name ??
    biggestProblem?.issue_type ??
    null;

  const bigProblemSeverity: string =
    biggestProblem?.severity ?? biggestProblem?.analysis_rating ?? null;

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

      {/* Section 2 — Biggest Problem */}
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium">
          Biggest Problem Right Now
        </p>
        {bigProblemLabel ? (
          <div className="flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-orange-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-lg font-bold text-foreground leading-snug">
                {bigProblemLabel}
              </p>
              {bigProblemSeverity && (
                <span className={`text-xs font-semibold uppercase ${
                  bigProblemSeverity.toLowerCase() === "critical"
                    ? "text-red-400"
                    : bigProblemSeverity.toLowerCase() === "high"
                    ? "text-orange-400"
                    : "text-yellow-400"
                }`}>
                  {bigProblemSeverity} severity
                </span>
              )}
            </div>
          </div>
        ) : (
          <p className="text-base text-muted-foreground italic">
            {latestRun ? "No critical issues detected" : "No scan data available yet"}
          </p>
        )}
      </div>

      {/* Divider */}
      <div className="border-t border-border/40" />

      {/* Section 3 — What To Do */}
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium">
          What To Do
        </p>
        <ol className="space-y-1.5">
          {actions.map((action, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[11px] font-bold text-primary">
                {i + 1}
              </span>
              <p className="text-sm font-semibold text-foreground leading-snug">{action}</p>
            </li>
          ))}
        </ol>
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
