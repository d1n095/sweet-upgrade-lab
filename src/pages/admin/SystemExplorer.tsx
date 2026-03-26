import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAdminRole } from "@/hooks/useAdminRole";
import { useFounderRole } from "@/hooks/useFounderRole";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Database, Activity, Bug, CheckCircle, AlertTriangle, Clock, Shield, ChevronRight, ChevronDown, X, Folder, FolderOpen, FileText, RefreshCw, Cpu, ArrowRight, Filter, Layers, History, Radar, Eye, Bot, Send, Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ReactMarkdown from "react-markdown";

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

// ── Scanner Module Groups ──
interface ScannerDef {
  id: string;
  label: string;
  /** Which scan step ids or issue categories map to this scanner */
  matchKeys: string[];
}

interface ScannerGroup {
  id: string;
  label: string;
  icon: string;
  scanners: ScannerDef[];
}

const SCANNER_GROUPS: ScannerGroup[] = [
  {
    id: "ui_scanners",
    label: "UI Scanners",
    icon: "🖥️",
    scanners: [
      { id: "ui_data_binding", label: "UI/Data Binding", matchKeys: ["sync_scan", "ui_data_binding", "sync"] },
      { id: "component_map", label: "Component Map", matchKeys: ["component_map", "component"] },
      { id: "navigation_verification", label: "Navigation Verification", matchKeys: ["nav_scan", "navigation_verification", "navigation"] },
    ],
  },
  {
    id: "data_scanners",
    label: "Data Scanners",
    icon: "🗄️",
    scanners: [
      { id: "data_flow_validation", label: "Data Flow Validation", matchKeys: ["data_integrity", "data_flow_validation", "data"] },
      { id: "order_data_mismatch", label: "Order Data Mismatch", matchKeys: ["order_data_mismatch", "order_data"] },
      { id: "missing_product_data", label: "Missing Product Data", matchKeys: ["missing_product_data", "product_data"] },
      { id: "stock_inconsistency", label: "Stock Inconsistency", matchKeys: ["stock_inconsistency", "stock", "inventory"] },
    ],
  },
  {
    id: "flow_scanners",
    label: "Flow Scanners",
    icon: "🔀",
    scanners: [
      { id: "interaction_qa", label: "Interaction QA", matchKeys: ["interaction_qa", "interaction"] },
      { id: "human_test", label: "Human Test Simulation", matchKeys: ["human_test", "human"] },
      { id: "ui_flow_integrity", label: "UI Flow Integrity", matchKeys: ["ui_flow_integrity", "ui_flow"] },
      { id: "checkout_flow_break", label: "Checkout Flow Break", matchKeys: ["checkout_flow_break", "checkout"] },
      { id: "order_creation_gap", label: "Order Creation Gap", matchKeys: ["order_creation_gap"] },
      { id: "scan_to_work_item_loss", label: "Scan → Work Item Loss", matchKeys: ["scan_to_work_item_loss", "pipeline_loss"] },
    ],
  },
  {
    id: "business_scanners",
    label: "Business Scanners",
    icon: "💼",
    scanners: [
      { id: "feature_detection", label: "Feature Detection", matchKeys: ["feature_detection", "feature"] },
      { id: "decision_engine", label: "Decision Engine", matchKeys: ["decision_engine", "decision"] },
      { id: "regression_detection", label: "Regression Detection", matchKeys: ["system_scan", "regression_detection", "regression"] },
    ],
  },
  {
    id: "edge_case_scanners",
    label: "Edge Case Scanners",
    icon: "⚡",
    scanners: [
      { id: "blocker_detection", label: "Blocker Detection", matchKeys: ["blocker_detection", "blocker"] },
    ],
  },
];

