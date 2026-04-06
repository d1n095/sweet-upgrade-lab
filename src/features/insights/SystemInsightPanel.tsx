import React, { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, CheckCircle, AlertOctagon, TrendingUp } from "lucide-react";

type ScanRun = Record<string, unknown> | null;

interface SystemInsightPanelProps {
  latestRun: ScanRun;
}

interface IssueItem {
  title?: string;
  message?: string;
  description?: string;
  target?: string;
  component?: string;
  route?: string;
  _source?: string;
  [key: string]: unknown;
}

function toItems(val: unknown, source: string): IssueItem[] {
  if (!Array.isArray(val)) return [];
  return (val as IssueItem[]).map(i => ({ ...i, _source: i._source ?? source }));
}

function itemLabel(item: IssueItem): string {
  return (
    (item.title as string) ||
    (item.message as string) ||
    (item.description as string) ||
    item._source ||
    "Issue"
  );
}

export function SystemInsightPanel({ latestRun }: SystemInsightPanelProps) {
  const unified =
    (latestRun?.unified_result as Record<string, unknown> | null | undefined) ?? null;

  const issues = useMemo(() => toItems(unified?.issues, "issue"), [unified]);
  const brokenFlows = useMemo(() => toItems(unified?.broken_flows, "broken_flow"), [unified]);
  const dataIssues = useMemo(() => toItems(unified?.data_issues, "data_issue"), [unified]);
  const interactionFailures = useMemo(
    () => toItems(unified?.interaction_failures, "interaction_failure"),
    [unified],
  );
  const fakeFeatures = useMemo(
    () => toItems(unified?.fake_features, "fake_feature"),
    [unified],
  );

  const highCount = brokenFlows.length + fakeFeatures.length;
  const mediumCount = interactionFailures.length;
  const lowCount = dataIssues.length;
  const totalIssues =
    issues.length +
    brokenFlows.length +
    dataIssues.length +
    interactionFailures.length +
    fakeFeatures.length;

  const health: "GOOD" | "WARNING" | "CRITICAL" =
    highCount > 0
      ? "CRITICAL"
      : mediumCount > 0 || lowCount > 0 || issues.length > 0
      ? "WARNING"
      : "GOOD";

  const top3: IssueItem[] = useMemo(() => {
    const highItems = [...brokenFlows, ...fakeFeatures];
    const medItems = [...interactionFailures];
    const lowItems = [...dataIssues, ...issues];
    return [...highItems, ...medItems, ...lowItems].slice(0, 3);
  }, [brokenFlows, fakeFeatures, interactionFailures, dataIssues, issues]);

  if (!latestRun) {
    return (
      <div className="p-6 text-center text-muted-foreground text-sm">
        No scan data available. Run a scan first.
      </div>
    );
  }

  if (!unified) {
    return (
      <div className="p-6 text-center text-muted-foreground text-sm">
        Scan completed but no unified result found yet.
      </div>
    );
  }

  const healthBadgeVariant: "default" | "secondary" | "destructive" =
    health === "CRITICAL" ? "destructive" : health === "WARNING" ? "secondary" : "default";

  const HealthIcon =
    health === "CRITICAL" ? AlertOctagon : health === "WARNING" ? AlertTriangle : CheckCircle;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold">System Insight</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Health status */}
        <Card>
          <CardHeader className="pb-1 pt-3 px-3">
            <CardTitle className="text-xs text-muted-foreground">System Health</CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="flex items-center gap-1">
              <HealthIcon className="h-4 w-4" />
              <Badge variant={healthBadgeVariant} className="text-xs">
                {health}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Total issues */}
        <Card>
          <CardHeader className="pb-1 pt-3 px-3">
            <CardTitle className="text-xs text-muted-foreground">Total Issues</CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <span className="text-2xl font-bold">{totalIssues}</span>
          </CardContent>
        </Card>

        {/* Severity breakdown */}
        <Card className="col-span-2">
          <CardHeader className="pb-1 pt-3 px-3">
            <CardTitle className="text-xs text-muted-foreground">Severity Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="flex gap-2 flex-wrap">
              <Badge variant="destructive" className="text-xs">
                High: {highCount}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                Medium: {mediumCount}
              </Badge>
              <Badge variant="outline" className="text-xs">
                Low: {lowCount}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top 3 problems */}
      <Card>
        <CardHeader className="pb-2 pt-3 px-3">
          <CardTitle className="text-xs text-muted-foreground">Top Problems</CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3">
          {top3.length === 0 ? (
            <p className="text-xs text-muted-foreground">No critical issues detected.</p>
          ) : (
            <ul className="space-y-2">
              {top3.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-xs">
                  <Badge
                    variant={
                      item._source === "broken_flow" || item._source === "fake_feature"
                        ? "destructive"
                        : item._source === "interaction_failure"
                        ? "secondary"
                        : "outline"
                    }
                    className="text-[10px] shrink-0 mt-0.5"
                  >
                    {item._source}
                  </Badge>
                  <span className="text-muted-foreground">{itemLabel(item)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
