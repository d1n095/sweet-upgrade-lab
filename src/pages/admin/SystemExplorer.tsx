import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Database, Activity, Bug, CheckCircle, AlertTriangle, Clock, Shield, ChevronRight, ChevronDown, X, Folder, FolderOpen, FileText, RefreshCw, Cpu, ArrowRight, Filter, Layers, History } from "lucide-react";
import { Button } from "@/components/ui/button";

type WorkItem = {
  id: string;
  title: string;
  status: string;
  source_type: string | null;
  source_id: string | null;
  created_by: string | null;
  item_type: string;
  priority: string;
  ai_detected: boolean | null;
  created_at: string;
  issue_fingerprint: string | null;
  ignored: boolean | null;
};

const SystemExplorer = () => {
  const queryClient = useQueryClient();
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({ workItems: true, scanResults: true, aiFlow: true });
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({ open: true, in_progress: true, done: false, completed: false, cancelled: false });
  const [selectedItem, setSelectedItem] = useState<WorkItem | null>(null);
  const [detailTab, setDetailTab] = useState<"info" | "history">("info");
  const [isRefreshing, setIsRefreshing] = useState(false);

  // 1. ALL work_items
  const { data: workItems = [], isLoading: wiLoading } = useQuery({
    queryKey: ["system-explorer-work-items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("work_items")
        .select("id, title, status, source_type, source_id, created_by, item_type, priority, ai_detected, created_at, issue_fingerprint, ignored")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["system-explorer-work-items"] }),
      queryClient.invalidateQueries({ queryKey: ["system-explorer-latest-scan"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-work-items"] }),
    ]);
    setIsRefreshing(false);
  };

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

  // 2b. Latest scan_run for pipeline data
  const { data: latestRun } = useQuery({
    queryKey: ["system-explorer-latest-run"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scan_runs")
        .select("id, status, total_new_issues, work_items_created, created_at, unified_result")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // 3b. History for selected item
  const { data: itemHistory = [], isLoading: historyLoading } = useQuery({
    queryKey: ["system-explorer-history", selectedItem?.id],
    enabled: !!selectedItem,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("work_item_history")
        .select("id, action, old_value, new_value, created_at")
        .eq("work_item_id", selectedItem!.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
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

  // Group work items by status
  const grouped = useMemo(() => {
    const groups: Record<string, WorkItem[]> = {};
    for (const wi of workItems) {
      const key = wi.status || "unknown";
      if (!groups[key]) groups[key] = [];
      groups[key].push(wi);
    }
    return groups;
  }, [workItems]);

  const statusOrder = ["open", "in_progress", "done", "completed", "cancelled"];
  const sortedGroupKeys = useMemo(() => {
    const keys = Object.keys(grouped);
    return keys.sort((a, b) => {
      const ai = statusOrder.indexOf(a);
      const bi = statusOrder.indexOf(b);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
  }, [grouped]);

  const toggleSection = (key: string) => setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  const toggleGroup = (key: string) => setExpandedGroups((prev) => ({ ...prev, [key]: !prev[key] }));

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
    <div className="flex h-full min-h-0">
      {/* Main tree panel */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="flex items-center gap-2 flex-1">
          <Database className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">System Explorer</h1>
          <Badge variant="outline" className="ml-2">READ-ONLY</Badge>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>

        {/* FLOW STATUS */}
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

        {/* DEBUG FLAGS */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Debug Flags</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-4 text-sm">
            <div>Dedup active: <Badge variant="outline">{workItems.some((w) => w.issue_fingerprint) ? "true" : "false"}</Badge></div>
            <div>Ignored items: <Badge variant="outline">{ignoredCount > 0 ? `${ignoredCount} ignored` : "none"}</Badge></div>
            <div>Cleanup (orphan fn): <Badge variant="outline">available</Badge></div>
          </CardContent>
        </Card>

        {/* AI FLOW */}
        <Card>
          <CardHeader className="pb-2 cursor-pointer select-none" onClick={() => toggleSection("aiFlow")}>
            <CardTitle className="text-sm flex items-center gap-2">
              {expandedSections.aiFlow ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <Cpu className="h-4 w-4 text-primary" />
              AI Flow
            </CardTitle>
          </CardHeader>
          {expandedSections.aiFlow && (
            <CardContent className="space-y-4">
              {/* 1. Last Scan Info */}
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground mb-1">Last Scan</h3>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground text-xs">Scan ID</span>
                    <p className="font-mono text-xs">{latestScan?.id?.slice(0, 8) ?? "–"}…</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">Created</span>
                    <p className="text-xs">{latestScan ? format(new Date(latestScan.created_at), "MM-dd HH:mm") : "–"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">Detected</span>
                    <p className="text-xs font-bold">{detectedIssues}</p>
                  </div>
                </div>
              </div>

              {/* 2. Pipeline Counts */}
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground mb-1">Pipeline Counts</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                  <div className="border border-border rounded-md p-2 text-center">
                    <div className="text-lg font-bold">{detectedIssues}</div>
                    <div className="text-[10px] text-muted-foreground">Detected</div>
                  </div>
                  <div className="border border-border rounded-md p-2 text-center">
                    <div className="text-lg font-bold">{latestRun?.total_new_issues ?? detectedIssues}</div>
                    <div className="text-[10px] text-muted-foreground">After Filter</div>
                  </div>
                  <div className="border border-border rounded-md p-2 text-center">
                    <div className="text-lg font-bold">{Math.max(0, detectedIssues - (latestRun?.total_new_issues ?? detectedIssues))}</div>
                    <div className="text-[10px] text-muted-foreground">Skipped (dedup)</div>
                  </div>
                  <div className="border border-border rounded-md p-2 text-center">
                    <div className="text-lg font-bold">{latestRun?.work_items_created ?? latestScan?.tasks_created ?? 0}</div>
                    <div className="text-[10px] text-muted-foreground">Created Items</div>
                  </div>
                </div>
              </div>

              {/* 3. Data Flow Chain */}
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground mb-1">Data Flow</h3>
                <div className="flex items-center gap-1 flex-wrap text-xs">
                  <Badge variant="outline" className="gap-1"><Cpu className="h-3 w-3" />SCAN</Badge>
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  <Badge variant="outline" className="gap-1"><Filter className="h-3 w-3" />FILTER</Badge>
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  <Badge variant="outline" className="gap-1"><Layers className="h-3 w-3" />CREATE</Badge>
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  <Badge variant="outline" className="gap-1"><Database className="h-3 w-3" />DB</Badge>
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  <Badge variant="outline" className="gap-1"><Activity className="h-3 w-3" />UI</Badge>
                </div>
              </div>

              {/* 4. Flags */}
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground mb-1">Flags</h3>
                <div className="flex flex-wrap gap-3 text-sm">
                  <div>Dedup: <Badge variant="outline">{workItems.some((w) => w.issue_fingerprint) ? "active" : "off"}</Badge></div>
                  <div>Cleanup: <Badge variant="outline">available</Badge></div>
                  <div>Mode: <Badge variant="secondary">{import.meta.env.MODE ?? "development"}</Badge></div>
                </div>
              </div>
            </CardContent>
          )}
        </Card>

        {/* WORK ITEMS TREE */}
        <Card>
          <CardHeader className="pb-2 cursor-pointer select-none" onClick={() => toggleSection("workItems")}>
            <CardTitle className="text-sm flex items-center gap-2">
              {expandedSections.workItems ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <Database className="h-4 w-4 text-primary" />
              Work Items ({workItems.length})
            </CardTitle>
          </CardHeader>
          {expandedSections.workItems && (
            <CardContent className="pt-0 pl-2">
              {wiLoading ? (
                <p className="p-4 text-sm text-muted-foreground">Laddar...</p>
              ) : (
                <div className="space-y-1">
                  {sortedGroupKeys.map((status) => {
                    const items = grouped[status];
                    const isOpen = expandedGroups[status] ?? false;
                    return (
                      <div key={status}>
                        <button
                          onClick={() => toggleGroup(status)}
                          className="flex items-center gap-1.5 py-1 px-2 w-full text-left text-sm hover:bg-muted/50 rounded-md transition-colors"
                        >
                          {isOpen ? <FolderOpen className="h-4 w-4 text-muted-foreground" /> : <Folder className="h-4 w-4 text-muted-foreground" />}
                          <span className="font-medium">{status}</span>
                          <Badge variant={statusColor(status)} className="text-[10px] px-1.5 py-0 ml-1">{items.length}</Badge>
                        </button>
                        {isOpen && (
                          <div className="ml-6 border-l border-border pl-2 space-y-0.5">
                            {items.map((wi) => (
                              <button
                                key={wi.id}
                                onClick={() => setSelectedItem(wi)}
                                className={`flex items-center gap-2 py-1 px-2 w-full text-left text-xs rounded-md transition-colors hover:bg-muted/50 ${
                                  selectedItem?.id === wi.id ? "bg-accent" : ""
                                } ${wi.ignored ? "opacity-50" : ""}`}
                              >
                                <FileText className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
                                <span className="truncate flex-1">{wi.title}</span>
                                <Badge variant={priorityColor(wi.priority)} className="text-[10px] px-1 py-0 flex-shrink-0">{wi.priority}</Badge>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {workItems.length === 0 && (
                    <p className="text-sm text-muted-foreground p-2">Inga work items.</p>
                  )}
                </div>
              )}
            </CardContent>
          )}
        </Card>

        {/* SCAN RESULTS */}
        <Card>
          <CardHeader className="pb-2 cursor-pointer select-none" onClick={() => toggleSection("scanResults")}>
            <CardTitle className="text-sm flex items-center gap-2">
              {expandedSections.scanResults ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <Bug className="h-4 w-4 text-primary" />
              Latest Scan Result
            </CardTitle>
          </CardHeader>
          {expandedSections.scanResults && (
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
          )}
        </Card>
      </div>

      {/* Detail side panel */}
      {selectedItem && (
        <div className="w-80 border-l border-border bg-card overflow-y-auto p-4 space-y-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-foreground">Detail</h2>
            <button onClick={() => setSelectedItem(null)} className="p-1 rounded-md hover:bg-muted/50">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
          <div className="space-y-3 text-sm">
            <div>
              <span className="text-muted-foreground text-xs">Title</span>
              <p className="font-medium">{selectedItem.title}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Status</span>
              <div><Badge variant={statusColor(selectedItem.status)}>{selectedItem.status}</Badge></div>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Priority</span>
              <div><Badge variant={priorityColor(selectedItem.priority)}>{selectedItem.priority}</Badge></div>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Type</span>
              <p>{selectedItem.item_type}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Source Type</span>
              <p>{selectedItem.source_type ?? "–"}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Source ID</span>
              <p className="font-mono text-xs break-all">{selectedItem.source_id ?? "–"}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Origin</span>
              <p>{selectedItem.source_type === "scan" || selectedItem.source_type === "ai_scan" ? "scan" : selectedItem.source_type === "manual" ? "manual" : "system"}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Created By</span>
              <p className="font-mono text-xs break-all">{selectedItem.created_by ?? "–"}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">AI Detected</span>
              <p>{selectedItem.ai_detected ? "Yes" : "No"}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Created</span>
              <p>{format(new Date(selectedItem.created_at), "yyyy-MM-dd HH:mm:ss")}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">ID</span>
              <p className="font-mono text-xs break-all">{selectedItem.id}</p>
            </div>
            {selectedItem.issue_fingerprint && (
              <div>
                <span className="text-muted-foreground text-xs">Fingerprint</span>
                <p className="font-mono text-xs break-all">{selectedItem.issue_fingerprint}</p>
              </div>
            )}
            {selectedItem.ignored && (
              <Badge variant="outline" className="mt-2">Ignored</Badge>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SystemExplorer;