const SystemExplorer = () => {
  const queryClient = useQueryClient();
  const { isAdmin, isLoading: adminLoading } = useAdminRole();
  const { isFounder, isLoading: founderLoading } = useFounderRole();
  const isSystemAdmin = isFounder || false; // founder = full access
  const isViewerAdmin = isAdmin && !isFounder; // admin without founder = read-only viewer
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({ workItems: true, scanResults: true, aiFlow: true, scanners: true });
  const [expandedScanners, setExpandedScanners] = useState<Record<string, boolean>>({});
  const [scannerIssueFilter, setScannerIssueFilter] = useState<"all" | "bug" | "improvement" | "upgrade">("all");
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({ open: true, in_progress: true, done: false, completed: false, cancelled: false });
  const [selectedItem, setSelectedItem] = useState<WorkItem | null>(null);
  const [detailTab, setDetailTab] = useState<"info" | "history">("info");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [aiQuery, setAiQuery] = useState("");
  const [aiAnswer, setAiAnswer] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiFocusArea, setAiFocusArea] = useState<string | null>(null);

  // 1. ALL work_items
  const { data: workItems = [], isLoading: wiLoading } = useQuery({
    queryKey: ["system-explorer-work-items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("work_items")
        .select("id, title, status, source_type, source_id, created_by, item_type, priority, ai_detected, created_at, issue_fingerprint, ignored, source_path, source_file, source_component")
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

  // Scanner stats derived from scan results — organized by module groups
  const groupedScannerStats = useMemo(() => {
    const rawIssues = (scanResults?.issues as any[] | undefined) ?? [];
    const scanItems = workItems.filter(w => w.source_type === "scan" || w.source_type === "ai_scan" || w.source_type === "ai_detection");

    // Build a lookup: key → { raw issues, created count }
    const keyStats: Record<string, { raw: any[]; created: number }> = {};
    for (const issue of rawIssues) {
      const keys = [issue.category, issue.type, issue.scan_type, issue.step, issue.item_type].filter(Boolean).map((k: string) => k.toLowerCase());
      for (const k of keys) {
        if (!keyStats[k]) keyStats[k] = { raw: [], created: 0 };
        keyStats[k].raw.push(issue);
      }
    }
    for (const wi of scanItems) {
      const keys = [wi.item_type].filter(Boolean).map(k => k.toLowerCase());
      for (const k of keys) {
        if (keyStats[k]) keyStats[k].created++;
      }
    }

    // Step results from scan for executed status
    const stepResults = (scanResults?.step_results ?? scanResults) as Record<string, any> | null;
    const createTrace: any[] = scanResults?._create_trace ?? [];

    return SCANNER_GROUPS.map(group => {
      const scannerResults = group.scanners.map(scanner => {
        let detected = 0;
        let created = 0;
        const allRaw: any[] = [];
        // Determine executed status from step results
        let executed = false;
        let executionTimeMs: number | null = null;
        let inputSize: number | null = null;
        let emptyReason: string | null = null;
        let scanStartedAt: string | null = null;
        let scanFinishedAt: string | null = null;
        let scanScope: { type: string; target: string; size: number } | null = null;
        for (const mk of scanner.matchKeys) {
          const s = keyStats[mk.toLowerCase()];
          if (s) {
            detected += s.raw.length;
            created += s.created;
            allRaw.push(...s.raw);
          }
          // Check step_results for metadata
          if (stepResults && typeof stepResults === 'object') {
            const stepData = stepResults[mk] || stepResults[scanner.id];
            if (stepData?._executed === true) executed = true;
            if (stepData && stepData._executed === undefined && !stepData.failed) executed = true;
            if (stepData?._execution_time_ms != null && executionTimeMs === null) executionTimeMs = stepData._execution_time_ms;
            if (stepData?._input_size != null && inputSize === null) inputSize = stepData._input_size;
            if (stepData?._empty_reason && emptyReason === null) emptyReason = stepData._empty_reason;
            if (stepData?._scan_started_at && scanStartedAt === null) scanStartedAt = stepData._scan_started_at;
            if (stepData?._scan_finished_at && scanFinishedAt === null) scanFinishedAt = stepData._scan_finished_at;
            if (stepData?._scan_scope && scanScope === null) scanScope = stepData._scan_scope;
          }
        }
        // If we found any raw issues or created items, scanner must have executed
        if (detected > 0 || created > 0) executed = true;
        // De-duplicate raw issues by reference
        const uniqueRaw = [...new Map(allRaw.map(r => [r.title || JSON.stringify(r), r])).values()];
        detected = uniqueRaw.length;
        const skipped = Math.max(0, detected - created);
        const scopeSize = scanScope?.size ?? inputSize ?? 0;
        const coverageRatio = scopeSize > 0 ? detected / scopeSize : 0;
        let health: "WORKING" | "DEAD" | "BLIND" | "OVER-FILTERING" | "DEDUP_BLOCKED" | "NO_INPUT" | "LOW_SIGNAL" = "WORKING";
        if (!executed) health = "DEAD";
        else if (scopeSize === 0) health = "NO_INPUT";
        else if (detected === 0 && scopeSize > 0) health = "BLIND";
        else if (coverageRatio < 0.01 && detected > 0) health = "LOW_SIGNAL";
        else if (detected > 0 && created === 0 && skipped === detected) health = "OVER-FILTERING";
        else if (detected > 0 && created === 0) health = "DEDUP_BLOCKED";
        else if (created > 0) health = "WORKING";
        else health = "BLIND";
        return { ...scanner, detected, afterFilter: created, skipped, created, health, rawIssues: uniqueRaw, executed, executionTimeMs, inputSize, emptyReason, scanStartedAt, scanFinishedAt, scanScope, createTrace };
      });

      const groupDetected = scannerResults.reduce((s, r) => s + r.detected, 0);
      const groupCreated = scannerResults.reduce((s, r) => s + r.created, 0);
      const groupSkipped = scannerResults.reduce((s, r) => s + r.skipped, 0);
      const deadCount = scannerResults.filter(r => r.health === "DEAD" || r.health === "BLIND" || r.health === "NO_INPUT").length;
      const blockedCount = scannerResults.filter(r => r.health === "OVER-FILTERING" || r.health === "DEDUP_BLOCKED").length;
      const lowSignalCount = scannerResults.filter(r => r.health === "LOW_SIGNAL").length;
      let groupHealth: "WORKING" | "DEAD" | "BLIND" | "OVER-FILTERING" | "DEDUP_BLOCKED" | "NO_INPUT" | "LOW_SIGNAL" = "WORKING";
      if (deadCount > scannerResults.length / 2) groupHealth = "DEAD";
      else if (blockedCount > scannerResults.length / 2) groupHealth = "OVER-FILTERING";
      else if (lowSignalCount > scannerResults.length / 2) groupHealth = "LOW_SIGNAL";

      return { ...group, scanners: scannerResults, detected: groupDetected, created: groupCreated, skipped: groupSkipped, health: groupHealth };
    });
  }, [scanResults, workItems]);


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

  const handleAiAnalyze = async () => {
    if (!aiQuery.trim() || aiLoading) return;
    setAiLoading(true);
    setAiAnswer(null);
    try {
      const focusSuffix = aiFocusArea ? ` [FOCUS AREA: ${aiFocusArea} — prioritize issues and scans within this area]` : "";
      const { data, error } = await supabase.functions.invoke("ai-assistant", {
        body: { type: "system_explorer_query", question: aiQuery.trim() + focusSuffix },
      });
      if (error) throw error;
      setAiAnswer(data?.result?.answer || "Inget svar.");
    } catch (e: any) {
      setAiAnswer(`Fel: ${e.message || "Kunde inte analysera."}`);
    } finally {
      setAiLoading(false);
    }
  };

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
        <div className="flex items-center gap-2 flex-wrap">
          <Database className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">System Explorer</h1>
          <Badge variant="outline" className="ml-2">READ-ONLY</Badge>
          {isSystemAdmin && <Badge className="bg-primary/10 text-primary text-[10px]"><Shield className="h-3 w-3 mr-1" />SYSTEM ADMIN</Badge>}
          {isViewerAdmin && <Badge variant="secondary" className="text-[10px]"><Lock className="h-3 w-3 mr-1" />VIEWER</Badge>}
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>

        {/* AI ASSISTANT - System Admin only */}
        {isSystemAdmin && (
        <Card>
          <CardHeader className="pb-2 cursor-pointer select-none" onClick={() => toggleSection("aiAssistant")}>
            <CardTitle className="text-sm flex items-center gap-2">
              {expandedSections.aiAssistant ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <Bot className="h-4 w-4 text-primary" />
              AI Assistant
              <Badge variant="outline" className="text-[10px]">READ-ONLY</Badge>
            </CardTitle>
          </CardHeader>
          {expandedSections.aiAssistant && (
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input
                  placeholder="Ask about system state, scanners, work items..."
                  value={aiQuery}
                  onChange={(e) => setAiQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAiAnalyze()}
                  className="text-sm"
                />
                <Button size="sm" onClick={handleAiAnalyze} disabled={aiLoading || !aiQuery.trim()}>
                  {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Analyze
                </Button>
              </div>
              <div className="flex flex-wrap gap-1">
                {["Why was this created?", "Which scanners failed?", "What is broken?", "Summarize system state"].map((q) => (
                  <button
                    key={q}
                    onClick={() => { setAiQuery(q); }}
                    className="text-[10px] px-2 py-1 rounded-md border border-border hover:bg-muted/50 transition-colors text-muted-foreground"
                  >
                    {q}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1 flex-wrap">
                <span className="text-[10px] text-muted-foreground font-medium mr-1">Focus Area:</span>
                {[
                  { key: "UI", label: "UI" },
                  { key: "Data", label: "Data" },
                  { key: "Flow", label: "Flow" },
                  { key: "Business", label: "Business" },
                ].map((area) => (
                  <button
                    key={area.key}
                    onClick={() => setAiFocusArea(aiFocusArea === area.key ? null : area.key)}
                    className={`text-[10px] px-2 py-1 rounded-md border transition-colors ${
                      aiFocusArea === area.key
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border hover:bg-muted/50 text-muted-foreground"
                    }`}
                  >
                    {area.label}
                  </button>
                ))}
                {aiFocusArea && (
                  <span className="text-[10px] text-muted-foreground ml-1">Active: {aiFocusArea}</span>
                )}
              </div>
              {aiAnswer && (
                <div className="border border-border rounded-md p-3 bg-muted/30 text-sm prose prose-sm max-w-none dark:prose-invert">
                  <ReactMarkdown>{aiAnswer}</ReactMarkdown>
                </div>
              )}
            </CardContent>
          )}
        </Card>
        )}

        {isViewerAdmin && (
          <Card>
            <CardContent className="p-4 flex items-center gap-2 text-sm text-muted-foreground">
              <Lock className="h-4 w-4" />
              Viewer-läge — du har läsbehörighet. AI Assistant och kontrollåtgärder kräver System Admin-behörighet.
            </CardContent>
          </Card>
        )}

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

        {/* SCANNERS — Grouped by Module */}
        <Card>
          <CardHeader className="pb-2 cursor-pointer select-none" onClick={() => toggleSection("scanners")}>
            <CardTitle className="text-sm flex items-center gap-2">
              {expandedSections.scanners ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <Radar className="h-4 w-4 text-primary" />
              Scanners ({SCANNER_GROUPS.reduce((s, g) => s + g.scanners.length, 0)} in {SCANNER_GROUPS.length} groups)
            </CardTitle>
          </CardHeader>
          {expandedSections.scanners && (
            <CardContent className="space-y-3 pt-0">
              {groupedScannerStats.map((group) => {
                const groupExpanded = expandedScanners[`group_${group.id}`] ?? false;
                return (
                  <div key={group.id} className="border border-border rounded-md">
                    {/* Group Header */}
                    <button
                      onClick={() => setExpandedScanners(prev => ({ ...prev, [`group_${group.id}`]: !prev[`group_${group.id}`] }))}
                      className="flex items-center gap-2 w-full text-left px-3 py-2.5 text-sm hover:bg-muted/50 transition-colors"
                    >
                      {groupExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                      <span className="text-base mr-1">{group.icon}</span>
                      <span className="font-semibold flex-1">{group.label}</span>
                      <span className="text-xs text-muted-foreground mr-2">{group.scanners.length} scanners</span>
                      <Badge
                        variant={group.health === "WORKING" ? "default" : group.health === "DEAD" ? "destructive" : "secondary"}
                        className="text-[10px] px-1.5 py-0"
                      >
                        {group.health}
                      </Badge>
                    </button>
                    {/* Group Summary Row */}
                    <div className="px-3 pb-2 grid grid-cols-3 gap-2 text-xs border-b border-border">
                      <div className="text-center">
                        <div className="font-bold">{group.detected}</div>
                        <div className="text-muted-foreground">Detected</div>
                      </div>
                      <div className="text-center">
                        <div className="font-bold">{group.created}</div>
                        <div className="text-muted-foreground">Created</div>
                      </div>
                      <div className="text-center">
                        <div className="font-bold">{group.skipped}</div>
                        <div className="text-muted-foreground">Skipped</div>
                      </div>
                    </div>
                    {/* Individual Scanners */}
                    {groupExpanded && (
                      <div className="px-2 py-2 space-y-1">
                        {group.scanners.map((scanner: any) => {
                          const scannerExpanded = expandedScanners[scanner.id] ?? false;
                          return (
                            <div key={scanner.id} className="border border-border/50 rounded-md bg-muted/20">
                              <button
                                onClick={() => setExpandedScanners(prev => ({ ...prev, [scanner.id]: !prev[scanner.id] }))}
                                className="flex items-center gap-2 w-full text-left px-2.5 py-1.5 text-xs hover:bg-muted/50 transition-colors"
                              >
                                {scannerExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                <span className="font-medium flex-1">{scanner.label}</span>
                                <span className={`text-[9px] font-mono mr-1 ${scanner.executed ? 'text-green-500' : 'text-destructive'}`}>
                                  {scanner.executed ? '✓ RAN' : '✗ NO'}
                                </span>
                                <Badge
                                  variant={scanner.health === "WORKING" ? "default" : (scanner.health === "DEAD" || scanner.health === "OVER-FILTERING" || scanner.health === "NO_INPUT") ? "destructive" : "secondary"}
                                  className="text-[9px] px-1 py-0"
                                >
                                  {scanner.health}
                                </Badge>
                              </button>
                              <div className="px-2.5 pb-1.5 grid grid-cols-4 gap-1 text-[10px]">
                                <div className="text-center">
                                  <div className="font-bold">{scanner.detected}</div>
                                  <div className="text-muted-foreground">Raw</div>
                                </div>
                                <div className="text-center">
                                  <div className="font-bold">{scanner.afterFilter}</div>
                                  <div className="text-muted-foreground">After</div>
                                </div>
                                <div className="text-center">
                                  <div className="font-bold">{scanner.skipped}</div>
                                  <div className="text-muted-foreground">Skip</div>
                                </div>
                                <div className="text-center">
                                  <div className="font-bold">{scanner.created}</div>
                                  <div className="text-muted-foreground">Created</div>
                                </div>
                              </div>
                              {/* Extended metadata */}
                              <div className="px-2.5 pb-1.5 grid grid-cols-3 gap-1 text-[10px] border-t border-border/30 pt-1">
                                <div className="text-center">
                                  <div className="font-bold">{scanner.executionTimeMs != null ? `${scanner.executionTimeMs}ms` : '–'}</div>
                                  <div className="text-muted-foreground">Time</div>
                                </div>
                                <div className="text-center">
                                  <div className="font-bold">{scanner.inputSize ?? '–'}</div>
                                  <div className="text-muted-foreground">Input</div>
                                </div>
                                <div className="text-center">
                                  <div className="font-bold">{scanner.emptyReason || '–'}</div>
                                  <div className="text-muted-foreground">Empty?</div>
                              </div>
                              {/* Scan Scope */}
                              {scanner.scanScope && (
                                <div className="px-2.5 pb-1.5 grid grid-cols-3 gap-1 text-[10px] border-t border-border/30 pt-1">
                                  <div className="text-center">
                                    <div className="font-bold">{scanner.scanScope.type}</div>
                                    <div className="text-muted-foreground">Scope</div>
                                  </div>
                                  <div className="text-center">
                                    <div className="font-bold">{scanner.scanScope.target}</div>
                                    <div className="text-muted-foreground">Target</div>
                                  </div>
                                  <div className="text-center">
                                    <div className="font-bold">{scanner.scanScope.size ?? '–'}</div>
                                    <div className="text-muted-foreground">Size</div>
                                  </div>
                                </div>
                              )}
                              {/* Coverage */}
                              <div className="px-2.5 pb-1.5 text-[10px] border-t border-border/30 pt-1">
                                <div className="text-center">
                                  <div className="text-muted-foreground mb-0.5">Coverage</div>
                                  {(() => {
                                    const size = scanner.scanScope?.size ?? scanner.inputSize ?? 0;
                                    if (size === 0) return <div className="font-bold text-destructive">NO INPUT</div>;
                                    const ratio = ((scanner.detected / size) * 100).toFixed(1);
                                    return <div className="font-bold">{scanner.detected} issues / {size} scanned ({ratio}%)</div>;
                                  })()}
                                </div>
                              </div>
                              </div>
                              {scannerExpanded && scanner.rawIssues.length > 0 && (
                                <div className="px-2.5 pb-2 border-t border-border/50 pt-1.5">
                                  <div className="flex items-center gap-1 mb-1">
                                    <Eye className="h-3 w-3 text-muted-foreground" />
                                    <span className="text-[10px] font-medium text-muted-foreground">Raw output</span>
                                    <div className="flex gap-0.5 ml-auto">
                                      {(["all", "bug", "improvement", "upgrade"] as const).map(f => (
                                        <button key={f} onClick={() => setScannerIssueFilter(f)} className={`text-[8px] px-1.5 py-0.5 rounded border ${scannerIssueFilter === f ? "bg-primary text-primary-foreground border-primary" : "bg-muted/50 text-muted-foreground border-border"}`}>
                                          {f === "all" ? "All" : f === "bug" ? "Bugs" : f === "improvement" ? "Improvements" : "Upgrades"}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                  <div className="space-y-1 max-h-40 overflow-y-auto">
                                    {scanner.rawIssues.filter((issue: any) => scannerIssueFilter === "all" || issue._issue_type === scannerIssueFilter).map((issue: any, idx: number) => (
                                      <div key={idx} className="text-[10px] border border-border rounded px-2 py-1 bg-muted/30 space-y-1">
                                        <div className="flex items-center gap-1 flex-wrap">
                                          <span className="font-medium truncate flex-1">{issue.title || "Untitled"}</span>
                                          <Badge variant="outline" className="text-[8px] px-1 py-0">{issue.type || "–"}</Badge>
                                          <Badge variant="outline" className="text-[8px] px-1 py-0">{issue.severity || "–"}</Badge>
                                          {issue._issue_type && <Badge variant={issue._issue_type === "bug" ? "destructive" : issue._issue_type === "upgrade" ? "default" : "secondary"} className="text-[8px] px-1 py-0">{issue._issue_type}</Badge>}
                                          {issue._viewport && <Badge variant="outline" className="text-[8px] px-1 py-0">📱 {issue._viewport}{issue._viewport_width ? ` (${issue._viewport_width}px)` : ''}</Badge>}
                                           {issue._affected_area && <Badge variant="outline" className="text-[8px] px-1 py-0">📍 {issue._affected_area.type}/{issue._affected_area.target}</Badge>}
                                         </div>
                                         {issue._suggested_fix && <div className="text-[9px] text-muted-foreground italic">💡 {issue._suggested_fix}</div>}
                                        {/* SCAN → FILTER → CREATE flow */}
                                        <div className="grid grid-cols-3 gap-1 text-[9px] border-t border-border/30 pt-1">
                                          {/* SCAN */}
                                          <div className="space-y-0.5">
                                            <div className="font-semibold text-muted-foreground uppercase tracking-wider">Scan</div>
                                            <div>detected: <span className="font-medium">yes</span></div>
                                            {scanner.executionTimeMs != null && <div>time: <span className="font-medium">{scanner.executionTimeMs}ms</span></div>}
                                            {scanner.inputSize != null && <div>input: <span className="font-medium">{scanner.inputSize}</span></div>}
                                          </div>
                                          {/* FILTER */}
                                          <div className="space-y-0.5">
                                            <div className="font-semibold text-muted-foreground uppercase tracking-wider">Filter</div>
                                            <div>decision: <span className={`font-medium ${issue._filter_decision === 'passed' ? 'text-green-500' : 'text-destructive'}`}>
                                              {issue._filter_decision || '–'}
                                            </span></div>
                                            {issue._filter_reason && <div>reason: <span className="font-medium text-destructive">{issue._filter_reason}</span></div>}
                                          </div>
                                          {/* CREATE */}
                                          <div className="space-y-0.5">
                                            <div className="font-semibold text-muted-foreground uppercase tracking-wider">Create</div>
                                            {(() => {
                                              const trace = (scanner.createTrace || []).find((t: any) => t.title === issue.title || t.fingerprint === issue.fingerprint);
                                              if (trace) {
                                                return <>
                                                  <div>decision: <span className={`font-medium ${trace._create_decision === 'created' ? 'text-green-500' : 'text-destructive'}`}>
                                                    {trace._create_decision}
                                                  </span></div>
                                                  {trace._dedup_reason && <div>dedup: <span className="font-medium">{trace._dedup_reason}</span></div>}
                                                  {trace._validation_reason && <div>reason: <span className="font-medium">{trace._validation_reason}</span></div>}
                                                  {trace.existing_item_id && <div>existing: <span className="font-mono">{trace.existing_item_id.slice(0, 8)}</span></div>}
                                                </>;
                                              }
                                              return <div className="text-muted-foreground">–</div>;
                                            })()}
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {scannerExpanded && scanner.rawIssues.length === 0 && (
                                <div className="px-2.5 pb-2 text-[10px] text-muted-foreground italic">
                                  No raw issues detected {scanner.emptyReason ? `(${scanner.emptyReason})` : ''}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          )}
        </Card>

        {/* SYSTEM MAP */}
        <Card>
          <CardHeader className="pb-2 cursor-pointer select-none" onClick={() => toggleSection("systemMap")}>
            <CardTitle className="text-sm flex items-center gap-2">
              {expandedSections.systemMap ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <Layers className="h-4 w-4 text-primary" />
              System Map
              <Badge variant="outline" className="text-[10px]">COVERAGE</Badge>
            </CardTitle>
          </CardHeader>
          {expandedSections.systemMap && (
            <CardContent className="space-y-3 pt-0">
              {(() => {
                // Build map entries from scanner scope data
                const categoryMap: Record<string, { label: string; size: number; scannerNames: Set<string> }> = {};
                const CATEGORY_DEFS: Record<string, string> = {
                  components: "Components",
                  routes: "Routes",
                  orders: "Orders",
                  products: "Products",
                  features: "Features",
                  checkout_flow: "Checkout Flow",
                  regressions: "Regressions",
                  rules: "Rules",
                  blockers: "Blockers",
                };
                for (const group of groupedScannerStats) {
                  for (const scanner of group.scanners) {
                    const scope = scanner.scanScope;
                    if (!scope) continue;
                    const target = scope.target;
                    if (!categoryMap[target]) {
                      categoryMap[target] = { label: CATEGORY_DEFS[target] || target, size: 0, scannerNames: new Set() };
                    }
                    if (scope.size != null && scope.size > categoryMap[target].size) {
                      categoryMap[target].size = scope.size;
                    }
                    categoryMap[target].scannerNames.add(scanner.label);
                  }
                }
                // Group by type
                const TYPE_ORDER = ["ui", "data", "flow", "business", "edge"];
                const typeGroups: Record<string, string[]> = { ui: ["components", "routes"], data: ["orders", "products"], flow: ["checkout_flow"], business: ["features", "regressions", "rules"], edge: ["blockers"] };
                const allTargets = Object.keys(categoryMap);
                // Add any targets not in predefined groups
                for (const t of allTargets) {
                  const found = Object.values(typeGroups).some(arr => arr.includes(t));
                  if (!found) { if (!typeGroups.edge) typeGroups.edge = []; typeGroups.edge.push(t); }
                }

                const TYPE_LABELS: Record<string, string> = { ui: "🖥️ UI", data: "🗄️ Data", flow: "🔀 Flows", business: "💼 Business", edge: "⚡ Edge" };

                return (
                  <div className="space-y-3">
                    {/* Summary row */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      <div className="text-center border border-border rounded p-2">
                        <div className="text-lg font-bold">{categoryMap.components?.size ?? 0}</div>
                        <div className="text-[10px] text-muted-foreground">Components</div>
                      </div>
                      <div className="text-center border border-border rounded p-2">
                        <div className="text-lg font-bold">{categoryMap.routes?.size ?? 0}</div>
                        <div className="text-[10px] text-muted-foreground">Routes</div>
                      </div>
                      <div className="text-center border border-border rounded p-2">
                        <div className="text-lg font-bold">{(categoryMap.orders?.size ?? 0) + (categoryMap.products?.size ?? 0)}</div>
                        <div className="text-[10px] text-muted-foreground">Data Entities</div>
                      </div>
                      <div className="text-center border border-border rounded p-2">
                        <div className="text-lg font-bold">{categoryMap.checkout_flow?.size ?? 0}</div>
                        <div className="text-[10px] text-muted-foreground">Flows</div>
                      </div>
                    </div>
                    {/* Per-category detail */}
                    <div className="space-y-1">
                      {TYPE_ORDER.map(typeKey => {
                        const targets = typeGroups[typeKey] || [];
                        const entries = targets.filter(t => categoryMap[t]);
                        if (entries.length === 0) return null;
                        return (
                          <div key={typeKey} className="space-y-1">
                            <div className="text-[11px] font-semibold text-muted-foreground">{TYPE_LABELS[typeKey] || typeKey}</div>
                            {entries.map(target => {
                              const cat = categoryMap[target];
                              const scannerCount = cat.scannerNames.size;
                              return (
                                <div key={target} className="flex items-center justify-between px-2 py-1.5 rounded border border-border bg-muted/20 text-[11px]">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">{cat.label}</span>
                                    <span className="text-muted-foreground font-bold">{cat.size}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Badge variant={scannerCount === 0 ? "destructive" : scannerCount === 1 ? "secondary" : "default"} className="text-[9px] px-1.5 py-0">
                                      {scannerCount === 0 ? "NOT COVERED" : `${scannerCount} scanner${scannerCount > 1 ? "s" : ""}`}
                                    </Badge>
                                    {scannerCount > 0 && (
                                      <span className="text-[9px] text-muted-foreground truncate max-w-[120px]" title={[...cat.scannerNames].join(", ")}>
                                        ({[...cat.scannerNames].join(", ")})
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
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
                  {/* High Attention Areas */}
                  {scanResults?.high_attention_areas?.length > 0 && (
                    <div className="border-t pt-2 mt-2">
                      <p className="font-medium text-xs mb-1">🔴 High Attention Areas</p>
                      <div className="flex flex-wrap gap-1">
                        {scanResults.high_attention_areas.map((area: any, idx: number) => (
                          <Badge key={idx} variant="destructive" className="text-[10px]">
                            {area.type}/{area.target} — {area.reason}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Ingen scan hittad.</p>
              )}
            </CardContent>
          )}
        </Card>

        {/* ── HIGH ATTENTION AREAS SECTION ── */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              High Attention Areas
              {scanResults?.high_attention_areas?.length > 0 && (
                <Badge variant="destructive" className="text-[10px]">{scanResults.high_attention_areas.length}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {scanResults?.high_attention_areas?.length > 0 ? (
              <div className="border rounded-md overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-2 font-medium text-muted-foreground">Target</th>
                      <th className="text-left p-2 font-medium text-muted-foreground">Type</th>
                      <th className="text-left p-2 font-medium text-muted-foreground">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scanResults.high_attention_areas.map((area: any, idx: number) => (
                      <tr key={idx} className="border-b last:border-b-0">
                        <td className="p-2 font-mono text-foreground">{area.target}</td>
                        <td className="p-2">
                          <Badge variant="outline" className="text-[10px]">{area.type}</Badge>
                        </td>
                        <td className="p-2 text-muted-foreground">{area.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Inga högriskområden identifierade.</p>
            )}
          </CardContent>
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
          {/* Tabs */}
          <div className="flex gap-1 border-b border-border">
            <button
              onClick={() => setDetailTab("info")}
              className={`px-3 py-1.5 text-xs font-medium rounded-t-md transition-colors ${detailTab === "info" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              Info
            </button>
            <button
              onClick={() => setDetailTab("history")}
              className={`px-3 py-1.5 text-xs font-medium rounded-t-md transition-colors flex items-center gap-1 ${detailTab === "history" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              <History className="h-3 w-3" />
              History
            </button>
          </div>

          {detailTab === "info" && (
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
              {(selectedItem as any).source_path && (
                <div>
                  <span className="text-muted-foreground text-xs">Source Path</span>
                  <p className="font-mono text-xs break-all">{(selectedItem as any).source_path}</p>
                </div>
              )}
              {(selectedItem as any).source_file && (
                <div>
                  <span className="text-muted-foreground text-xs">Source File</span>
                  <p className="font-mono text-xs break-all">{(selectedItem as any).source_file}</p>
                </div>
              )}
              {(selectedItem as any).source_component && (
                <div>
                  <span className="text-muted-foreground text-xs">Source Component</span>
                  <p className="font-mono text-xs break-all">{(selectedItem as any).source_component}</p>
                </div>
              )}
              {selectedItem.ignored && (
                <Badge variant="outline" className="mt-2">Ignored</Badge>
              )}
            </div>
          )}

          {detailTab === "history" && (
            <div className="space-y-2">
              {historyLoading ? (
                <p className="text-xs text-muted-foreground">Laddar historik...</p>
              ) : itemHistory.length === 0 ? (
                <p className="text-xs text-muted-foreground">Ingen historik ännu.</p>
              ) : (
                <div className="relative border-l-2 border-border ml-2 space-y-3">
                  {itemHistory.map((h: any) => {
                    const newVal = h.new_value as Record<string, any> | null;
                    const oldVal = h.old_value as Record<string, any> | null;
                    return (
                      <div key={h.id} className="pl-4 relative">
                        <div className="absolute -left-[5px] top-1.5 w-2 h-2 rounded-full bg-primary" />
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">{h.action}</Badge>
                          <span className="text-[10px] text-muted-foreground">{format(new Date(h.created_at), "MM-dd HH:mm:ss")}</span>
                        </div>
                        {h.action === "status_changed" && oldVal && newVal && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {oldVal.status} → {newVal.status}
                          </p>
                        )}
                        {h.action === "created" && newVal && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {newVal.source_type ?? "system"} · {newVal.priority}
                          </p>
                        )}
                        {h.action === "updated" && oldVal && newVal && (
                          <div className="text-xs text-muted-foreground mt-0.5 space-y-0.5">
                            {oldVal.priority !== newVal.priority && <p>priority: {oldVal.priority} → {newVal.priority}</p>}
                            {oldVal.assigned_to !== newVal.assigned_to && <p>assigned changed</p>}
                            {oldVal.claimed_by !== newVal.claimed_by && <p>claimed changed</p>}
                            {oldVal.ignored !== newVal.ignored && <p>ignored: {String(oldVal.ignored)} → {String(newVal.ignored)}</p>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SystemExplorer;
