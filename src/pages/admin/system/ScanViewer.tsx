import { format } from "date-fns";
import { Radar, Activity, ArrowRight, Database } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface ScanRun {
  id?: string;
  created_at: string;
  issues_count?: number;
  tasks_created?: number;
  overall_status?: string;
  executive_summary?: string;
  results?: Record<string, any>;
}

interface ScanViewerProps {
  latestBackendScan: ScanRun | null | undefined;
  backendScanLoading: boolean;
  showBackendRaw: boolean;
  setShowBackendRaw: (v: boolean) => void;
}

export const ScanViewer = ({
  latestBackendScan,
  backendScanLoading,
  showBackendRaw,
  setShowBackendRaw,
}: ScanViewerProps) => {
  const r = latestBackendScan?.results as any;
  const latestRun = r;

  return (
    <div className="space-y-3">
      {latestBackendScan && latestRun && latestRun.work_items_created === 0 && (
        <p className="text-[10px] text-yellow-500 font-mono">⚠ Scan produced no work_items (possible over-filtering / dedup block)</p>
      )}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Radar className="h-4 w-4" /> Backend Scan <span className="text-[9px] text-green-500/80 font-mono ml-2">✔ Real scan (Supabase)</span></CardTitle>
        </CardHeader>
        <CardContent className="p-3">
          {backendScanLoading ? (
            <p className="text-[10px] text-muted-foreground">Loading...</p>
          ) : !latestBackendScan ? (
            <p className="text-[10px] text-muted-foreground">No backend scan found</p>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div><span className="text-muted-foreground">Scan ID:</span> <span className="font-mono text-foreground">{latestBackendScan.id?.slice(0, 8)}</span></div>
                <div><span className="text-muted-foreground">Created:</span> <span className="text-foreground">{format(new Date(latestBackendScan.created_at), "yyyy-MM-dd HH:mm")}</span></div>
                <div><span className="text-muted-foreground">Detected:</span> <span className="text-foreground">{r?.detected_count ?? latestBackendScan.issues_count ?? "—"}</span></div>
                <div><span className="text-muted-foreground">Created:</span> <span className="text-foreground">{r?.created_count ?? latestBackendScan.tasks_created ?? "—"}</span></div>
                <div><span className="text-muted-foreground">Filtered:</span> <span className="text-foreground">{r?.filtered_count ?? "—"}</span></div>
                <div><span className="text-muted-foreground">Skipped:</span> <span className="text-foreground">{r?.skipped_count ?? "—"}</span></div>
              </div>
              {latestBackendScan.overall_status && (
                <Badge className={`text-[8px] ${latestBackendScan.overall_status === "healthy" ? "bg-green-500/20 text-green-500 border-green-500/30" : "bg-yellow-500/20 text-yellow-500 border-yellow-500/30"}`}>{latestBackendScan.overall_status}</Badge>
              )}
              {latestBackendScan.executive_summary && (
                <p className="text-[9px] text-muted-foreground mt-1">{latestBackendScan.executive_summary}</p>
              )}
              {(r?.detected_count ?? latestBackendScan.issues_count ?? 0) === 0 && (
                <p className="text-[10px] text-yellow-500 mt-1">⚠ Scan returned no data — check input or scanner connection</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Scanner Execution */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Activity className="h-4 w-4" /> Scanner Execution</CardTitle>
        </CardHeader>
        <CardContent className="p-3">
          {(() => {
            const stepResults = r?.step_results || r?.steps_results || r?.scanners || null;
            if (!stepResults || typeof stepResults !== "object" || Object.keys(stepResults).length === 0) {
              return <p className="text-[10px] text-muted-foreground">No scanner execution data</p>;
            }
            return (
              <div className="space-y-1">
                {Object.entries(stepResults).map(([name, result]: [string, any]) => {
                  const failed = result?.failed || result?.error;
                  const issuesFound = result?.issues_found ?? result?.issues_count ?? result?.count ?? "—";
                  const status = failed ? "failed" : (result && !result?.skipped) ? "success" : "no data";
                  const statusColor = status === "success" ? "text-green-500" : status === "failed" ? "text-red-500" : "text-muted-foreground";
                  return (
                    <div key={name} className="flex items-center gap-2 text-[10px] py-1 border-b border-border/50">
                      <span className="font-mono text-foreground flex-1">{name}</span>
                      <span className={`font-medium ${statusColor}`}>{status}</span>
                      <span className="text-muted-foreground min-w-[60px] text-right">issues: {issuesFound}</span>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </CardContent>
      </Card>

      {/* Pipeline Summary */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><ArrowRight className="h-4 w-4" /> Pipeline Summary</CardTitle>
        </CardHeader>
        <CardContent className="p-3">
          {(() => {
            const scanned = r?.detected_count ?? r?.scanned ?? latestBackendScan?.issues_count ?? 0;
            const afterFilter = r?.after_filter ?? r?.filtered_count ?? "—";
            const skippedDedup = r?.skipped_dedup ?? r?.skipped_count ?? r?.deduplicated ?? "—";
            const created = r?.created_count ?? latestBackendScan?.tasks_created ?? 0;
            return (
              <div className="flex items-center gap-1 text-[10px]">
                <div className="flex flex-col items-center px-3 py-2 rounded-md bg-muted/30 border border-border">
                  <span className="text-muted-foreground">scanned</span>
                  <span className="text-lg font-bold text-foreground">{scanned}</span>
                </div>
                <span className="text-muted-foreground">→</span>
                <div className="flex flex-col items-center px-3 py-2 rounded-md bg-muted/30 border border-border">
                  <span className="text-muted-foreground">after_filter</span>
                  <span className="text-lg font-bold text-foreground">{afterFilter}</span>
                </div>
                <span className="text-muted-foreground">→</span>
                <div className="flex flex-col items-center px-3 py-2 rounded-md bg-muted/30 border border-border">
                  <span className="text-muted-foreground">skipped_dedup</span>
                  <span className="text-lg font-bold text-foreground">{skippedDedup}</span>
                </div>
                <span className="text-muted-foreground">→</span>
                <div className="flex flex-col items-center px-3 py-2 rounded-md bg-green-500/10 border border-green-500/20">
                  <span className="text-muted-foreground">created</span>
                  <span className="text-lg font-bold text-green-500">{created}</span>
                </div>
              </div>
            );
          })()}
        </CardContent>
      </Card>

      {/* View Backend Raw */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2"><Database className="h-4 w-4" /> Backend Raw Output</CardTitle>
          <Button variant="outline" size="sm" className="text-[10px] h-6" onClick={() => setShowBackendRaw(!showBackendRaw)}>
            {showBackendRaw ? "Hide" : "View Backend Raw"}
          </Button>
        </CardHeader>
        {showBackendRaw && (
          <CardContent className="p-3">
            {!latestBackendScan?.results ? (
              <p className="text-[10px] text-muted-foreground">No raw data available</p>
            ) : (() => {
              const raw = latestBackendScan.results as any;
              const issues = raw?.issues || raw?.broken_flows || raw?.data_issues || raw?.fake_features || raw?.interaction_failures || [];
              const allIssues = Array.isArray(issues) ? issues.slice(0, 50) : [];
              return allIssues.length === 0 ? (
                <div>
                  <p className="text-[10px] text-muted-foreground mb-2">No issue array found. Raw keys: {Object.keys(raw).join(", ")}</p>
                  <pre className="text-[9px] font-mono bg-muted/30 border border-border rounded-md p-2 max-h-[300px] overflow-auto whitespace-pre-wrap text-foreground">{JSON.stringify(raw, null, 2).slice(0, 5000)}</pre>
                </div>
              ) : (
                <div className="space-y-1 max-h-[400px] overflow-auto">
                  <p className="text-[10px] text-muted-foreground mb-1">Showing {allIssues.length} of {Array.isArray(issues) ? issues.length : "?"} issues</p>
                  {allIssues.map((issue: any, i: number) => (
                    <details key={i} className="border border-border/50 rounded-md p-1.5 text-[9px]">
                      <summary className="cursor-pointer font-mono text-foreground truncate flex items-center gap-1">{issue.title || issue.description || issue.message || JSON.stringify(issue).slice(0, 100)}{issue._status && <Badge variant={issue._status === "created" ? "default" : issue._status === "error" ? "destructive" : "secondary"} className="text-[8px] px-1 py-0 ml-1">{issue._status}</Badge>}</summary>
                      <pre className="mt-1 font-mono text-[8px] text-muted-foreground whitespace-pre-wrap">{JSON.stringify(issue, null, 2)}</pre>
                    </details>
                  ))}
                </div>
              );
            })()}
          </CardContent>
        )}
      </Card>
    </div>
  );
};

export default ScanViewer;
