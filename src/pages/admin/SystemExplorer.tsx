import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Database, Activity, Bug, CheckCircle, AlertTriangle, Clock, Shield } from "lucide-react";

const SystemExplorer = () => {
  // 1. ALL work_items
  const { data: workItems = [], isLoading: wiLoading } = useQuery({
    queryKey: ["system-explorer-work-items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("work_items")
        .select("id, title, status, source_type, item_type, priority, ai_detected, created_at, issue_fingerprint, ignored")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
  });

  // 2. Latest scan
  const { data: latestScan, isLoading: scanLoading } = useQuery({
    queryKey: ["system-explorer-latest-scan"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_scan_results")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // 3. Flow counts
  const activeCount = workItems.filter((w) => w.status === "open" || w.status === "in_progress").length;
  const completedCount = workItems.filter((w) => w.status === "done" || w.status === "completed").length;
  const ignoredCount = workItems.filter((w) => w.ignored).length;
  const scanSourceCount = workItems.filter((w) => w.source_type === "scan" || w.source_type === "ai_scan").length;
  const manualSourceCount = workItems.filter((w) => w.source_type === "manual").length;

  const scanResults = latestScan?.results as Record<string, any> | null;
  const detectedIssues = scanResults?.master_list?.total ?? scanResults?.detected_issues?.length ?? latestScan?.issues_count ?? 0;

  const priorityColor = (p: string) => {
    switch (p) {
      case "critical": return "destructive";
      case "high": return "default";
      case "medium": return "secondary";
      default: return "outline";
    }
  };

  const statusColor = (s: string) => {
    switch (s) {
      case "open": return "default";
      case "in_progress": return "secondary";
      case "done":
      case "completed": return "outline";
      default: return "outline";
    }
  };

  return (
    <div className="space-y-6 p-4">
      <div className="flex items-center gap-2">
        <Database className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">System Explorer</h1>
        <Badge variant="outline" className="ml-2">READ-ONLY</Badge>
      </div>

      {/* SECTION 3: FLOW STATUS */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <AlertTriangle className="h-5 w-5 mx-auto mb-1 text-orange-500" />
            <div className="text-2xl font-bold">{detectedIssues}</div>
            <div className="text-xs text-muted-foreground">Detected Issues</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Activity className="h-5 w-5 mx-auto mb-1 text-blue-500" />
            <div className="text-2xl font-bold">{workItems.length}</div>
            <div className="text-xs text-muted-foreground">Total Work Items</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Clock className="h-5 w-5 mx-auto mb-1 text-yellow-500" />
            <div className="text-2xl font-bold">{activeCount}</div>
            <div className="text-xs text-muted-foreground">Active</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <CheckCircle className="h-5 w-5 mx-auto mb-1 text-green-500" />
            <div className="text-2xl font-bold">{completedCount}</div>
            <div className="text-xs text-muted-foreground">Completed</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Bug className="h-5 w-5 mx-auto mb-1 text-purple-500" />
            <div className="text-2xl font-bold">{scanSourceCount}</div>
            <div className="text-xs text-muted-foreground">From Scans</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Shield className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
            <div className="text-2xl font-bold">{manualSourceCount}</div>
            <div className="text-xs text-muted-foreground">Manual</div>
          </CardContent>
        </Card>
      </div>

      {/* SECTION 4: DEBUG FLAGS */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Debug Flags</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-4 text-sm">
          <div>Dedup active: <Badge variant="outline">{workItems.some((w) => w.issue_fingerprint) ? "true" : "false"}</Badge></div>
          <div>Ignored items: <Badge variant="outline">{ignoredCount > 0 ? `${ignoredCount} ignored` : "none"}</Badge></div>
          <div>Cleanup (orphan fn): <Badge variant="outline">available</Badge></div>
        </CardContent>
      </Card>

      {/* SECTION 2: LATEST SCAN */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Latest Scan Result</CardTitle>
        </CardHeader>
        <CardContent>
          {scanLoading ? (
            <p className="text-sm text-muted-foreground">Laddar...</p>
          ) : latestScan ? (
            <div className="space-y-2 text-sm">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div><span className="text-muted-foreground">ID:</span> {latestScan.id.slice(0, 8)}…</div>
                <div><span className="text-muted-foreground">Typ:</span> {latestScan.scan_type}</div>
                <div><span className="text-muted-foreground">Score:</span> {latestScan.overall_score ?? "–"}</div>
                <div><span className="text-muted-foreground">Issues:</span> {latestScan.issues_count ?? 0}</div>
                <div><span className="text-muted-foreground">Tasks skapade:</span> {latestScan.tasks_created ?? 0}</div>
                <div><span className="text-muted-foreground">Status:</span> {latestScan.overall_status ?? "–"}</div>
                <div className="col-span-2"><span className="text-muted-foreground">Skapad:</span> {format(new Date(latestScan.created_at), "yyyy-MM-dd HH:mm")}</div>
              </div>
              {latestScan.executive_summary && (
                <p className="text-muted-foreground border-t pt-2 mt-2">{latestScan.executive_summary}</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Ingen scan hittad.</p>
          )}
        </CardContent>
      </Card>

      {/* SECTION 1: WORK ITEMS TABLE */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Work Items ({workItems.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {wiLoading ? (
            <p className="p-4 text-sm text-muted-foreground">Laddar...</p>
          ) : (
            <div className="overflow-auto max-h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>AI</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {workItems.map((wi) => (
                    <TableRow key={wi.id} className={wi.ignored ? "opacity-50" : ""}>
                      <TableCell className="max-w-[300px] truncate text-xs">{wi.title}</TableCell>
                      <TableCell><Badge variant={statusColor(wi.status)}>{wi.status}</Badge></TableCell>
                      <TableCell><Badge variant={priorityColor(wi.priority)}>{wi.priority}</Badge></TableCell>
                      <TableCell className="text-xs">{wi.item_type}</TableCell>
                      <TableCell className="text-xs">{wi.source_type ?? "–"}</TableCell>
                      <TableCell className="text-xs">{wi.ai_detected ? "✓" : "–"}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{format(new Date(wi.created_at), "MM-dd HH:mm")}</TableCell>
                    </TableRow>
                  ))}
                  {workItems.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">Inga work items.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SystemExplorer;
