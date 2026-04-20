/**
 * SIGNAL DEDUPLICATOR
 *
 * GOAL: Prevent multiple systems from reporting the same underlying issue.
 *
 * RULES:
 *   D1. GROUP IDENTICAL ERRORS — signals with the same fingerprint are grouped.
 *   D2. MERGE INTO SINGLE ISSUE — each group becomes one UnifiedIssue.
 *   D3. ASSIGN SEVERITY SCORE  — score = max(severity rank) + reporter-count bonus.
 *
 * AUTHORITY: READ-ONLY REPORTER. Produces data only.
 */

export type SignalSeverity = "info" | "warning" | "critical";

export interface RawSignal {
  module: string;
  severity: SignalSeverity;
  message: string;
  location?: string;
  code?: string;
  detail?: string;
}

export interface UnifiedIssue {
  fingerprint: string;
  severity: SignalSeverity;
  score: number;
  message: string;
  location: string | null;
  code: string | null;
  reporters: string[];
  occurrences: number;
  first_seen_at: string;
  details: string[];
}

export interface DeduplicationReport {
  generated_at: string;
  signals_in: number;
  unique_issues_out: number;
  issue_count_reduced: number;
  reduction_ratio: number;
  by_severity: Record<SignalSeverity, number>;
  unique_issues: UnifiedIssue[];
}

const SEVERITY_RANK: Record<SignalSeverity, number> = {
  info: 10,
  warning: 40,
  critical: 80,
};

function normalizeMessage(msg: string): string {
  return msg
    .toLowerCase()
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, "<uuid>")
    .replace(/\b\d{4}-\d{2}-\d{2}t[\d:.z+-]+/g, "<ts>")
    .replace(/\b\d+\b/g, "<n>")
    .replace(/\s+/g, " ")
    .trim();
}

export function fingerprintOf(s: RawSignal): string {
  return [s.code ?? "_", s.location ?? "_", normalizeMessage(s.message)].join("::");
}

function pickHighestSeverity(a: SignalSeverity, b: SignalSeverity): SignalSeverity {
  return SEVERITY_RANK[a] >= SEVERITY_RANK[b] ? a : b;
}

function scoreOf(severity: SignalSeverity, reporterCount: number): number {
  const bonus = Math.min(20, Math.max(0, reporterCount - 1) * 5);
  return SEVERITY_RANK[severity] + bonus;
}

export function deduplicateSignals(signals: RawSignal[]): DeduplicationReport {
  const groups = new Map<string, RawSignal[]>();
  for (const s of signals) {
    const fp = fingerprintOf(s);
    const arr = groups.get(fp) ?? [];
    arr.push(s);
    groups.set(fp, arr);
  }

  const now = new Date().toISOString();
  const unique: UnifiedIssue[] = [];

  for (const [fp, group] of groups) {
    const reporters = Array.from(new Set(group.map((g) => g.module))).sort();
    const severity = group.reduce<SignalSeverity>(
      (acc, g) => pickHighestSeverity(acc, g.severity),
      "info"
    );
    const message =
      group
        .map((g) => g.message)
        .filter((m) => !!m)
        .sort((a, b) => b.length - a.length)[0] ?? "";
    const details = Array.from(
      new Set(group.map((g) => g.detail).filter((d): d is string => !!d))
    );
    unique.push({
      fingerprint: fp,
      severity,
      score: scoreOf(severity, reporters.length),
      message,
      location: group[0].location ?? null,
      code: group[0].code ?? null,
      reporters,
      occurrences: group.length,
      first_seen_at: now,
      details,
    });
  }

  unique.sort((a, b) => b.score - a.score);

  const by_severity: Record<SignalSeverity, number> = { info: 0, warning: 0, critical: 0 };
  for (const u of unique) by_severity[u.severity]++;

  const reduced = signals.length - unique.length;
  return {
    generated_at: now,
    signals_in: signals.length,
    unique_issues_out: unique.length,
    issue_count_reduced: reduced,
    reduction_ratio: signals.length === 0 ? 0 : reduced / signals.length,
    by_severity,
    unique_issues: unique,
  };
}
