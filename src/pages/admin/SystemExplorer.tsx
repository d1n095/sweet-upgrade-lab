import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { safeInvoke } from "@/lib/safeInvoke";
import { logData } from "@/utils/actionMonitor";
import ActionMonitorPanel from "@/components/admin/ActionMonitorPanel";
import { fileSystemMap, type FileEntry, getFileContent, getCodeIndex, getDuplicatedLines, getCodeIssues, getRawSources, scanFileContent } from "@/lib/fileSystemMap";
import { useAdminRole } from "@/hooks/useAdminRole";
import { useFounderRole } from "@/hooks/useFounderRole";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Database, Activity, Bug, CheckCircle, AlertTriangle, Clock, Shield, ChevronRight, ChevronDown, X, Folder, FolderOpen, FileText, RefreshCw, Cpu, ArrowRight, Filter, Layers, History, Radar, Eye, Bot, Send, Loader2, Lock, Monitor } from "lucide-react";
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

const RuntimeTraceSection = ({ traceId }: { traceId?: string }) => {
  const [trace, setTrace] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!traceId) return;
    setLoading(true);
    supabase.from("runtime_traces" as any).select("*").eq("id", traceId).maybeSingle().then(({ data }) => {
      setTrace(data);
      setLoading(false);
    });
  }, [traceId]);

  if (!traceId) {
    return (
      <div className="border border-border rounded-md p-2 bg-muted/30 space-y-1">
        <span className="text-muted-foreground text-xs font-medium">Runtime Trace</span>
        <p className="text-xs text-muted-foreground italic">No runtime trace found</p>
      </div>
    );
  }

  return (
    <div className="border border-border rounded-md p-2 bg-muted/30 space-y-2">
      <span className="text-muted-foreground text-xs font-medium">Runtime Trace</span>
      {loading && <p className="text-xs text-muted-foreground">Loading…</p>}
      {!loading && !trace && <p className="text-xs text-muted-foreground italic">Trace not found (ID: {traceId.slice(0, 8)}…)</p>}
      {trace && (
        <div className="space-y-1.5">
          <div>
            <span className="text-muted-foreground text-[10px]">function_name</span>
            <p className="font-mono text-xs bg-muted/50 rounded px-1 py-0.5">{trace.function_name}</p>
          </div>
          <div>
            <span className="text-muted-foreground text-[10px]">endpoint</span>
            <p className="font-mono text-xs bg-muted/50 rounded px-1 py-0.5">{trace.endpoint || "–"}</p>
          </div>
          <div>
            <span className="text-muted-foreground text-[10px]">error_message</span>
            <p className="font-mono text-xs bg-destructive/10 text-destructive rounded px-1 py-0.5 break-all">{trace.error_message}</p>
          </div>
          <div>
            <span className="text-muted-foreground text-[10px]">payload_snapshot</span>
            <pre className="font-mono text-[9px] bg-muted/50 rounded p-1 overflow-x-auto max-h-32 whitespace-pre-wrap break-all">{JSON.stringify(trace.payload_snapshot, null, 2)}</pre>
          </div>
          <div>
            <span className="text-muted-foreground text-[10px]">timestamp</span>
            <p className="font-mono text-xs">{new Date(trace.created_at).toLocaleString("sv-SE")}</p>
          </div>
        </div>
      )}
    </div>
  );
};

const SystemExplorer = () => {
  const queryClient = useQueryClient();
  const { isAdmin, isLoading: adminLoading } = useAdminRole();
  const { isFounder, isLoading: founderLoading } = useFounderRole();
  const isSystemAdmin = isFounder || false; // founder = full access
  const isViewerAdmin = isAdmin && !isFounder; // admin without founder = read-only viewer
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({ workItems: true, scanResults: true, aiFlow: true, scanners: true, noIssueAreas: false, orphanElements: false, issueClusters: false, priorityView: true, systemDiagnosis: true, expectedVsActual: true });
  const [expandedScanners, setExpandedScanners] = useState<Record<string, boolean>>({});
  const [scannerIssueFilter, setScannerIssueFilter] = useState<"all" | "bug" | "improvement" | "upgrade">("all");
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({ open: true, in_progress: true, done: false, completed: false, cancelled: false });
  const [selectedItem, setSelectedItem] = useState<WorkItem | null>(null);
  const [detailTab, setDetailTab] = useState<"info" | "history">("info");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [showRawScan, setShowRawScan] = useState(false);
  const [aiQuery, setAiQuery] = useState("");
  const [aiAnswer, setAiAnswer] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiFocusArea, setAiFocusArea] = useState<string | null>(null);
  const [mainTab, setMainTab] = useState<"system" | "files" | "patch" | "codeindex" | "backendscan" | "monitor">("system");
  const [filesFilter, setFilesFilter] = useState<"all" | "orphan" | "has_issues">("all");
  const [selectedFile, setSelectedFile] = useState<FileEntry | null>(null);
  const [patchInput, setPatchInput] = useState("");
  const [patchStatus, setPatchStatus] = useState<"idle" | "valid" | "invalid">("idle");
  const [safeModeEnabled, setSafeModeEnabled] = useState(true);
  const [patchSubmitted, setPatchSubmitted] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [showBackendRaw, setShowBackendRaw] = useState(false);
  const [fileScanResult, setFileScanResult] = useState<{ total: number; emptyFiles: number; largeFiles: number } | null>(null);
  const [codeScanResult, setCodeScanResult] = useState<{ type: string; message: string; file: string }[] | null>(null);
  const [scanProgress, setScanProgress] = useState<{ step: number; total: number; label: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{ path: string; lineNumber: number; line: string }[]>([]);
  const [lastAction, setLastAction] = useState("");
  const [actionLogs, setActionLogs] = useState<{ time: string; [key: string]: any }[]>([]);
  const [globalIssues, setGlobalIssues] = useState<{ type: string; message: string; file: string }[]>([]);

  function logAction(action: Record<string, any>) {
    setActionLogs(prev => [
      {
        time: new Date().toISOString(),
        type: "TEST_ACTION",
        message: JSON.stringify(action),
        timestamp: Date.now(),
        ...action
      },
      ...prev
    ]);
  }
  useEffect(() => {
    const rawSources = getRawSources();
    if (!rawSources) {
      console.warn("❌ NO rawSources — cannot scan");
      return;
    }
    const allIssues: { type: string; message: string; file: string }[] = [];
    Object.entries(rawSources).forEach(([path, content]) => {
      if (!content) return;
      const issues = scanFileContent(path, content as string);
      allIssues.push(...issues);
    });
    setCodeScanResult(allIssues);
    setGlobalIssues(allIssues);
  }, []);

  function handleSearch() {
    logAction({ type: "Search", status: "started" });
    if (!searchQuery) {
      logAction({ type: "Search", status: "no-input", message: "Search query empty" });
      return;
    }
    const sources = getRawSources();
    if (!sources) {
      logAction({ type: "Search", status: "error", message: "rawSources missing" });
      return;
    }
    const results: { path: string; lineNumber: number; line: string }[] = [];
    Object.entries(sources).forEach(([path, content]) => {
      if (!content) return;
      const lines = content.split("\n");
      lines.forEach((line, index) => {
        if (line.toLowerCase().includes(searchQuery.toLowerCase())) {
          results.push({ path, lineNumber: index + 1, line: line.trim() });
        }
      });
    });
    logAction({
      type: "Search",
      status: results.length === 0 ? "no-results" : "success",
      count: results.length
    });
    setSearchResults(results.slice(0, 50));
  }

  async function runSystemScan(mode: string) {
    if (isScanning) {
      console.warn("Scan already running");
      return;
    }
    setIsScanning(true);
    logAction({ type: "SCAN", status: "started", mode });
    try {
      if (mode === "files") {
        const files = Object.keys(getRawSources() || {});
        const result = {
          total: files.length,
          empty: files.filter(f => !getRawSources()[f]?.trim()).length
        };
        setFileScanResult({ total: result.total, emptyFiles: result.empty, largeFiles: 0 });
        logAction({ type: "SCAN", status: "success", mode });
      }
      if (mode === "code") {
        const results: { type: string; message: string; file: string }[] = [];
        Object.entries(getRawSources() || {}).forEach(([path, content]) => {
          const issues = scanFileContent(path, content as string);
          results.push(...issues);
        });
        setCodeScanResult(results);
        logAction({ type: "SCAN", status: "success", mode });
      }
      if (mode === "full") {
        await safeInvoke("run-full-scan", { action: "start", scan_mode: "full" });
        logAction({ type: "SCAN", status: "success", mode });
      }
    } catch (err: any) {
      console.error("[SCAN ERROR]:", err);
      logAction({
        type: "SCAN",
        status: "error",
        mode,
        message: err.message
      });
    } finally {
      setIsScanning(false);
    }
  }

  async function verifyWorkItemsCreated(beforeCount: number) {
    const { data } = await supabase
      .from("work_items")
      .select("id")
      .limit(1000);
    const afterCount = data?.length || 0;
    return {
      before: beforeCount,
      after: afterCount,
      created: afterCount - beforeCount
    };
  }

  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | null>(null);
  const [verifyingFix, setVerifyingFix] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{ itemId: string; status: "confirmed" | "failed"; scanId?: string } | null>(null);

  // Backend scan latest
  const { data: latestBackendScan, isLoading: backendScanLoading } = useQuery({
    queryKey: ["backend-scan-latest"],
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

  // 1. ALL work_items
  const { data: workItems = [], isLoading: wiLoading } = useQuery({
    queryKey: ["system-explorer-work-items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("work_items")
        .select("id, title, status, source_type, source_id, created_by, item_type, priority, ai_detected, created_at, issue_fingerprint, ignored, source_path, source_file, source_component, first_seen_at, last_seen_at, occurrence_count, verification_status, verification_scans_checked, verified_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
  });

  // Structure map for unscanned areas
  const { data: structureMap = [] } = useQuery({
    queryKey: ["system-explorer-structure-map"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_structure_map" as any)
        .select("entity_type, entity_name, last_seen_at, scan_count")
        .order("last_seen_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  // System expectations for gap detection
  const { data: systemExpectations = [] } = useQuery({
    queryKey: ["system-explorer-expectations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_expectations" as any)
        .select("entity_type, entity_name, required")
        .eq("required", true);
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  // Missing required parts: expected but not in structure_map
  const missingExpectations = useMemo(() => {
    const structureKeys = new Set(structureMap.map((s: any) => `${s.entity_type}::${s.entity_name}`));
    return systemExpectations.filter((exp: any) =>
      exp.required && !structureKeys.has(`${exp.entity_type}::${exp.entity_name}`)
    );
  }, [systemExpectations, structureMap]);

  // Top runtime errors (clustered)
  const { data: runtimeErrorClusters = [] } = useQuery({
    queryKey: ["system-explorer-runtime-errors"],
    queryFn: async () => {
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from("runtime_traces" as any)
        .select("id, function_name, endpoint, error_message, created_at, source")
        .gte("created_at", cutoff)
        .order("created_at", { ascending: false })
        .limit(200);
      if (!data?.length) return [];
      const clusters: Record<string, { function_name: string; endpoint: string; error_message: string; count: number; latest: string; source: string }> = {};
      for (const t of data as any[]) {
        const key = `${t.function_name}::${(t.error_message || "").slice(0, 100)}`;
        if (!clusters[key]) {
          clusters[key] = { function_name: t.function_name, endpoint: t.endpoint || "", error_message: t.error_message || "", count: 0, latest: t.created_at, source: t.source || "" };
        }
        clusters[key].count++;
        if (t.created_at > clusters[key].latest) clusters[key].latest = t.created_at;
      }
      return Object.values(clusters).sort((a, b) => b.count - a.count).slice(0, 10);
    },
    staleTime: 30_000,
  });

  // Raw runtime errors (individual entries)
  const { data: rawRuntimeErrors = [] } = useQuery({
    queryKey: ["system-explorer-raw-runtime-errors"],
    queryFn: async () => {
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from("runtime_traces" as any)
        .select("id, function_name, endpoint, error_message, created_at, request_trace_id, source")
        .gte("created_at", cutoff)
        .order("created_at", { ascending: false })
        .limit(50);
      return (data || []) as any[];
    },
    staleTime: 30_000,
  });
  const [frontendViolations, setFrontendViolations] = useState<{ type: string; action: string; message: string }[]>([]);

  function validateAction(actionName: string, fn: () => any) {
    try {
      const result = fn();
      if (!result) {
        throw new Error("No result returned");
      }
      return result;
    } catch (err: any) {
      console.error("🚨 ACTION FAILED:", actionName, err.message);
      setFrontendViolations(prev => [
        ...prev,
        {
          type: "ACTION_FAILED",
          action: actionName,
          message: err.message
        }
      ]);
      return null;
    }
  }

  const { data: debugConsoleLogs = [] } = useQuery({
    queryKey: ["system-explorer-debug-console"],
    queryFn: async () => {
      const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      const [tracesRes, obsRes] = await Promise.all([
        supabase.from("runtime_traces" as any).select("id, function_name, endpoint, error_message, created_at, request_trace_id").gte("created_at", cutoff).order("created_at", { ascending: false }).limit(50),
        supabase.from("system_observability_log" as any).select("id, event_type, source, message, created_at, component").gte("created_at", cutoff).order("created_at", { ascending: false }).limit(50),
      ]);
      const traces = ((tracesRes.data || []) as any[]).map((t: any) => ({
        ts: t.created_at, source: `trace:${t.function_name || "unknown"}`, message: t.error_message || `${t.endpoint || ""} OK`, id: t.id,
      }));
      const obs = ((obsRes.data || []) as any[]).map((o: any) => ({
        ts: o.created_at, source: `${o.source || o.component || "system"}`, message: o.message || o.event_type, id: o.id,
      }));
      const combined = [...traces, ...obs].sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime()).slice(0, 100);
      // Fallback: if no logs in last 2h, fetch from last scan snapshot
      if (combined.length === 0) {
        const { data: snapshot } = await supabase.from("scan_snapshots" as any).select("diagnosis_summary, created_at, scan_confidence_score, total_detected, total_created").order("created_at", { ascending: false }).limit(1).maybeSingle() as any;
        if (snapshot) {
          const lines = (snapshot.diagnosis_summary || "").split("\n").filter(Boolean);
          return lines.map((line: string, idx: number) => ({
            ts: snapshot.created_at,
            source: "scan-snapshot",
            message: line,
            id: `snapshot-${idx}`,
          }));
        }
      }
      return combined;
    },
    staleTime: 15_000,
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["system-explorer-work-items"] }),
      queryClient.invalidateQueries({ queryKey: ["system-explorer-latest-scan"] }),
      queryClient.invalidateQueries({ queryKey: ["system-explorer-structure-map"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-work-items"] }),
      queryClient.invalidateQueries({ queryKey: ["system-explorer-runtime-errors"] }),
      queryClient.invalidateQueries({ queryKey: ["system-explorer-debug-console"] }),
      queryClient.invalidateQueries({ queryKey: ["system-explorer-raw-runtime-errors"] }),
    ]);
    setIsRefreshing(false);
  };

  const handleRunFullScan = async () => {
    setIsScanning(true);
    
    try {
      const before = await supabase.from("work_items").select("id");
      const beforeCount = before.data?.length || 0;
      logAction({ type: "Full Scan", status: "started" });
      const rawPaths = Object.keys(getRawSources() || {});
      // Structure map failsafe: use fallback if empty — do NOT abort
      const structure_map = rawPaths.length > 0 ? rawPaths.map(path => ({ path })) : [{ path: "/" }];
      const res = await safeInvoke("run-full-scan", { action: "start", scan_mode: "full", source: "EXPLORER", structure_map });
      const verify = await verifyWorkItemsCreated(beforeCount);
      if (verify.created === 0) {
        logAction({
          type: "Full Scan",
          status: "no-effect",
          message: "Scan ran but created 0 work_items ❌"
        });
      } else {
        logAction({
          type: "Full Scan",
          status: "verified",
          message: `Created ${verify.created} work_items ✔`
        });
      }
      const json = res?.data ?? res;
      if (json?.success === false) {
        console.error("[DEBUG] FULL SCAN ERROR:", json?.error);
      }
      await handleRefresh();
    } catch (err) {
      console.error("[FULL SCAN UI ERROR]:", err);
    } finally {
      
      setIsScanning(false);
    }
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

  // 2c. Last 3 scans for no-issue detection
  const { data: last3Scans = [] } = useQuery({
    queryKey: ["system-explorer-last-3-scans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_scan_results")
        .select("results")
        .order("created_at", { ascending: false })
        .limit(3);
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  // 2b. Latest scan_run for pipeline data
  const { data: latestRun } = useQuery({
    queryKey: ["system-explorer-latest-run"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scan_runs")
        .select("id, status, total_new_issues, work_items_created, created_at, unified_result, steps_results")
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

  // Scan snapshots (last 10)
  const { data: scanSnapshots = [] } = useQuery({
    queryKey: ["system-explorer-snapshots"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scan_snapshots")
        .select("id, created_at, total_scanners, total_detected, total_created, dead_scanners_count, blind_scanners_count, scan_confidence_score, coverage_total, coverage_unique_targets, diagnosis_summary, payload")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const activeSnapshot = selectedSnapshotId ? scanSnapshots.find((s: any) => s.id === selectedSnapshotId) : null;

  const scanResults = latestBackendScan?.results as Record<string, any> | null;
  const detectedIssues = scanResults?.master_list?.total ?? scanResults?.detected_issues?.length ?? (activeSnapshot ? activeSnapshot.total_detected : latestScan?.issues_count) ?? 0;

  // Regression detection: compare last 2 snapshots
  const regressions = useMemo(() => {
    if (scanSnapshots.length < 2) return [];
    const latest = scanSnapshots[0];
    const previous = scanSnapshots[1];
    const flags: { target: string; reason: string }[] = [];

    // Compare issue clusters per target
    const getClusterMap = (snap: any): Record<string, number> => {
      const map: Record<string, number> = {};
      const issues = snap?.payload?.issues ?? [];
      for (const issue of issues) {
        const t = issue?.target || issue?.component || "unknown";
        map[t] = (map[t] || 0) + 1;
      }
      return map;
    };
    const latestClusters = getClusterMap(latest);
    const prevClusters = getClusterMap(previous);

    // 1. increased_issues: more issues in same target
    for (const [target, count] of Object.entries(latestClusters)) {
      const prevCount = prevClusters[target] || 0;
      if (count > prevCount && prevCount > 0) {
        flags.push({ target, reason: "increased_issues" });
      }
    }

    // 2. lost_coverage: coverage dropped
    if ((latest.coverage_unique_targets ?? 0) < (previous.coverage_unique_targets ?? 0)) {
      flags.push({ target: "system", reason: "lost_coverage" });
    }

    // 3. scanner_degraded: dead/blind count increased
    if ((latest.dead_scanners_count ?? 0) > (previous.dead_scanners_count ?? 0)) {
      flags.push({ target: "scanners", reason: "scanner_degraded" });
    }
    if ((latest.blind_scanners_count ?? 0) > (previous.blind_scanners_count ?? 0)) {
      flags.push({ target: "scanners", reason: "scanner_degraded" });
    }

    return flags;
  }, [scanSnapshots]);

  // Compute unscanned areas: entities in structure map not covered by any scanner scope
  const unscannedAreas = useMemo(() => {
    // Collect all scan scope targets from scanner groups
    const scannedTargets = new Set<string>();
    for (const group of SCANNER_GROUPS) {
      for (const scanner of group.scanners) {
        for (const key of scanner.matchKeys) {
          scannedTargets.add(key);
        }
      }
    }
    // Also collect scan_scope targets from latest scan step_results
    const stepResults = (scanResults?.step_results ?? scanResults) as Record<string, any> | null;
    if (stepResults) {
      for (const [, val] of Object.entries(stepResults)) {
        if (val?._scan_scope?.target) scannedTargets.add(val._scan_scope.target);
      }
    }

    return structureMap.filter((entry: any) => {
      const name = entry.entity_name?.toLowerCase() || "";
      return !Array.from(scannedTargets).some(t => name.includes(t.toLowerCase()) || t.toLowerCase().includes(name));
    });
  }, [structureMap, scanResults]);

  const unscannedByType = useMemo(() => {
    const groups: Record<string, any[]> = { component: [], route: [], data: [], flow: [] };
    for (const entry of unscannedAreas) {
      const type = entry.entity_type || "data";
      if (!groups[type]) groups[type] = [];
      groups[type].push(entry);
    }
    return groups;
  }, [unscannedAreas]);

  // Entities in structure_map with NO issues across last 3 scans → "no_issues_detected"
  const noIssueEntities = useMemo(() => {
    // Collect all issue targets/names across last 3 scans
    const issuedTargets = new Set<string>();
    for (const scan of last3Scans) {
      const res = scan.results as Record<string, any> | null;
      if (!res) continue;
      const issues = (res.issues ?? res.master_list?.items ?? []) as any[];
      for (const issue of issues) {
        const targets = [issue.target, issue.component, issue.entity_name, issue.title, issue.category].filter(Boolean);
        for (const t of targets) issuedTargets.add(String(t).toLowerCase());
      }
      // Also check step_results for per-step issues
      const steps = (res.step_results ?? res) as Record<string, any>;
      for (const [, val] of Object.entries(steps)) {
        if (Array.isArray(val?.issues)) {
          for (const si of val.issues) {
            const ts = [si.target, si.component, si.entity_name, si.title].filter(Boolean);
            for (const t of ts) issuedTargets.add(String(t).toLowerCase());
          }
        }
      }
    }
    // Filter structure_map entities that are NOT in unscannedAreas AND have no issues
    return structureMap.filter((entry: any) => {
      const name = entry.entity_name?.toLowerCase() || "";
      const isUnscanned = unscannedAreas.some((u: any) => u.entity_name === entry.entity_name && u.entity_type === entry.entity_type);
      if (isUnscanned) return false; // already shown in unscanned
      return !Array.from(issuedTargets).some(t => name.includes(t) || t.includes(name));
    });
  }, [structureMap, last3Scans, unscannedAreas]);

  const noIssueByType = useMemo(() => {
    const groups: Record<string, any[]> = { component: [], route: [], data: [], flow: [] };
    for (const entry of noIssueEntities) {
      const type = entry.entity_type || "data";
      if (!groups[type]) groups[type] = [];
      groups[type].push(entry);
    }
    return groups;
  }, [noIssueEntities]);

  // Orphan Elements: entities with no flow connection, no recent issues, not referenced by any work_item
  const orphanEntities = useMemo(() => {
    // Collect all entity names referenced by flows (from scan results)
    const flowConnected = new Set<string>();
    const stepResults = (scanResults?.step_results ?? scanResults) as Record<string, any> | null;
    if (stepResults) {
      for (const [, val] of Object.entries(stepResults)) {
        // Flows reference routes, components, etc.
        if (Array.isArray(val?.flows)) {
          for (const f of val.flows) {
            [f.startRoute, f.endRoute, f.component, f.entity, ...(f.steps || [])].filter(Boolean).forEach((s: string) => flowConnected.add(String(s).toLowerCase()));
          }
        }
        if (Array.isArray(val?.issues)) {
          for (const iss of val.issues) {
            [iss.route, iss.component, iss.element, iss.entity, iss.chain].filter(Boolean).forEach((s: string) => flowConnected.add(String(s).toLowerCase()));
          }
        }
      }
    }

    // Collect all entity names referenced by work_items
    const workItemRefs = new Set<string>();
    for (const wi of workItems) {
      const refs = [wi.title, (wi as any).source_component, (wi as any).source_path, (wi as any).source_file].filter(Boolean);
      for (const r of refs) workItemRefs.add(String(r).toLowerCase());
    }

    // Collect issue targets from last 3 scans (reuse logic)
    const issuedTargets = new Set<string>();
    for (const scan of last3Scans) {
      const res = scan.results as Record<string, any> | null;
      if (!res) continue;
      const issues = (res.issues ?? res.master_list?.items ?? []) as any[];
      for (const issue of issues) {
        [issue.target, issue.component, issue.entity_name, issue.title].filter(Boolean).forEach((t: any) => issuedTargets.add(String(t).toLowerCase()));
      }
    }

    return structureMap.filter((entry: any) => {
      const name = entry.entity_name?.toLowerCase() || "";
      const type = entry.entity_type || "";
      if (type === "flow") return false; // flows themselves are not orphans
      const hasFlowConnection = Array.from(flowConnected).some(f => name.includes(f) || f.includes(name));
      const hasRecentIssues = Array.from(issuedTargets).some(t => name.includes(t) || t.includes(name));
      const hasWorkItemRef = Array.from(workItemRefs).some(r => r.includes(name) || name.includes(r));
      return !hasFlowConnection && !hasRecentIssues && !hasWorkItemRef;
    });
  }, [structureMap, scanResults, workItems, last3Scans]);

  const orphanByType = useMemo(() => {
    const groups: Record<string, any[]> = { component: [], route: [], data: [] };
    for (const entry of orphanEntities) {
      const type = entry.entity_type || "data";
      if (!groups[type]) groups[type] = [];
      groups[type].push(entry);
    }
    return groups;
  }, [orphanEntities]);

  // Orphan files from file_system_map: used_in === [] AND not a page/edge_function (entry points)
  const orphanFiles = useMemo(() => {
    return fileSystemMap.filter(
      (f) => f.used_in.length === 0 && f.type !== "page" && f.type !== "edge_function"
    );
  }, []);

  // Structure sanity issues from file_system_map
  const structureIssues = useMemo(() => {
    const issues: { path: string; issue: string; issue_type: string; fix_confidence: number }[] = [];
    for (const f of fileSystemMap) {
      const fileName = f.path.split("/").pop() || "";
      // Component file NOT in /components (PascalCase .tsx not in components or pages)
      if (fileName.match(/^[A-Z]/) && fileName.match(/\.tsx$/) && f.type !== "component" && f.type !== "page") {
        issues.push({ path: f.path, issue: "Component in wrong folder", issue_type: "improvement", fix_confidence: 3 });
      }
      // API logic in /components
      if (f.type === "component" && f.has_api_logic) {
        issues.push({ path: f.path, issue: "Logic misplaced in UI layer", issue_type: "improvement", fix_confidence: 3 });
      }
      // Page inside components folder
      if (f.path.includes("/components/") && (fileName.toLowerCase().includes("page") || fileName.toLowerCase().includes("dashboard")) && !fileName.toLowerCase().includes("content")) {
        issues.push({ path: f.path, issue: "Page incorrectly placed in components", issue_type: "improvement", fix_confidence: 3 });
      }
    }
    return issues;
  }, []);

  // Issue Clusters: group all scan issues by affected_area.target
  const issueClusters = useMemo(() => {
    const rawIssues = (scanResults?.issues as any[] | undefined) ?? [];
    const clusterMap = new Map<string, { target: string; type: string; issues: any[] }>();
    for (const issue of rawIssues) {
      const target = issue._affected_area?.target || issue.component || issue.category || "unknown";
      const type = issue._affected_area?.type || issue.type || "general";
      if (!clusterMap.has(target)) clusterMap.set(target, { target, type, issues: [] });
      clusterMap.get(target)!.issues.push(issue);
    }
    return Array.from(clusterMap.values())
      .map((c, idx) => ({ ...c, cluster_id: `cluster_${idx}`, cluster_size: c.issues.length }))
      .sort((a, b) => b.cluster_size - a.cluster_size);
  }, [scanResults]);

  // No-effect fix detection: done items whose issue reappeared in last 2 scans
  const noEffectFixIds = useMemo(() => {
    const doneItems = workItems.filter(w => w.status === "done" || w.status === "completed");
    const recentIssueFingerprints = new Set<string>();
    const recentIssueTitles = new Set<string>();
    const scansToCheck = last3Scans.slice(0, 2);
    for (const scan of scansToCheck) {
      const res = scan.results as Record<string, any> | null;
      if (!res) continue;
      const issues = (res.issues ?? res.detected_issues ?? []) as any[];
      for (const issue of issues) {
        if (issue.fingerprint) recentIssueFingerprints.add(issue.fingerprint.toLowerCase());
        if (issue.title) recentIssueTitles.add(issue.title.toLowerCase().trim());
      }
      for (const [, val] of Object.entries(res)) {
        if (Array.isArray(val)) {
          for (const item of val) {
            if (item?.fingerprint) recentIssueFingerprints.add(item.fingerprint.toLowerCase());
            if (item?.title) recentIssueTitles.add(item.title.toLowerCase().trim());
          }
        }
        if (val?.issues && Array.isArray(val.issues)) {
          for (const item of val.issues) {
            if (item?.fingerprint) recentIssueFingerprints.add(item.fingerprint.toLowerCase());
            if (item?.title) recentIssueTitles.add(item.title.toLowerCase().trim());
          }
        }
      }
    }
    const flagged = new Set<string>();
    for (const item of doneItems) {
      const fp = item.issue_fingerprint?.toLowerCase();
      const title = item.title?.toLowerCase().trim();
      if ((fp && recentIssueFingerprints.has(fp)) || (title && recentIssueTitles.has(title))) {
        flagged.add(item.id);
      }
    }
    return flagged;
  }, [workItems, last3Scans]);

  // Priority View: top 10 most critical problems sorted by impact_score, cluster_size, occurrence_count
  const priorityItems = useMemo(() => {
    const rawIssues = (scanResults?.issues as any[] | undefined) ?? [];
    // Build cluster size lookup
    const clusterSizeMap = new Map<string, number>();
    for (const issue of rawIssues) {
      const target = issue._affected_area?.target || issue.component || issue.category || "unknown";
      clusterSizeMap.set(target, (clusterSizeMap.get(target) || 0) + 1);
    }
    // Enrich each issue with sorting keys
    const enriched = rawIssues.map((issue: any) => {
      const target = issue._affected_area?.target || issue.component || issue.category || "unknown";
      return {
        ...issue,
        _sort_impact: issue._impact_score ?? 0,
        _sort_cluster: clusterSizeMap.get(target) ?? 1,
        _sort_occurrence: issue._occurrence_count ?? 1,
        _cluster_target: target,
      };
    });
    enriched.sort((a: any, b: any) => {
      if (b._sort_impact !== a._sort_impact) return b._sort_impact - a._sort_impact;
      if (b._sort_cluster !== a._sort_cluster) return b._sort_cluster - a._sort_cluster;
      return b._sort_occurrence - a._sort_occurrence;
    });
    return enriched.slice(0, 10);
  }, [scanResults]);

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
        // Silent failure: scope exists, executed, but zero issues, zero work_items, no history activity
        const relatedWorkItems = scanItems.filter(w => {
          const t = w.title?.toLowerCase() || "";
          return scanner.matchKeys.some(mk => t.includes(mk.toLowerCase()));
        });
        const silentFailure = executed && scopeSize > 0 && detected === 0 && created === 0 && relatedWorkItems.length === 0;
        return { ...scanner, detected, afterFilter: created, skipped, created, health, silentFailure, rawIssues: uniqueRaw, executed, executionTimeMs, inputSize, emptyReason, scanStartedAt, scanFinishedAt, scanScope, createTrace };
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
    setAiAnswer('Systemanalys via skanning. Använd Starta skanning för att analysera systemet.');
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

  const systemTruth = {
    scanWorking: latestBackendScan && (latestRun as any)?.total_new_issues > 0,
    workItemsCreated: (latestRun as any)?.work_items_created > 0,
  };

  return (
    <div className="flex h-full min-h-0">
      {/* Main tree panel */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {!systemTruth.scanWorking && <p className="text-[10px] text-red-500 font-mono">❌ SCAN NOT PRODUCING DATA</p>}
        {!systemTruth.workItemsCreated && <p className="text-[10px] text-red-500 font-mono">❌ PIPELINE BLOCKED</p>}
        <p className="text-xs text-green-500 font-mono">TEST BUILD OK — Files detected: {fileSystemMap.length}</p>
        <div className="text-[10px] font-mono text-muted-foreground">Last action: {lastAction || "none"}</div>

        <button onClick={() => {
          setActionLogs(prev => [
            {
              time: new Date().toISOString(),
              type: "MANUAL_TEST",
              message: "Button clicked",
              timestamp: Date.now()
            },
            ...prev
          ]);
        }} className="px-3 py-1 text-xs bg-primary text-primary-foreground rounded">
          TEST ACTION
        </button>

        {/* Action Monitor */}
        <details className="border border-border rounded-md">
          <summary className="px-3 py-1.5 text-[10px] font-semibold cursor-pointer bg-muted/30 hover:bg-muted/50 transition-colors">
            Action Monitor ({actionLogs.length})
          </summary>
          <div className="max-h-48 overflow-y-auto">
            {actionLogs.length === 0 ? (
              <p className="text-[10px] text-muted-foreground px-3 py-2">No actions logged yet</p>
            ) : (
              <table className="w-full text-[10px]">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="px-3 py-1 text-left">Time</th>
                    <th className="px-3 py-1 text-left">Type</th>
                    <th className="px-3 py-1 text-left">Status</th>
                    <th className="px-3 py-1 text-left">Message</th>
                  </tr>
                </thead>
                <tbody>
                  {actionLogs.slice(0, 10).map((log, i) => (
                    <tr key={i} className="border-b border-border/50 hover:bg-muted/20">
                      <td className="px-3 py-1 font-mono text-muted-foreground">{log.time?.split("T")[1]?.slice(0, 8)}</td>
                      <td className="px-3 py-1 font-medium text-foreground">{log.type}</td>
                      <td className="px-3 py-1">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${
                          log.status === "success" ? "bg-green-500/20 text-green-400" :
                          log.status === "error" || log.status === "no-data" ? "bg-red-500/20 text-red-400" :
                          log.status === "started" ? "bg-blue-500/20 text-blue-400" :
                          "bg-yellow-500/20 text-yellow-400"
                        }`}>{log.status}</span>
                      </td>
                      <td className="px-3 py-1 text-muted-foreground truncate max-w-[200px]">{log.message || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </details>
        <div className="flex gap-2 items-center">
          <Input
            placeholder="Search code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="h-7 text-[10px] max-w-[250px]"
          />
          <Button variant="outline" size="sm" className="text-[10px] h-7" onClick={handleSearch}>Search</Button>
          <span className="text-[9px] text-yellow-500/70 font-mono">⚠ Frontend scan (static / debug only)</span>
        </div>
        {searchResults.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold mb-1">Search Results ({searchResults.length})</h3>
            {searchResults.map((r, i) => (
              <div
                key={i}
                style={{
                  padding: "8px",
                  borderBottom: "1px solid hsl(var(--border))",
                  cursor: "pointer"
                }}
                onClick={() => {
                  const entry = fileSystemMap.find(f => f.path === r.path);
                  if (entry) setSelectedFile(entry);
                }}
              >
                <div><strong>{r.path}</strong></div>
                <div className="text-muted-foreground">Line {r.lineNumber}</div>
                <div style={{ fontFamily: "monospace" }} className="text-xs">
                  {r.line}
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2 flex-wrap">
          <Database className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">System Explorer</h1>
          <Badge variant="outline" className="ml-2">READ-ONLY</Badge>
          {isSystemAdmin && <Badge className="bg-primary/10 text-primary text-[10px]"><Shield className="h-3 w-3 mr-1" />SYSTEM ADMIN</Badge>}
          {isViewerAdmin && <Badge variant="secondary" className="text-[10px]"><Lock className="h-3 w-3 mr-1" />VIEWER</Badge>}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          {isSystemAdmin && (
            <>
            <Button variant="default" size="sm" onClick={() =>
              validateAction("FULL_SCAN", async () => {
                const rawPaths = Object.keys(getRawSources() || {});
                // Structure map failsafe: use fallback if empty — do NOT abort
                const structure_map = rawPaths.length > 0 ? rawPaths.map(p => ({ path: p })) : [{ path: "/" }];
                setIsScanning(true);
                setScanProgress({ step: 0, total: 11, label: "Startar..." });
                const pollInterval = setInterval(async () => {
                  try {
                    const { data } = await supabase.from("scan_runs").select("current_step, current_step_label").order("created_at", { ascending: false }).limit(1).single();
                    if (data) {
                      setScanProgress({ step: data.current_step || 0, total: 11, label: data.current_step_label || "Scanning..." });
                    }
                  } catch (_) {}
                }, 2000);
                try {
                  await safeInvoke("run-full-scan", {
                    action: "start", scan_mode: "full", source: "EXPLORER", structure_map,
                  });
                } finally {
                  clearInterval(pollInterval);
                  setIsScanning(false);
                  setScanProgress(null);
                }
                return true;
              })
            } disabled={isScanning}>
              {isScanning ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Radar className="h-4 w-4 mr-1" />}
              {isScanning && scanProgress ? `Scanning... (${scanProgress.step}/${scanProgress.total})` : isScanning ? "Scanning..." : "Run Full Scan"}
            </Button>
            {isScanning && scanProgress && (
              <div className="flex items-center gap-2 ml-2">
                <div className="w-32 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${Math.round((scanProgress.step / scanProgress.total) * 100)}%` }} />
                </div>
                <span className="text-[9px] text-muted-foreground truncate max-w-[200px]">{scanProgress.label}</span>
              </div>
            )}
            </>
          )}
           {isSystemAdmin && (
             <Button variant="outline" size="sm" onClick={() => setShowRawScan(!showRawScan)}>
               <FileText className="h-4 w-4 mr-1" />
               {showRawScan ? "Hide Raw Scan" : "View Raw Scan"}
             </Button>
           )}
        </div>

        {/* TAB BAR */}
        <div className="flex gap-1 border-b border-border">
          <button onClick={() => setMainTab("system")} className={`px-3 py-1.5 text-xs font-medium rounded-t-md transition-colors ${mainTab === "system" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/50"}`}>
            System
          </button>
          <button onClick={() => setMainTab("files")} className={`px-3 py-1.5 text-xs font-medium rounded-t-md transition-colors ${mainTab === "files" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/50"}`}>
            Files ({fileSystemMap.length})
          </button>
          <button onClick={() => setMainTab("patch")} className={`px-3 py-1.5 text-xs font-medium rounded-t-md transition-colors ${mainTab === "patch" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/50"}`}>
            Patch Controller
          </button>
          <button onClick={() => setMainTab("codeindex")} className={`px-3 py-1.5 text-xs font-medium rounded-t-md transition-colors ${mainTab === "codeindex" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/50"}`}>
            Code Index
          </button>
          <button onClick={() => setMainTab("backendscan")} className={`px-3 py-1.5 text-xs font-medium rounded-t-md transition-colors ${mainTab === "backendscan" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/50"}`}>
            Backend Scan
          </button>
          <button onClick={() => setMainTab("monitor")} className={`px-3 py-1.5 text-xs font-medium rounded-t-md transition-colors ${mainTab === "monitor" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/50"}`}>
            Monitor
          </button>
        </div>

        {/* MONITOR TAB */}
        {mainTab === "monitor" && (
          <ActionMonitorPanel />
        )}

        {/* BACKEND SCAN TAB */}
        {mainTab === "backendscan" && (() => {
          if (!latestBackendScan) {
            console.error("❌ NO BACKEND SCAN FOUND");
          }
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
        })()}

        {/* CODE INDEX TAB */}
        {mainTab === "codeindex" && (() => {
          const index = getCodeIndex();
          const componentApiIssues = index.filter(f => f.hasApiCall && f.path.includes("/components"));
          return (
            <div className="space-y-3">
            {index.length === 0 && (
              <p className="text-[10px] text-yellow-500">⚠ Code Index empty — scanner not connected</p>
            )}
            {codeScanResult && codeScanResult.filter(i => i.type === "structure").length === 0 && (
              <p className="text-[10px] text-yellow-500">⚠ No API calls detected — possible broken scan</p>
            )}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><Layers className="h-4 w-4" /> Code Index ({index.length} files)</CardTitle>
                <Button variant="outline" size="sm" className="text-[10px] h-6 ml-auto" onClick={() =>
                  validateAction("SCAN_CODE", () => {
                    const sources = getRawSources() || {};
                    const results: { type: string; message: string; file: string }[] = [];
                    Object.entries(sources).forEach(([path, content]) => {
                      const issues = scanFileContent(path, content as string);
                      results.push(...issues);
                    });
                    if (!results || results.length === 0) {
                      throw new Error("Code index empty");
                    }
                    setCodeScanResult(results);
                    return true;
                  })
                }>
                  Scan Code
                </Button>
              </CardHeader>
              {codeScanResult && (
                <div className="flex gap-3 text-[10px] px-3 pb-2 flex-wrap">
                  <div className="px-3 py-1.5 rounded-md bg-muted/30 border border-border">
                    <span className="text-muted-foreground">Total issues: </span><span className="font-bold text-foreground">{codeScanResult.length}</span>
                  </div>
                  <div className="px-3 py-1.5 rounded-md bg-muted/30 border border-border">
                    <span className="text-muted-foreground">Structure: </span><span className="font-bold text-foreground">{codeScanResult.filter(i => i.type === "structure").length}</span>
                  </div>
                  <div className="px-3 py-1.5 rounded-md bg-muted/30 border border-border">
                    <span className="text-muted-foreground">Bugs: </span><span className="font-bold text-foreground">{codeScanResult.filter(i => i.type === "bug").length}</span>
                  </div>
                  <div className="px-3 py-1.5 rounded-md bg-muted/30 border border-border">
                    <span className="text-muted-foreground">Performance: </span><span className={`font-bold ${codeScanResult.filter(i => i.type === "performance").length > 0 ? "text-yellow-500" : "text-foreground"}`}>{codeScanResult.filter(i => i.type === "performance").length}</span>
                  </div>
                </div>
              )}
              <CardContent className="p-0">
                <div className="max-h-[500px] overflow-auto">
                  <table className="w-full text-[10px]">
                    <thead className="sticky top-0 bg-background border-b border-border">
                      <tr>
                        <th className="text-left p-2 text-muted-foreground font-medium">File</th>
                        <th className="text-right p-2 text-muted-foreground font-medium">Lines</th>
                        <th className="text-center p-2 text-muted-foreground font-medium">API Call</th>
                        <th className="text-center p-2 text-muted-foreground font-medium">useEffect</th>
                      </tr>
                    </thead>
                    <tbody>
                      {index.map((f) => (
                        <tr key={f.path} className="border-b border-border/50 hover:bg-muted/30">
                          <td className="p-2 font-mono text-foreground truncate max-w-[300px]">{f.path.replace(/^\//, "")}</td>
                          <td className="p-2 text-right text-muted-foreground">{f.lineCount}</td>
                          <td className="p-2 text-center">{f.hasApiCall ? <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30 text-[8px]">yes</Badge> : <span className="text-muted-foreground">no</span>}</td>
                          <td className="p-2 text-center">{f.hasUseEffect ? <Badge className="bg-blue-500/20 text-blue-500 border-blue-500/30 text-[8px]">yes</Badge> : <span className="text-muted-foreground">no</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {codeScanResult && codeScanResult.length > 0 && (
              <Card className="mt-3">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Detected Issues ({codeScanResult.length})</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="max-h-[400px] overflow-auto">
                    <table className="w-full text-[10px]">
                      <thead className="sticky top-0 bg-background border-b border-border">
                        <tr>
                          <th className="text-left p-2 text-muted-foreground font-medium">File</th>
                          <th className="text-left p-2 text-muted-foreground font-medium">Type</th>
                          <th className="text-left p-2 text-muted-foreground font-medium">Message</th>
                        </tr>
                      </thead>
                      <tbody>
                        {codeScanResult.map((issue, idx) => (
                          <tr key={idx} className="border-b border-border/50 hover:bg-muted/30">
                            <td className="p-2 font-mono text-foreground truncate max-w-[250px]">{issue.file.replace(/^\//, "")}</td>
                            <td className="p-2">
                              <Badge className={`text-[8px] ${issue.type === "bug" ? "bg-red-500/20 text-red-500 border-red-500/30" : issue.type === "structure" ? "bg-yellow-500/20 text-yellow-500 border-yellow-500/30" : issue.type === "performance" ? "bg-orange-500/20 text-orange-500 border-orange-500/30" : "bg-muted text-muted-foreground border-border"}`}>{issue.type}</Badge>
                            </td>
                            <td className="p-2 text-muted-foreground">{issue.message}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Live Code Issues */}
            {globalIssues.length > 0 && (
              <Card className="mt-3">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Bug className="h-4 w-4" /> Live Code Issues ({globalIssues.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 max-h-[300px] overflow-y-auto space-y-1">
                  {globalIssues.map((issue, i) => (
                    <div key={i} className="text-xs border-b border-border/50 pb-1">
                      <div className="font-semibold text-foreground">{issue.file}</div>
                      <div className="text-muted-foreground">{issue.message}</div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Scan Input */}
            {latestRun && (() => {
              const ur = latestRun.unified_result as any;
              const si = ur?.steps_results?._scan_input || (latestRun as any).steps_results?._scan_input;
              if (!si) return null;
              return (
                <Card className="mt-3">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Layers className="h-4 w-4" /> Scan Input
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex gap-4 text-xs">
                      <div className="flex items-center gap-1"><Badge variant="outline">Components</Badge><span className="font-mono">{si.components_count ?? "–"}</span></div>
                      <div className="flex items-center gap-1"><Badge variant="outline">Routes</Badge><span className="font-mono">{si.routes_count ?? "–"}</span></div>
                      <div className="flex items-center gap-1"><Badge variant="outline">Data</Badge><span className="font-mono">{si.data_entities_count ?? "–"}</span></div>
                    </div>
                  </CardContent>
                </Card>
              );
            })()}

            {/* Frontend Health — Grouped by Viewport */}
            {codeScanResult && codeScanResult.length > 0 && (() => {
              const responsiveIssues = codeScanResult.filter((i: any) => i.type === "responsive");
              const structureIssues = codeScanResult.filter(i => i.type === "structure");
              const bugIssues = codeScanResult.filter(i => i.type === "bug");
              const errorIssues = codeScanResult.filter(i => i.type === "error");
              const viewports = ["mobile", "tablet", "desktop"] as const;
              const grouped: Record<string, any[]> = {};
              for (const vp of viewports) {
                grouped[vp] = responsiveIssues.filter((i: any) => i.viewport === vp);
              }
              const totalHealth = responsiveIssues.length + structureIssues.length + bugIssues.length + errorIssues.length;
              if (totalHealth === 0) return null;
              return (
                <Card className="mt-3">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Monitor className="h-4 w-4" /> Frontend Health ({totalHealth} issues)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 space-y-3">
                    {/* Summary badges */}
                    <div className="flex gap-2 flex-wrap text-[10px]">
                      {bugIssues.length > 0 && <Badge className="bg-red-500/20 text-red-500 border-red-500/30 text-[8px]">Broken Interactions: {bugIssues.length}</Badge>}
                      {responsiveIssues.length > 0 && <Badge className="bg-orange-500/20 text-orange-500 border-orange-500/30 text-[8px]">Responsiveness: {responsiveIssues.length}</Badge>}
                      {structureIssues.length > 0 && <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30 text-[8px]">Layout Issues: {structureIssues.length}</Badge>}
                      {errorIssues.length > 0 && <Badge className="bg-red-500/20 text-red-500 border-red-500/30 text-[8px]">Missing UI: {errorIssues.length}</Badge>}
                    </div>
                    {/* Viewport groups */}
                    {viewports.map(vp => {
                      const vpIssues = grouped[vp];
                      if (!vpIssues || vpIssues.length === 0) return null;
                      return (
                        <div key={vp} className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[9px] uppercase">{vp} {vp === "mobile" ? "(375px)" : vp === "tablet" ? "(768px)" : "(1440px)"}</Badge>
                            <span className="text-[9px] text-muted-foreground">{vpIssues.length} issue{vpIssues.length > 1 ? "s" : ""}</span>
                          </div>
                          <div className="max-h-[200px] overflow-auto">
                            <table className="w-full text-[10px]">
                              <tbody>
                                {vpIssues.map((issue: any, idx: number) => (
                                  <tr key={idx} className="border-b border-border/50 hover:bg-muted/30">
                                    <td className="p-1.5 font-mono text-foreground truncate max-w-[200px]">{issue.file.replace(/^\//, "")}</td>
                                    <td className="p-1.5 text-muted-foreground">{issue.message}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              );
            })()}

            {/* All Code Issues with Analysis */}
            {(() => {
              const ratingOrder = { good: 0, neutral: 1, bad: 2 } as const;
              const allIssues = getCodeIssues().sort((a, b) => (ratingOrder[a.analysis_rating] ?? 1) - (ratingOrder[b.analysis_rating] ?? 1));
              const ratingColor = (r: string) => r === "good" ? "text-green-500" : r === "bad" ? "text-red-500" : "text-yellow-500";
              const ratingBg = (r: string) => r === "good" ? "bg-green-500/10 border-green-500/20" : r === "bad" ? "bg-red-500/10 border-red-500/20" : "bg-yellow-500/10 border-yellow-500/20";
              return (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-yellow-500" />
                      Code Issues ({allIssues.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1 p-3 max-h-[400px] overflow-auto">
                    {allIssues.length === 0 ? (
                      <p className="text-[10px] text-muted-foreground">No issues detected.</p>
                    ) : (
                      allIssues.map((issue, i) => (
                        <details key={i} className={`rounded-md border p-2 ${ratingBg(issue.analysis_rating)}`}>
                          <summary className="flex items-center gap-2 cursor-pointer text-[10px]">
                            <Badge variant="outline" className="text-[8px]">{issue.issue_type}</Badge>
                            <span className="font-mono text-foreground flex-1 truncate">{issue.path.replace(/^\//, "")}</span>
                            <span className="text-[9px] text-muted-foreground">{issue.message}</span>
                          </summary>
                          <div className="mt-2 ml-2 border-l-2 border-border pl-3 space-y-1">
                            <div className="text-[10px]">
                              <span className="text-muted-foreground">Rating: </span>
                              <span className={`font-medium ${ratingColor(issue.analysis_rating)}`}>{issue.analysis_rating}</span>
                            </div>
                            <div className="text-[10px]">
                              <span className="text-muted-foreground">Reason: </span>
                              <span className="text-foreground">{issue.analysis_reason}</span>
                            </div>
                            <div className="text-[10px]">
                              <span className="text-muted-foreground">Confidence: </span>
                              <span className="text-foreground">{issue.analysis_confidence}/5</span>
                            </div>
                          </div>
                        </details>
                      ))
                    )}
                  </CardContent>
                </Card>
              );
            })()}
            </div>
          );
        })()}

        {/* FILES TAB */}
        {mainTab === "files" && (
          <div className="space-y-3">
            <span className="text-[9px] text-yellow-500/70 font-mono">⚠ Frontend scan (static / debug only)</span>
            <span className="text-[9px] text-yellow-500/70 font-mono ml-2">⚠ Not connected to real codebase</span>
            {Object.keys(getRawSources() || {}).length === 0 && (
              <p className="text-[10px] text-red-500 font-mono">❌ No source data — frontend scan is blind</p>
            )}
            {/* Filters */}
            <div className="flex gap-1 items-center">
              {(["all", "orphan", "has_issues"] as const).map((f) => (
                <button key={f} onClick={() => setFilesFilter(f)} className={`px-2 py-1 text-[10px] rounded-md border transition-colors ${filesFilter === f ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted/50"}`}>
                  {f === "all" ? `All (${fileSystemMap.length})` : f === "orphan" ? `Orphan (${fileSystemMap.filter(fi => fi.used_in.length === 0 && fi.type !== "page" && fi.type !== "edge_function").length})` : `Has Issues (${fileSystemMap.filter(fi => structureIssues.some(si => si.path === fi.path)).length})`}
                </button>
              ))}
              <Button variant="outline" size="sm" className="text-[10px] h-6 ml-auto" onClick={() =>
                validateAction("SCAN_FILES", () => {
                  const files = Object.keys(getRawSources() || {});
                  if (!files.length) {
                    throw new Error("No files available");
                  }
                  const result = files.length;
                  setFileScanResult({ total: result, emptyFiles: files.filter(f => !getRawSources()[f]?.trim()).length, largeFiles: 0 });
                  return true;
                })
              }>
                Scan Files
              </Button>
            </div>

            {fileScanResult ? (
              <div className="flex gap-3 text-[10px]">
                <div className="px-3 py-1.5 rounded-md bg-muted/30 border border-border">
                  <span className="text-muted-foreground">Total: </span><span className="font-bold text-foreground">{fileScanResult.total}</span>
                </div>
                <div className="px-3 py-1.5 rounded-md bg-muted/30 border border-border">
                  <span className="text-muted-foreground">Empty: </span><span className={`font-bold ${fileScanResult.emptyFiles > 0 ? "text-red-500" : "text-foreground"}`}>{fileScanResult.emptyFiles}</span>
                </div>
                <div className="px-3 py-1.5 rounded-md bg-muted/30 border border-border">
                  <span className="text-muted-foreground">Large (5k+): </span><span className={`font-bold ${fileScanResult.largeFiles > 0 ? "text-yellow-500" : "text-foreground"}`}>{fileScanResult.largeFiles}</span>
                </div>
              </div>
            ) : (
              <div className="flex gap-3 text-[10px]">
                <div className="px-3 py-1.5 rounded-md bg-muted/30 border border-border">
                  <span className="text-muted-foreground">Total: </span><span className="font-bold text-foreground">0</span>
                </div>
                <div className="px-3 py-1.5 rounded-md bg-muted/30 border border-border">
                  <span className="text-muted-foreground">Empty: </span><span className="font-bold text-foreground">0</span>
                </div>
                <div className="px-3 py-1.5 rounded-md bg-muted/30 border border-border">
                  <span className="text-muted-foreground">Large (5k+): </span><span className="font-bold text-foreground">0</span>
                </div>
              </div>
            )}

            <div className="flex gap-3 min-h-[500px]">
              {/* LEFT: Folder tree */}
              <div className="w-1/2 border border-border rounded-md overflow-y-auto max-h-[600px]">
                {(() => {
                  const filtered = fileSystemMap.filter((f) => {
                    if (filesFilter === "orphan") return f.used_in.length === 0 && f.type !== "page" && f.type !== "edge_function";
                    if (filesFilter === "has_issues") return structureIssues.some(si => si.path === f.path);
                    return true;
                  });
                  const tree: Record<string, FileEntry[]> = {};
                  for (const f of filtered) {
                    if (!tree[f.folder]) tree[f.folder] = [];
                    tree[f.folder].push(f);
                  }
                  const folders = Object.keys(tree).sort();
                  return (
                    <div className="space-y-0.5 p-1">
                      {folders.map((folder) => {
                        const files = tree[folder];
                        const fKey = `ftab_${folder}`;
                        const isOpen = expandedScanners[fKey] ?? false;
                        return (
                          <div key={folder}>
                            <button
                              onClick={() => setExpandedScanners(prev => ({ ...prev, [fKey]: !prev[fKey] }))}
                              className="flex items-center gap-1.5 w-full text-left px-2 py-1 text-[10px] hover:bg-muted/50 rounded-md"
                            >
                              {isOpen ? <FolderOpen className="h-3 w-3 text-primary" /> : <Folder className="h-3 w-3 text-muted-foreground" />}
                              <span className="font-mono truncate flex-1">{folder}</span>
                              <Badge variant="outline" className="text-[8px]">{files.length}</Badge>
                            </button>
                            {isOpen && (
                              <div className="pl-4 space-y-0.5">
                                {files.map((f) => {
                                  const isOrphan = f.used_in.length === 0 && f.type !== "page" && f.type !== "edge_function";
                                  const hasIssue = structureIssues.some(si => si.path === f.path);
                                  const isSelected = selectedFile?.path === f.path;
                                  return (
                                    <button
                                      key={f.path}
                                      onClick={() => setSelectedFile(f)}
                                      className={`flex items-center gap-1.5 w-full text-left px-2 py-0.5 text-[10px] rounded-md transition-colors ${isSelected ? "bg-primary/20 border border-primary/30" : "hover:bg-muted/30"}`}
                                    >
                                      <FileText className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                      <span className="font-mono truncate flex-1">{f.path.split("/").pop()}</span>
                                      {isOrphan && <span className="text-[8px] text-destructive">●</span>}
                                      {hasIssue && <span className="text-[8px] text-orange-500">▲</span>}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {folders.length === 0 && <p className="text-xs text-muted-foreground p-2">Inga filer matchar filtret.</p>}
                    </div>
                  );
                })()}
              </div>

              {/* RIGHT: Selected file info */}
              <div className="w-1/2 border border-border rounded-md p-3 overflow-y-auto max-h-[600px]">
                {selectedFile ? (
                  <div className="space-y-3">
                    <div>
                      <span className="text-[10px] text-muted-foreground">File Path</span>
                      <p className="font-mono text-xs text-foreground break-all">{selectedFile.path}</p>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant="secondary" className="text-[9px]">{selectedFile.type}</Badge>
                      {selectedFile.used_in.length === 0 && selectedFile.type !== "page" && selectedFile.type !== "edge_function" && (
                        <Badge variant="destructive" className="text-[9px]">orphan</Badge>
                      )}
                      {selectedFile.has_api_logic && (
                        <Badge variant="outline" className="text-[9px] border-orange-500 text-orange-500">API logic</Badge>
                      )}
                    </div>

                    <div>
                      <span className="text-[10px] text-muted-foreground">Used In ({selectedFile.used_in.length})</span>
                      {selectedFile.used_in.length > 0 ? (
                        <div className="space-y-0.5 mt-1">
                          {selectedFile.used_in.map((ref) => (
                            <div key={ref} className="font-mono text-[10px] text-foreground bg-muted/30 rounded px-2 py-0.5">{ref}</div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[10px] text-destructive mt-1">Not imported anywhere</p>
                      )}
                    </div>

                    <div>
                      <span className="text-[10px] text-muted-foreground">Issues Linked</span>
                      {(() => {
                        const linked = structureIssues.filter(si => si.path === selectedFile.path);
                        const wiLinked = workItems.filter((wi: any) => wi.source_file === selectedFile.path || wi.source_path === selectedFile.path);
                        const all = [...linked.map(l => ({ label: l.issue, type: l.issue_type, confidence: l.fix_confidence })), ...wiLinked.map((w: any) => ({ label: w.title, type: w.item_type, confidence: null }))];
                        if (all.length === 0) return <p className="text-[10px] text-muted-foreground mt-1">No issues</p>;
                        return (
                          <div className="space-y-0.5 mt-1">
                            {all.map((item, i) => (
                              <div key={i} className="flex items-center gap-1.5 text-[10px] bg-muted/30 rounded px-2 py-0.5">
                                <Badge variant="outline" className="text-[8px] px-1 py-0">{item.type}</Badge>
                                <span className="text-foreground truncate">{item.label}</span>
                                {item.confidence != null && <span className="text-muted-foreground ml-auto">🎯 {item.confidence}/5</span>}
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>

                    <div>
                      <span className="text-[10px] text-muted-foreground">Orphan Status</span>
                      <p className="text-xs mt-0.5">
                        {selectedFile.type === "page" || selectedFile.type === "edge_function"
                          ? <span className="text-muted-foreground">Entry point — not checked</span>
                          : selectedFile.used_in.length > 0
                            ? <span className="text-green-500">✅ Active — {selectedFile.used_in.length} reference(s)</span>
                            : <span className="text-destructive">⚠️ Orphan — no imports found</span>
                        }
                      </p>
                    </div>

                    {/* File Content */}
                    <div>
                      <span className="text-[10px] text-muted-foreground">Source Code (read-only, max 500 lines)</span>
                      {(() => {
                        const content = getFileContent(selectedFile.path);
                        if (!content) return <p className="text-[10px] text-muted-foreground mt-1">Content not available</p>;
                        const lineCount = content.split("\n").length;
                        return (
                          <div className="mt-1">
                            <p className="text-[9px] text-muted-foreground mb-1">{lineCount} lines</p>
                            <pre className="bg-muted/30 border border-border rounded-md p-2 text-[9px] font-mono overflow-auto max-h-[300px] whitespace-pre text-foreground select-all">{content}</pre>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground text-xs">
                    Select a file to view details
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* PATCH CONTROLLER TAB */}
        {mainTab === "patch" && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Send className="h-4 w-4 text-primary" />
                Patch Controller
              </CardTitle>
              <p className="text-[10px] text-muted-foreground">Validate patch prompts before sending. Must contain FILE:, ADD:, and DO NOT.</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Safe Mode Toggle */}
              <div className="flex items-center justify-between border border-border rounded-md p-2 bg-muted/30">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  <div>
                    <span className="text-xs font-medium text-foreground">Safe Mode</span>
                    <p className="text-[9px] text-muted-foreground">Max 1 patch in queue, block multiple submissions, require confirmation</p>
                  </div>
                </div>
                <button
                  onClick={() => setSafeModeEnabled(!safeModeEnabled)}
                  className={`relative w-9 h-5 rounded-full transition-colors ${safeModeEnabled ? "bg-primary" : "bg-muted"}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${safeModeEnabled ? "translate-x-4" : ""}`} />
                </button>
              </div>
              {safeModeEnabled && patchSubmitted && (
                <div className="border border-orange-500/30 rounded-md p-2 bg-orange-500/10">
                  <p className="text-[10px] text-orange-500 font-medium">⚠️ Safe Mode: A patch is already in queue. Wait for it to complete before submitting another.</p>
                </div>
              )}

              <textarea
                className="w-full h-48 text-xs font-mono bg-muted/30 border border-border rounded-md p-3 text-foreground resize-y"
                placeholder={"DO EXACT PATCH ONLY\nDO NOT REFACTOR\n\nFILE: ...\n\nADD:\n..."}
                value={patchInput}
                onChange={(e) => { setPatchInput(e.target.value); setPatchStatus("idle"); }}
                disabled={safeModeEnabled && patchSubmitted}
              />
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={safeModeEnabled && patchSubmitted}
                  onClick={() => {
                    const text = patchInput.trim();
                    const hasFile = /FILE:/i.test(text);
                    const hasAdd = /ADD:/i.test(text);
                    const hasDoNot = /DO NOT/i.test(text);
                    if (hasFile && hasAdd && hasDoNot) {
                      setPatchStatus("valid");
                    } else {
                      setPatchStatus("invalid");
                    }
                  }}
                >
                  Validate Patch
                </Button>
                {patchStatus === "valid" && !confirmOpen && (
                  <Badge className="bg-green-500/20 text-green-500 border-green-500/30 text-[10px]">✅ Ready to send</Badge>
                )}
                {patchStatus === "valid" && safeModeEnabled && !confirmOpen && (
                  <Button
                    variant="default"
                    size="sm"
                    disabled={patchSubmitted}
                    onClick={() => setConfirmOpen(true)}
                  >
                    Submit Patch
                  </Button>
                )}
                {patchStatus === "invalid" && (
                  <div className="space-y-0.5">
                    <Badge variant="destructive" className="text-[10px]">❌ Invalid patch format</Badge>
                    <div className="flex gap-1 flex-wrap">
                      {!/FILE:/i.test(patchInput) && <span className="text-[9px] text-destructive">Missing FILE:</span>}
                      {!/ADD:/i.test(patchInput) && <span className="text-[9px] text-destructive">Missing ADD:</span>}
                      {!/DO NOT/i.test(patchInput) && <span className="text-[9px] text-destructive">Missing DO NOT</span>}
                    </div>
                  </div>
                )}
              </div>

              {/* Patch Preview */}
              {patchStatus === "valid" && (() => {
                // Extract target file from patch
                const fileMatch = patchInput.match(/FILE:\s*(.+)/i);
                const targetFile = fileMatch ? fileMatch[1].trim() : null;
                
                // Extract ADD/CHANGE content
                const addMatch = patchInput.match(/ADD:\s*([\s\S]*?)(?=\n(?:GOAL|DISPLAY|RULES|SHOW|IF|WHEN|LIMIT|DO NOT|$))/i);
                const addContent = addMatch ? addMatch[1].trim() : null;
                
                // Try to find matching file in fileSystemMap
                const matchedFile = targetFile ? fileSystemMap.find(f => {
                  const name = f.path.split("/").pop()?.replace(/\.tsx?$/, "").toLowerCase() || "";
                  const target = targetFile.toLowerCase().replace(/\.tsx?$/, "");
                  return f.path.toLowerCase().includes(target) || name === target || f.path.toLowerCase().endsWith(target.toLowerCase());
                }) : null;
                
                // Get current file content
                const currentContent = matchedFile ? getFileContent(matchedFile.path) : null;
                
                return (
                  <div className="border border-border rounded-md p-3 bg-muted/20 space-y-2">
                    <p className="text-xs font-medium text-foreground flex items-center gap-2">
                      <Eye className="h-3 w-3" />
                      Patch Preview
                    </p>
                    
                    {/* Target File */}
                    <div>
                      <span className="text-[10px] text-muted-foreground">Target File</span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="font-mono text-[10px] text-foreground">{targetFile || "Unknown"}</span>
                        {matchedFile ? (
                          <Badge className="bg-green-500/20 text-green-500 border-green-500/30 text-[8px]">found: {matchedFile.path}</Badge>
                        ) : (
                          <Badge variant="destructive" className="text-[8px]">not found in file map</Badge>
                        )}
                      </div>
                    </div>
                    
                    {/* Code to add */}
                    {addContent && (
                      <div>
                        <span className="text-[10px] text-muted-foreground">Code Diff (what will be added)</span>
                        <pre className="mt-0.5 bg-green-500/5 border border-green-500/20 rounded-md p-2 text-[9px] font-mono max-h-[150px] overflow-auto whitespace-pre-wrap">
                          {addContent.split("\n").map((line, i) => (
                            <div key={i} className="text-green-500">+ {line}</div>
                          ))}
                        </pre>
                      </div>
                    )}
                    
                    {/* Current file content (collapsed) */}
                    {currentContent && (
                      <details className="text-[10px]">
                        <summary className="text-muted-foreground cursor-pointer hover:text-foreground">Current file content ({currentContent.split("\n").length} lines)</summary>
                        <pre className="mt-1 bg-muted/30 border border-border rounded-md p-2 text-[9px] font-mono max-h-[200px] overflow-auto whitespace-pre text-foreground">{currentContent}</pre>
                      </details>
                    )}
                  </div>
                );
              })()}

              {/* Confirmation Dialog */}
              {confirmOpen && (
                <div className="border border-primary/30 rounded-md p-3 bg-primary/5 space-y-2">
                  <p className="text-xs font-medium text-foreground">⚠️ Confirm submission</p>
                  <p className="text-[10px] text-muted-foreground">Are you sure you want to submit this patch? Safe Mode will block further submissions until this one completes.</p>
                  <pre className="bg-muted/30 border border-border rounded-md p-2 text-[9px] font-mono max-h-[100px] overflow-auto whitespace-pre-wrap text-foreground">{patchInput.slice(0, 500)}</pre>
                  <div className="flex gap-2">
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => {
                        setPatchSubmitted(true);
                        setConfirmOpen(false);
                        setPatchStatus("idle");
                      }}
                    >
                      ✅ Confirm
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setConfirmOpen(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {/* Reset button when submitted */}
              {patchSubmitted && (
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-[10px]">📦 Patch in queue</Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setPatchSubmitted(false);
                      setPatchInput("");
                      setPatchStatus("idle");
                    }}
                  >
                    Clear Queue
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* SYSTEM TAB */}
        {mainTab === "system" && (
        <>
        {showRawScan && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Raw Scan Results (read-only)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(() => {
                if (!scanResults) return <p className="text-xs text-muted-foreground">No scan results available</p>;
                try {
                  const limited = { ...scanResults };
                  const allIssues = limited?.issues ?? limited?._create_trace ?? [];
                  const totalCount = Array.isArray(allIssues) ? allIssues.length : 0;
                  if (Array.isArray(limited?.issues) && limited.issues.length > 50) {
                    limited.issues = limited.issues.slice(0, 50);
                  }
                  if (Array.isArray(limited?._create_trace) && limited._create_trace.length > 50) {
                    limited._create_trace = limited._create_trace.slice(0, 50);
                  }
                  return (
                    <>
                      {totalCount > 50 && (
                        <p className="text-[10px] text-muted-foreground mb-2">Showing 50 of {totalCount} issues</p>
                      )}
                      <pre className="bg-muted/30 border border-border rounded-md p-3 text-[10px] font-mono overflow-auto max-h-[500px] whitespace-pre-wrap text-foreground select-all">
                        {JSON.stringify(limited, null, 2)}
                      </pre>
                    </>
                  );
                } catch (e) {
                  console.error("[DEBUG] JSON RENDER ERROR:", e);
                  return <p className="text-xs text-destructive">Error rendering scan results</p>;
                }
              })()}
            </CardContent>
          </Card>
        )}
        <div className="flex items-center gap-2">
          <select
            className="text-xs border border-border rounded-md px-2 py-1.5 bg-background text-foreground"
            value={selectedSnapshotId || ""}
            onChange={(e) => setSelectedSnapshotId(e.target.value || null)}
          >
            <option value="">Live data</option>
            {scanSnapshots.map((snap: any) => (
              <option key={snap.id} value={snap.id}>
                {format(new Date(snap.created_at), "MM-dd HH:mm")} — {snap.total_detected} issues, {snap.total_created} created
              </option>
            ))}
          </select>
          {selectedSnapshotId && (
            <Badge variant="secondary" className="text-[9px]">📸 Snapshot</Badge>
          )}
          {activeSnapshot?.scan_confidence_score != null && (
            <Badge variant={activeSnapshot.scan_confidence_score >= 70 ? "outline" : "destructive"} className="text-[9px]">
              🎯 Confidence: {activeSnapshot.scan_confidence_score}%
            </Badge>
          )}
        </div>

        {/* REGRESSION BANNER */}
        {regressions.length > 0 && (
          <div className="rounded-md border border-destructive bg-destructive/10 p-2">
            <p className="text-xs font-bold text-destructive mb-1">⚠ Regression detected</p>
            {regressions.slice(0, 5).map((r, idx) => (
              <p key={idx} className="text-[10px] text-foreground">
                • <strong>{r.target}</strong> — {r.reason === "increased_issues" ? "more issues than previous scan" : r.reason === "lost_coverage" ? "coverage dropped" : "scanner degraded (BLIND/DEAD)"}
              </p>
            ))}
          </div>
        )}
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

        {/* DEBUG CONSOLE */}
        {isSystemAdmin && (
        <Card>
          <CardHeader className="pb-2 cursor-pointer select-none" onClick={() => toggleSection("debugConsole")}>
            <CardTitle className="text-sm flex items-center gap-2">
              {expandedSections.debugConsole ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <Cpu className="h-4 w-4 text-primary" />
              Debug Console ({debugConsoleLogs.length})
            </CardTitle>
          </CardHeader>
          {expandedSections.debugConsole && (
            <CardContent className="pt-0">
              <div className="bg-muted/20 border border-border rounded-md p-2 max-h-[400px] overflow-y-auto font-mono text-[11px] space-y-0.5">
                {debugConsoleLogs.length === 0 && (
                  <p className="text-muted-foreground py-2">No logs in last 2h</p>
                )}
                {(debugConsoleLogs as any[]).map((log: any) => {
                  const time = new Date(log.ts).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
                  return (
                    <div key={log.id} className="flex gap-2 py-0.5 border-b border-border/30 last:border-0">
                      <span className="text-muted-foreground shrink-0">[{time}]</span>
                      <span className="text-primary shrink-0">{log.source}</span>
                      <span className="text-foreground break-all">{log.message}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          )}
        </Card>
        )}

        {/* INSERT RESULTS */}
        {isSystemAdmin && (
        <Card>
          <CardHeader className="pb-2 cursor-pointer select-none" onClick={() => toggleSection("insertResults")}>
            <CardTitle className="text-sm flex items-center gap-2">
              {expandedSections.insertResults ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <Activity className="h-4 w-4 text-primary" />
              Insert Results ({(scanResults?._create_trace ?? []).length})
            </CardTitle>
          </CardHeader>
          {expandedSections.insertResults && (
            <CardContent className="pt-0">
              <div className="max-h-[400px] overflow-y-auto space-y-1">
                {(scanResults?._create_trace ?? []).length === 0 && (
                  <p className="text-xs text-muted-foreground py-2">No insert trace available — run a scan first</p>
                )}
                {((scanResults?._create_trace ?? []) as any[]).slice(0, 50).map((t: any, i: number) => (
                  <div key={i} className="border border-border rounded p-2 bg-muted/10 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Badge variant={t._insert_success === true || t._create_decision === "created" ? "default" : t._create_decision === "skipped_dedup" ? "secondary" : "destructive"} className="text-[9px] shrink-0">
                        {t._insert_success === true || t._create_decision === "created" ? "✅ created" : t._create_decision === "skipped_dedup" ? "🔁 dedup" : t._create_decision === "skipped_validation" ? "❌ failed" : t._create_decision || "–"}
                      </Badge>
                      <span className="font-mono text-[10px] truncate text-foreground">{t.fingerprint?.slice(0, 30)}</span>
                    </div>
                    <p className="text-[10px] text-foreground truncate">{t.title}</p>
                    {(t._insert_error || t._validation_reason || t._dedup_reason) && (
                      <p className="font-mono text-[10px] text-destructive bg-destructive/10 rounded px-1 py-0.5 break-all">
                        {t._insert_error || t._validation_reason || t._dedup_reason}
                      </p>
                    )}
                    {t._suggested_fix_code && (
                      <p className="font-mono text-[10px] text-primary bg-primary/10 rounded px-1 py-0.5 break-all">
                        💡 [{t._suggested_fix_type}] {t._suggested_fix_code}
                      </p>
                    )}
                    {t._fix_confidence != null && (
                      <span className="text-[9px] text-muted-foreground">🎯 Fix confidence: {t._fix_confidence}/5</span>
                    )}
                    {t._source_file_path && (
                      <span className="text-[9px] text-muted-foreground font-mono">📁 Source File: {t._source_file_path}</span>
                    )}
                  </div>
                ))}
              </div>
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

        {/* TOP RUNTIME ERRORS */}
        <Card>
          <CardHeader className="pb-2 cursor-pointer select-none" onClick={() => toggleSection("runtimeErrors")}>
            <CardTitle className="text-sm flex items-center gap-2">
              {expandedSections.runtimeErrors ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Top Runtime Errors ({runtimeErrorClusters.length})
            </CardTitle>
          </CardHeader>
          {expandedSections.runtimeErrors && (
            <CardContent className="space-y-1 pt-0">
              {runtimeErrorClusters.length === 0 && (
                <p className="text-xs text-muted-foreground py-2">No runtime errors in last 24h ✅</p>
              )}
              {(runtimeErrorClusters as any[]).map((cluster: any, i: number) => (
                <div key={i} className="border border-border rounded p-2 bg-muted/10 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Badge variant="destructive" className="text-[9px] shrink-0">{cluster.count}×</Badge>
                      {cluster.source === "scan" && <Badge variant="outline" className="text-[8px] px-1 py-0 border-orange-500 text-orange-600">[SCAN ERROR]</Badge>}
                      <span className="font-mono text-xs truncate">{cluster.function_name}</span>
                    </div>
                    <span className="text-muted-foreground text-[9px] shrink-0">
                      {new Date(cluster.latest).toLocaleString("sv-SE", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  {cluster.endpoint && (
                    <p className="font-mono text-[10px] text-muted-foreground">{cluster.endpoint}</p>
                  )}
                  <p className="font-mono text-[10px] text-destructive bg-destructive/10 rounded px-1 py-0.5 break-all">{cluster.error_message.slice(0, 200)}</p>
                </div>
              ))}
            </CardContent>
          )}
        </Card>

        {/* RUNTIME ERRORS (individual) */}
        <Card>
          <CardHeader className="pb-2 cursor-pointer select-none" onClick={() => toggleSection("rawRuntimeErrors")}>
            <CardTitle className="text-sm flex items-center gap-2">
              {expandedSections.rawRuntimeErrors ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Runtime Errors ({rawRuntimeErrors.length})
            </CardTitle>
          </CardHeader>
          {expandedSections.rawRuntimeErrors && (
            <CardContent className="space-y-1 pt-0 max-h-[400px] overflow-y-auto">
              {rawRuntimeErrors.length === 0 && (
                <p className="text-xs text-muted-foreground py-2">No runtime errors in last 24h ✅</p>
              )}
              {(rawRuntimeErrors as any[]).map((err: any) => (
                <div key={err.id} className="border border-border rounded p-2 bg-muted/10 space-y-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] font-medium text-foreground">{err.function_name || "–"}</span>
                    {err.source === "scan" && <Badge variant="outline" className="text-[8px] px-1 py-0 border-orange-500 text-orange-600">[SCAN ERROR]</Badge>}
                    <span className="text-muted-foreground text-[9px] shrink-0">
                      {new Date(err.created_at).toLocaleString("sv-SE", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </span>
                  </div>
                  {err.endpoint && (
                    <p className="font-mono text-[10px] text-muted-foreground">{err.endpoint}</p>
                  )}
                  <p className="font-mono text-[10px] text-destructive bg-destructive/10 rounded px-1 py-0.5 break-all">{err.error_message || "No error message"}</p>
                  {err.request_trace_id && (
                    <p className="font-mono text-[9px] text-muted-foreground">trace: {err.request_trace_id.slice(0, 12)}…</p>
                  )}
                </div>
              ))}
            </CardContent>
          )}
        </Card>

        {/* FILE MAP */}
        <Card>
          <CardHeader className="pb-2 cursor-pointer select-none" onClick={() => toggleSection("fileMap")}>
            <CardTitle className="text-sm flex items-center gap-2">
              {expandedSections.fileMap ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <Folder className="h-4 w-4 text-primary" />
              File Map ({fileSystemMap.length} files) <span className="text-[9px] text-yellow-500/70 font-mono ml-2">⚠ Frontend scan (static / debug only)</span>
            </CardTitle>
          </CardHeader>
          {expandedSections.fileMap && (
            <CardContent className="pt-0 max-h-[500px] overflow-y-auto">
              {(() => {
                const tree: Record<string, FileEntry[]> = {};
                for (const f of fileSystemMap) {
                  if (!tree[f.folder]) tree[f.folder] = [];
                  tree[f.folder].push(f);
                }
                const folders = Object.keys(tree).sort();
                return (
                  <div className="space-y-1">
                    {folders.map((folder) => {
                      const files = tree[folder];
                      const folderKey = `fm_${folder}`;
                      const isOpen = expandedScanners[folderKey] ?? false;
                      const typeIcon = (t: FileEntry["type"]) => {
                        if (t === "component") return "🧩";
                        if (t === "page") return "📄";
                        if (t === "hook") return "🪝";
                        if (t === "lib") return "📚";
                        if (t === "store") return "🗄️";
                        if (t === "util") return "🔧";
                        if (t === "edge_function") return "⚡";
                        return "📦";
                      };
                      return (
                        <div key={folder} className="border border-border rounded-md">
                          <button
                            onClick={() => setExpandedScanners(prev => ({ ...prev, [folderKey]: !prev[folderKey] }))}
                            className="flex items-center gap-2 w-full text-left px-2 py-1.5 text-xs hover:bg-muted/50 transition-colors"
                          >
                            {isOpen ? <FolderOpen className="h-3 w-3 text-primary" /> : <Folder className="h-3 w-3 text-muted-foreground" />}
                            <span className="font-mono text-[10px] flex-1 truncate">{folder}</span>
                            <Badge variant="outline" className="text-[9px]">{files.length}</Badge>
                          </button>
                          {isOpen && (
                            <div className="px-2 pb-1.5 space-y-0.5 border-t border-border/50">
                              {files.map((f) => (
                                <div key={f.path} className="flex items-center gap-1.5 py-0.5 pl-4">
                                  <span className="text-[10px]">{typeIcon(f.type)}</span>
                                  <span className="font-mono text-[10px] text-foreground truncate">{f.path.split("/").pop()}</span>
                                  {f.used_in.length > 0 ? (
                                    <Badge variant="outline" className="text-[8px] px-1 py-0 ml-auto" title={f.used_in.join(", ")}>{f.used_in.length} refs</Badge>
                                  ) : (
                                    <Badge variant="destructive" className="text-[8px] px-1 py-0 ml-auto opacity-60">0 refs</Badge>
                                  )}
                                  <Badge variant="secondary" className="text-[8px] px-1 py-0">{f.type}</Badge>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
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
                                {scanner.silentFailure && (
                                  <Badge variant="destructive" className="text-[9px] px-1 py-0">⚠️ SILENT_FAILURE</Badge>
                                )}
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
                                            {issue._origin_source && <Badge variant="outline" className="text-[8px] px-1 py-0">{issue._origin_source === "ai_scan" ? "🤖" : issue._origin_source === "manual" ? "👤" : "🔧"} {issue._origin_source}</Badge>}
                                            {issue._impact_score && <Badge variant={issue._impact_label === "critical" ? "destructive" : "outline"} className="text-[8px] px-1 py-0">{issue._impact_label === "critical" ? "💥" : issue._impact_label === "high" ? "🔴" : issue._impact_label === "medium" ? "🟡" : "🟢"} impact:{issue._impact_score}/5</Badge>}
                                            {issue._occurrence_count > 1 && <Badge variant="outline" className="text-[8px] px-1 py-0 border-orange-500 text-orange-600">🔁 ×{issue._occurrence_count}</Badge>}
                                            {issue._status && <Badge variant={issue._status === "created" ? "default" : issue._status === "error" ? "destructive" : "secondary"} className="text-[8px] px-1 py-0">{issue._status === "created" ? "✅ created" : issue._status === "skipped_dedup" ? "🔁 skipped_dedup" : issue._status === "filtered" ? "🚫 filtered" : issue._status === "error" ? "❌ error" : issue._status}</Badge>}
                                          </div>
                                          {issue._flow_chain && (
                                            <div className="flex gap-1 flex-wrap mt-0.5">
                                              {[
                                                { key: "UI", ok: issue._flow_chain.has_ui },
                                                { key: "Action", ok: issue._flow_chain.has_action },
                                                { key: "Flow", ok: issue._flow_chain.has_flow },
                                                { key: "Data", ok: issue._flow_chain.has_data },
                                                { key: "DB", ok: issue._flow_chain.has_db },
                                              ].map((link: any) => (
                                                <span key={link.key} className={`text-[8px] px-1 py-0 rounded border ${link.ok ? "border-primary/30 text-primary" : "border-destructive/30 text-destructive"}`}>
                                                  {link.ok ? "✓" : "✗"} {link.key}
                                                </span>
                                              ))}
                                            </div>
                                           )}
                                           {issue.data_trace && (
                                             <div className="flex gap-1 flex-wrap mt-0.5">
                                               {[
                                                 { key: "Input", ok: issue.data_trace.input_detected },
                                                 { key: "Mapped", ok: issue.data_trace.mapped },
                                                 { key: "Transformed", ok: issue.data_trace.transformed },
                                                 { key: "Saved", ok: issue.data_trace.saved_to_db },
                                               ].map((step: any, idx: number, arr: any[]) => (
                                                 <React.Fragment key={step.key}>
                                                   <span className={`text-[8px] px-1 py-0 rounded border ${step.ok ? "border-primary/30 text-primary" : "border-destructive/30 text-destructive font-bold"}`}>
                                                     {step.ok ? "✅" : "❌"} {step.key}
                                                   </span>
                                                   {idx < arr.length - 1 && <span className="text-[8px] text-muted-foreground">→</span>}
                                                 </React.Fragment>
                                               ))}
                                             </div>
                                           )}
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
                        {(scanResults?.high_attention_areas ?? []).map((area: any, idx: number) => (
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
                <Badge variant="destructive" className="text-[10px]">{(scanResults?.high_attention_areas ?? []).length}</Badge>
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
                    {(scanResults?.high_attention_areas ?? []).map((area: any, idx: number) => (
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

        {/* ── SUSPICIOUS AREAS SECTION ── */}
        <Card>
          <CardHeader className="pb-2 cursor-pointer select-none" onClick={() => toggleSection("suspiciousAreas")}>
            <CardTitle className="text-sm flex items-center gap-2">
              {expandedSections.suspiciousAreas ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <Radar className="h-4 w-4 text-destructive" />
              Suspicious Areas
              {(scanResults?.suspicious_areas?.length || 0) > 0 && (
                <Badge variant="destructive" className="text-[10px]">{(scanResults?.suspicious_areas ?? []).length}</Badge>
              )}
              <Badge variant="outline" className="text-[10px]">READ-ONLY</Badge>
            </CardTitle>
          </CardHeader>
          {expandedSections.suspiciousAreas && (
            <CardContent>
              {scanResults?.suspicious_areas?.length > 0 ? (
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
                      {(scanResults?.suspicious_areas ?? []).map((area: any, idx: number) => (
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
                <p className="text-sm text-muted-foreground">Inga misstänkta områden identifierade.</p>
              )}
            </CardContent>
          )}
        </Card>

        {/* ── ISSUE CLUSTERS SECTION ── */}
        <Card>
          <CardHeader className="pb-2 cursor-pointer select-none" onClick={() => toggleSection("issueClusters")}>
            <CardTitle className="text-sm flex items-center gap-2">
              {expandedSections.issueClusters ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <Folder className="h-4 w-4 text-muted-foreground" />
              Issue Clusters
              {issueClusters.length > 0 && (
                <Badge variant="secondary" className="text-[10px]">{issueClusters.length}</Badge>
              )}
              <Badge variant="outline" className="text-[10px]">READ-ONLY</Badge>
            </CardTitle>
            <p className="text-[10px] text-muted-foreground mt-1">Issues grouped by affected area — find one root problem causing many issues</p>
          </CardHeader>
          {expandedSections.issueClusters && (
            <CardContent>
              {issueClusters.length > 0 ? (
                <div className="space-y-2">
                  {issueClusters.map((cluster) => (
                    <div key={cluster.cluster_id} className="border border-border rounded-md p-2 bg-muted/20">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-mono text-xs font-medium text-foreground">{cluster.target}</span>
                        <Badge variant={cluster.cluster_size >= 5 ? "destructive" : cluster.cluster_size >= 3 ? "secondary" : "outline"} className="text-[10px]">
                          {cluster.cluster_size} issues
                        </Badge>
                        <Badge variant="outline" className="text-[9px]">{cluster.type}</Badge>
                        <span className="text-[9px] text-muted-foreground">id: {cluster.cluster_id}</span>
                      </div>
                      {cluster.cluster_size >= 3 && (
                        <p className="text-[9px] text-destructive">⚠️ Potential root cause — {cluster.cluster_size} issues clustered here</p>
                      )}
                      <div className="mt-1 space-y-0.5 max-h-24 overflow-y-auto">
                        {cluster.issues.slice(0, 5).map((issue: any, idx: number) => (
                          <p key={idx} className="text-[9px] text-muted-foreground truncate">• {issue.title || issue.description || issue.issue || "unnamed"}</p>
                        ))}
                        {cluster.issues.length > 5 && (
                          <p className="text-[9px] text-muted-foreground">…and {cluster.issues.length - 5} more</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Inga issue-kluster identifierade.</p>
              )}
            </CardContent>
          )}
        </Card>

        {/* ── SYSTEM DIAGNOSIS SECTION ── */}
        <Card>
          <CardHeader className="pb-2 cursor-pointer select-none" onClick={() => toggleSection("systemDiagnosis")}>
            <CardTitle className="text-sm flex items-center gap-2">
              {expandedSections.systemDiagnosis ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <Activity className="h-4 w-4 text-destructive" />
              System Diagnosis
              <Badge variant="outline" className="text-[10px]">READ-ONLY</Badge>
            </CardTitle>
            <p className="text-[10px] text-muted-foreground mt-1">One screen — what to fix right now</p>
          </CardHeader>
          {expandedSections.systemDiagnosis && (
            <CardContent className="space-y-3 pt-0">
              {/* DIAGNOSIS SUMMARY from snapshot */}
              {(() => {
                const summary = activeSnapshot?.diagnosis_summary as string | null | undefined;
                if (!summary) return null;
                return (
                  <div className="rounded-md border border-muted bg-muted/30 p-2 mb-2">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="text-xs font-bold text-foreground">📋 Diagnosis Summary</h4>
                      {(activeSnapshot?.coverage_total != null || activeSnapshot?.coverage_unique_targets != null) && (
                        <Badge variant="outline" className="text-[10px]">
                          Coverage: {activeSnapshot.coverage_unique_targets ?? "?"} targets / {activeSnapshot.coverage_total ?? "?"} total
                        </Badge>
                      )}
                    </div>
                    {summary.split("\n").map((line, idx) => (
                      <p key={idx} className="text-[10px] text-foreground leading-relaxed">{line}</p>
                    ))}
                  </div>
                );
              })()}
              {/* 1. CRITICAL ISSUES */}
              {(() => {
                const criticalIssues = priorityItems.filter((i: any) => i._sort_impact >= 5).slice(0, 10);
                return criticalIssues.length > 0 ? (
                  <div>
                    <h4 className="text-xs font-bold text-destructive mb-1">💥 Critical Issues (impact 5/5)</h4>
                    <ul className="space-y-0.5">
                      {criticalIssues.map((item: any, idx: number) => (
                        <li key={idx} className="text-[10px] text-foreground flex items-start gap-1">
                          <span className="text-destructive">•</span>
                          <span className="truncate">{item.title || item.description || item.issue || "unnamed"}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : <p className="text-[10px] text-muted-foreground">✅ Inga kritiska issues (impact 5)</p>;
              })()}

              {/* 2. TOP CLUSTERS */}
              {(() => {
                const topClusters = issueClusters.filter(c => c.cluster_size >= 2).slice(0, 10);
                return topClusters.length > 0 ? (
                  <div>
                    <h4 className="text-xs font-bold text-foreground mb-1">📦 Top Clusters</h4>
                    <ul className="space-y-0.5">
                      {topClusters.map((c, idx) => (
                        <li key={idx} className="text-[10px] text-foreground flex items-start gap-1">
                          <span className="text-muted-foreground">•</span>
                          <span>{c.target} — <strong>{c.cluster_size}</strong> issues</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : <p className="text-[10px] text-muted-foreground">✅ Inga issue-kluster</p>;
              })()}

              {/* 3. DEAD SCANNERS */}
              {(() => {
                const dead = groupedScannerStats.flatMap(g => g.scanners.filter((s: any) => s.health === "DEAD")).slice(0, 10);
                return dead.length > 0 ? (
                  <div>
                    <h4 className="text-xs font-bold text-destructive mb-1">💀 Dead Scanners</h4>
                    <ul className="space-y-0.5">
                      {dead.map((s: any, idx: number) => (
                        <li key={idx} className="text-[10px] text-foreground flex items-start gap-1">
                          <span className="text-destructive">•</span>
                          <span>{s.label}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : <p className="text-[10px] text-muted-foreground">✅ Inga döda scanners</p>;
              })()}

              {/* 4. BLIND SCANNERS */}
              {(() => {
                const blind = groupedScannerStats.flatMap(g => g.scanners.filter((s: any) => s.health === "BLIND")).slice(0, 10);
                return blind.length > 0 ? (
                  <div>
                    <h4 className="text-xs font-bold text-foreground mb-1">👁️ Blind Scanners</h4>
                    <ul className="space-y-0.5">
                      {blind.map((s: any, idx: number) => (
                        <li key={idx} className="text-[10px] text-foreground flex items-start gap-1">
                          <span className="text-muted-foreground">•</span>
                          <span>{s.label} — scope: {s.scanScope?.size ?? "?"}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : <p className="text-[10px] text-muted-foreground">✅ Inga blinda scanners</p>;
              })()}

              {/* 5. DEDUP_BLOCKED AREAS */}
              {(() => {
                const blocked = groupedScannerStats.flatMap(g => g.scanners.filter((s: any) => s.health === "DEDUP_BLOCKED")).slice(0, 10);
                return blocked.length > 0 ? (
                  <div>
                    <h4 className="text-xs font-bold text-foreground mb-1">🔒 Dedup Blocked</h4>
                    <ul className="space-y-0.5">
                      {blocked.map((s: any, idx: number) => (
                        <li key={idx} className="text-[10px] text-foreground flex items-start gap-1">
                          <span className="text-muted-foreground">•</span>
                          <span>{s.label} — {s.detected} detected, 0 created</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : <p className="text-[10px] text-muted-foreground">✅ Inga dedup-blockerade</p>;
              })()}

              {/* 6. UNSCANNED AREAS */}
              {(() => {
                const top = unscannedAreas.slice(0, 10);
                return top.length > 0 ? (
                  <div>
                    <h4 className="text-xs font-bold text-foreground mb-1">🕳️ Unscanned Areas</h4>
                    <ul className="space-y-0.5">
                      {top.map((entry: any, idx: number) => (
                        <li key={idx} className="text-[10px] text-foreground flex items-start gap-1">
                          <span className="text-muted-foreground">•</span>
                          <span>{entry.entity_name} <span className="text-muted-foreground">({entry.entity_type})</span></span>
                        </li>
                      ))}
                      {unscannedAreas.length > 10 && <li className="text-[9px] text-muted-foreground">…och {unscannedAreas.length - 10} till</li>}
                    </ul>
                  </div>
                ) : <p className="text-[10px] text-muted-foreground">✅ Allt skannat</p>;
              })()}

              {/* 7. MISSING REQUIRED SYSTEM PARTS */}
              {(() => {
                return missingExpectations.length > 0 ? (
                  <div>
                    <h4 className="text-xs font-bold text-destructive mb-1">🚨 Missing Required System Parts</h4>
                    <ul className="space-y-0.5">
                      {missingExpectations.slice(0, 10).map((exp: any, idx: number) => (
                        <li key={idx} className="text-[10px] text-foreground flex items-start gap-1">
                          <span className="text-destructive">•</span>
                          <span><strong>{exp.entity_name}</strong> <span className="text-muted-foreground">({exp.entity_type})</span> — impact 5/5</span>
                        </li>
                      ))}
                      {missingExpectations.length > 10 && <li className="text-[9px] text-muted-foreground">…och {missingExpectations.length - 10} till</li>}
                    </ul>
                  </div>
                ) : <p className="text-[10px] text-muted-foreground">✅ Alla förväntade systemdelar hittade</p>;
              })()}
            </CardContent>
          )}
        </Card>

        {/* ── EXPECTED VS ACTUAL SECTION ── */}
        <Card>
          <CardHeader className="pb-2 cursor-pointer select-none" onClick={() => toggleSection("expectedVsActual")}>
            <CardTitle className="text-sm flex items-center gap-2">
              {expandedSections.expectedVsActual ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <CheckCircle className="h-4 w-4 text-primary" />
              Expected vs Actual
              {missingExpectations.length > 0 && (
                <Badge variant="destructive" className="text-[10px]">{missingExpectations.length} missing</Badge>
              )}
              <Badge variant="outline" className="text-[10px]">READ-ONLY</Badge>
            </CardTitle>
            <p className="text-[10px] text-muted-foreground mt-1">Sanity check — required system parts vs what exists</p>
          </CardHeader>
          {expandedSections.expectedVsActual && (
            <CardContent className="pt-0">
              <div className="space-y-2">
                {(["route", "flow", "data", "component"] as const).map((type) => {
                  const items = systemExpectations.filter((e: any) => e.entity_type === type);
                  if (items.length === 0) return null;
                  return (
                    <div key={type}>
                      <h4 className="text-[10px] font-bold text-muted-foreground uppercase mb-0.5">{type}s</h4>
                      <ul className="space-y-0.5">
                        {items.map((exp: any, idx: number) => {
                          const found = structureMap.some((s: any) => s.entity_type === exp.entity_type && s.entity_name === exp.entity_name);
                          return (
                            <li key={idx} className="text-[10px] text-foreground flex items-center gap-1.5">
                              <span className={found ? "text-green-600" : "text-destructive"}>{found ? "✅" : "❌"}</span>
                              <span className={!found ? "font-medium text-destructive" : ""}>{exp.entity_name}</span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                })}
                {systemExpectations.length === 0 && (
                  <p className="text-[10px] text-muted-foreground">No expectations configured</p>
                )}
              </div>
            </CardContent>
          )}
        </Card>

        {/* ── PRIORITY VIEW SECTION ── */}
        <Card>
          <CardHeader className="pb-2 cursor-pointer select-none" onClick={() => toggleSection("priorityView")}>
            <CardTitle className="text-sm flex items-center gap-2">
              {expandedSections.priorityView ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Priority
              {priorityItems.length > 0 && (
                <Badge variant="destructive" className="text-[10px]">Top {priorityItems.length}</Badge>
              )}
              <Badge variant="outline" className="text-[10px]">READ-ONLY</Badge>
            </CardTitle>
            <p className="text-[10px] text-muted-foreground mt-1">Top 10 most critical problems — sorted by impact, cluster size, occurrence</p>
          </CardHeader>
          {expandedSections.priorityView && (
            <CardContent>
              {priorityItems.length > 0 ? (
                <div className="space-y-1.5">
                  {priorityItems.map((item: any, idx: number) => (
                    <div key={idx} className="border border-border rounded-md p-2 bg-muted/20 flex flex-col gap-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-bold text-foreground">#{idx + 1}</span>
                        <span className="text-xs text-foreground truncate max-w-[200px]">{item.title || item.description || item.issue || "unnamed"}</span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge variant={item._sort_impact >= 4 ? "destructive" : item._sort_impact >= 3 ? "secondary" : "outline"} className="text-[9px]">
                          {item._sort_impact >= 5 ? "💥" : item._sort_impact >= 4 ? "🔴" : item._sort_impact >= 3 ? "🟡" : "🟢"} impact:{item._sort_impact}/5
                        </Badge>
                        <Badge variant={item._sort_cluster >= 5 ? "destructive" : "outline"} className="text-[9px]">
                          📦 cluster:{item._sort_cluster}
                        </Badge>
                        <Badge variant={item._sort_occurrence > 2 ? "destructive" : "outline"} className="text-[9px]">
                          🔁 ×{item._sort_occurrence}
                        </Badge>
                        {item._impact_label && (
                          <Badge variant="outline" className="text-[8px]">{item._impact_label}</Badge>
                        )}
                        <span className="text-[8px] text-muted-foreground">area: {item._cluster_target}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Inga prioriterade problem identifierade.</p>
              )}
            </CardContent>
          )}
        </Card>

        {/* ── UNSCANNED AREAS SECTION ── */}
        <Card>
          <CardHeader className="pb-2 cursor-pointer select-none" onClick={() => toggleSection("unscannedAreas")}>
            <CardTitle className="text-sm flex items-center gap-2">
              {expandedSections.unscannedAreas ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <Eye className="h-4 w-4 text-muted-foreground" />
              Unscanned Areas
              {unscannedAreas.length > 0 && (
                <Badge variant="secondary" className="text-[10px]">{unscannedAreas.length}</Badge>
              )}
              <Badge variant="outline" className="text-[10px]">READ-ONLY</Badge>
            </CardTitle>
          </CardHeader>
          {expandedSections.unscannedAreas && (
            <CardContent>
              {unscannedAreas.length > 0 ? (
                <div className="space-y-3">
                  {(["component", "route", "data", "flow"] as const).map((type) => {
                    const items = unscannedByType[type] || [];
                    if (items.length === 0) return null;
                    const typeLabels: Record<string, string> = { component: "🖥️ Components", route: "🔗 Routes", data: "🗄️ Data", flow: "🔀 Flows" };
                    return (
                      <div key={type}>
                        <p className="text-xs font-medium text-muted-foreground mb-1">{typeLabels[type] || type} ({items.length})</p>
                        <div className="border rounded-md overflow-hidden">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b bg-muted/50">
                                <th className="text-left p-2 font-medium text-muted-foreground">Entity</th>
                                <th className="text-left p-2 font-medium text-muted-foreground">Last Seen</th>
                                <th className="text-left p-2 font-medium text-muted-foreground">Scans</th>
                              </tr>
                            </thead>
                            <tbody>
                              {items.map((entry: any, idx: number) => (
                                <tr key={idx} className="border-b last:border-b-0">
                                  <td className="p-2 font-mono text-foreground">{entry.entity_name}</td>
                                  <td className="p-2 text-muted-foreground">{entry.last_seen_at ? format(new Date(entry.last_seen_at), "yyyy-MM-dd HH:mm") : "—"}</td>
                                  <td className="p-2 text-muted-foreground">{entry.scan_count}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Alla kända entiteter täcks av skanningar.</p>
              )}
            </CardContent>
          )}
        </Card>

        {/* ── NO ISSUES DETECTED (LOW SIGNAL) SECTION ── */}
        <Card>
          <CardHeader className="pb-2 cursor-pointer select-none" onClick={() => toggleSection("noIssueAreas")}>
            <CardTitle className="text-sm flex items-center gap-2">
              {expandedSections.noIssueAreas ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <Radar className="h-4 w-4 text-muted-foreground" />
              No Issues Detected (Low Signal)
              {noIssueEntities.length > 0 && (
                <Badge variant="destructive" className="text-[10px]">{noIssueEntities.length}</Badge>
              )}
              <Badge variant="outline" className="text-[10px]">READ-ONLY</Badge>
            </CardTitle>
            <p className="text-[10px] text-muted-foreground mt-1">Entities scanned but never flagged — possible fake clean areas or broken scanners</p>
          </CardHeader>
          {expandedSections.noIssueAreas && (
            <CardContent>
              {noIssueEntities.length > 0 ? (
                <div className="space-y-3">
                  {(["component", "route", "data", "flow"] as const).map((type) => {
                    const items = noIssueByType[type] || [];
                    if (items.length === 0) return null;
                    const typeLabels: Record<string, string> = { component: "🖥️ Components", route: "🔗 Routes", data: "🗄️ Data", flow: "🔀 Flows" };
                    return (
                      <div key={type}>
                        <p className="text-xs font-medium text-muted-foreground mb-1">{typeLabels[type] || type} ({items.length})</p>
                        <div className="border rounded-md overflow-hidden">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b bg-muted/50">
                                <th className="text-left p-2 font-medium text-muted-foreground">Entity</th>
                                <th className="text-left p-2 font-medium text-muted-foreground">Last Seen</th>
                                <th className="text-left p-2 font-medium text-muted-foreground">Scans</th>
                                <th className="text-left p-2 font-medium text-muted-foreground">Flag</th>
                              </tr>
                            </thead>
                            <tbody>
                              {items.map((entry: any, idx: number) => (
                                <tr key={idx} className="border-b last:border-b-0">
                                  <td className="p-2 font-mono text-foreground">{entry.entity_name}</td>
                                  <td className="p-2 text-muted-foreground">{entry.last_seen_at ? format(new Date(entry.last_seen_at), "yyyy-MM-dd HH:mm") : "—"}</td>
                                  <td className="p-2 text-muted-foreground">{entry.scan_count}</td>
                                  <td className="p-2"><Badge variant="outline" className="text-[9px] border-destructive text-destructive">no_issues_detected</Badge></td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Alla entiteter har registrerade issues — inga misstänkta luckor.</p>
              )}
            </CardContent>
          )}
        </Card>

        {/* ── ORPHAN ELEMENTS SECTION ── */}
        <Card>
          <CardHeader className="pb-2 cursor-pointer select-none" onClick={() => toggleSection("orphanElements")}>
            <CardTitle className="text-sm flex items-center gap-2">
              {expandedSections.orphanElements ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <Layers className="h-4 w-4 text-muted-foreground" />
              Orphan Elements
              {orphanEntities.length > 0 && (
                <Badge variant="destructive" className="text-[10px]">{orphanEntities.length}</Badge>
              )}
              <Badge variant="outline" className="text-[10px]">READ-ONLY</Badge>
            </CardTitle>
            <p className="text-[10px] text-muted-foreground mt-1">Dead components, unused routes, broken architecture — no flow, no issues, no work items</p>
          </CardHeader>
          {expandedSections.orphanElements && (
            <CardContent>
              {orphanEntities.length > 0 ? (
                <div className="space-y-3">
                  {(["component", "route", "data"] as const).map((type) => {
                    const items = orphanByType[type] || [];
                    if (items.length === 0) return null;
                    const typeLabels: Record<string, string> = { component: "🖥️ Components", route: "🔗 Routes", data: "🗄️ Data" };
                    return (
                      <div key={type}>
                        <p className="text-xs font-medium text-muted-foreground mb-1">{typeLabels[type] || type} ({items.length})</p>
                        <div className="border rounded-md overflow-hidden">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b bg-muted/50">
                                <th className="text-left p-2 font-medium text-muted-foreground">Entity</th>
                                <th className="text-left p-2 font-medium text-muted-foreground">Last Seen</th>
                                <th className="text-left p-2 font-medium text-muted-foreground">Flag</th>
                              </tr>
                            </thead>
                            <tbody>
                              {items.map((entry: any, idx: number) => (
                                <tr key={idx} className="border-b last:border-b-0">
                                  <td className="p-2 font-mono text-foreground">{entry.entity_name}</td>
                                  <td className="p-2 text-muted-foreground">{entry.last_seen_at ? format(new Date(entry.last_seen_at), "yyyy-MM-dd HH:mm") : "—"}</td>
                                  <td className="p-2"><Badge variant="outline" className="text-[9px] border-destructive text-destructive">orphan</Badge></td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Inga orphan-element hittades — alla entiteter har kopplingar.</p>
              )}
            </CardContent>
          )}
        </Card>

        {/* ── ORPHAN FILES (from File Map) ── */}
        <Card>
          <CardHeader className="pb-2 cursor-pointer select-none" onClick={() => toggleSection("orphanFiles")}>
            <CardTitle className="text-sm flex items-center gap-2">
              {expandedSections.orphanFiles ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <FileText className="h-4 w-4 text-destructive" />
              Orphan Files (0 imports)
              {orphanFiles.length > 0 && (
                <Badge variant="destructive" className="text-[10px]">{orphanFiles.length}</Badge>
              )}
              <Badge variant="outline" className="text-[10px]">improvement</Badge>
            </CardTitle>
            <p className="text-[10px] text-muted-foreground mt-1">Files with zero imports — not used anywhere. Pages & edge functions excluded (entry points).</p>
          </CardHeader>
          {expandedSections.orphanFiles && (
            <CardContent className="pt-0 max-h-[400px] overflow-y-auto">
              {orphanFiles.length > 0 ? (
                <div className="space-y-1">
                  {orphanFiles.map((f) => (
                    <div key={f.path} className="flex items-center gap-2 py-1 px-2 rounded-md bg-muted/30 border border-border">
                      <Badge variant="destructive" className="text-[8px] px-1 py-0">orphan</Badge>
                      <span className="font-mono text-[10px] text-foreground truncate flex-1">{f.path}</span>
                      <Badge variant="secondary" className="text-[8px] px-1 py-0">{f.type}</Badge>
                      <span className="text-[9px] text-muted-foreground">Fix confidence: 2/5</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Inga orphan-filer — alla filer importeras någonstans.</p>
              )}
            </CardContent>
          )}
        </Card>

        {/* ── STRUCTURE SANITY ── */}
        <Card>
          <CardHeader className="pb-2 cursor-pointer select-none" onClick={() => toggleSection("structureSanity")}>
            <CardTitle className="text-sm flex items-center gap-2">
              {expandedSections.structureSanity ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <Layers className="h-4 w-4 text-orange-500" />
              Structure Sanity
              {structureIssues.length > 0 && (
                <Badge variant="destructive" className="text-[10px]">{structureIssues.length}</Badge>
              )}
              <Badge variant="outline" className="text-[10px]">improvement</Badge>
            </CardTitle>
            <p className="text-[10px] text-muted-foreground mt-1">Misplaced components, pages in wrong folders, logic in UI layer</p>
          </CardHeader>
          {expandedSections.structureSanity && (
            <CardContent className="pt-0 max-h-[400px] overflow-y-auto">
              {structureIssues.length > 0 ? (
                <div className="space-y-1">
                  {structureIssues.map((si, idx) => (
                    <div key={idx} className="flex items-center gap-2 py-1 px-2 rounded-md bg-muted/30 border border-border">
                      <Badge variant="outline" className="text-[8px] px-1 py-0 border-orange-500 text-orange-500">{si.issue_type}</Badge>
                      <span className="font-mono text-[10px] text-foreground truncate flex-1">{si.path}</span>
                      <span className="text-[9px] text-muted-foreground whitespace-nowrap">{si.issue}</span>
                      <span className="text-[9px] text-muted-foreground whitespace-nowrap">Fix confidence: {si.fix_confidence}/5</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Inga strukturproblem — alla filer är korrekt placerade.</p>
              )}
            </CardContent>
          )}
        </Card>
        </>
        )}
      </div>
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
                <span className="text-muted-foreground text-xs">Origin Source</span>
                <p>
                  <Badge variant="outline" className="text-[10px]">
                    {selectedItem.source_type === "scan" || selectedItem.source_type === "ai_scan" || selectedItem.source_type === "ai_detection"
                      ? "🤖 ai_scan"
                      : selectedItem.source_type === "manual"
                      ? "👤 manual"
                      : selectedItem.source_type === "lovable_build" || selectedItem.source_type === "system"
                      ? "🔧 lovable_build"
                      : `📦 ${selectedItem.source_type ?? "unknown"}`}
                  </Badge>
                </p>
              </div>
              {/* Occurrence Tracking */}
              <div className="border border-border rounded-md p-2 bg-muted/30 space-y-1">
                <span className="text-muted-foreground text-xs font-medium">Occurrence Tracking</span>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={(selectedItem as any).occurrence_count > 2 ? "destructive" : "outline"} className="text-[10px]">
                    🔁 ×{(selectedItem as any).occurrence_count ?? 1}
                  </Badge>
                  {(selectedItem as any).first_seen_at && (
                    <span className="text-[10px] text-muted-foreground">First: {format(new Date((selectedItem as any).first_seen_at), "yyyy-MM-dd HH:mm")}</span>
                  )}
                  {(selectedItem as any).last_seen_at && (
                    <span className="text-[10px] text-muted-foreground">Last: {format(new Date((selectedItem as any).last_seen_at), "yyyy-MM-dd HH:mm")}</span>
                  )}
                </div>
                {(selectedItem as any).occurrence_count > 2 && (
                  <p className="text-[9px] text-destructive">⚠️ Persistent problem — seen {(selectedItem as any).occurrence_count} times</p>
                )}
              </div>
              {/* Pipeline Trace */}
              {(() => {
                const traces = (scanResults?._create_trace ?? []) as any[];
                const fp = selectedItem.issue_fingerprint;
                const titleMatch = selectedItem.title;
                const trace = traces.find((t: any) => t.fingerprint === fp || t.title === titleMatch);
                
                const scanOk = true; // always detected by scan
                const filterOk = trace ? trace._create_decision !== "skipped_filter" : null;
                const filterReason = trace?._filter_reason || trace?._validation_reason || null;
                const dedupOk = trace ? trace._create_decision !== "skipped_dedup" : null;
                const dedupReason = trace?._dedup_reason || null;
                const createOk = trace ? (trace._create_decision === "created" && trace._insert_success === true) : null;
                const createError = trace?._insert_error || null;
                
                const step = (label: string, ok: boolean | null) => {
                  if (ok === null) return `${label} —`;
                  return ok ? `${label} ✓` : `${label} ✗`;
                };

                return (
                  <div className="border border-border rounded-md p-2 bg-muted/30 space-y-1">
                    <span className="text-muted-foreground text-xs font-medium">Pipeline Trace</span>
                    <div className="flex items-center gap-1 text-[10px] font-mono flex-wrap">
                      <span className="text-green-500">{step("SCAN", scanOk)}</span>
                      <span className="text-muted-foreground">→</span>
                      <span className={filterOk === false ? "text-destructive" : filterOk === true ? "text-green-500" : "text-muted-foreground"}>{step("FILTER", filterOk)}</span>
                      <span className="text-muted-foreground">→</span>
                      <span className={dedupOk === false ? "text-destructive" : dedupOk === true ? "text-green-500" : "text-muted-foreground"}>{step("DEDUP", dedupOk)}</span>
                      <span className="text-muted-foreground">→</span>
                      <span className={createOk === false ? "text-destructive" : createOk === true ? "text-green-500" : "text-muted-foreground"}>{step("CREATE", createOk)}</span>
                    </div>
                    {filterReason && (
                      <p className="text-[9px] text-destructive">Filter: {filterReason}</p>
                    )}
                    {dedupReason && (
                      <p className="text-[9px] text-destructive">Dedup: {dedupReason}</p>
                    )}
                    {createError && (
                      <p className="text-[9px] text-destructive">Error: {createError}</p>
                    )}
                    {!trace && (
                      <p className="text-[9px] text-muted-foreground">No trace found — run a scan to populate</p>
                    )}
                  </div>
                );
              })()}
              {/* Full Trace Chain */}
              {(() => {
                const traces = (scanResults?._create_trace ?? []) as any[];
                const fp = selectedItem.issue_fingerprint;
                const titleMatch = selectedItem.title;
                const trace = traces.find((t: any) => t.fingerprint === fp || t.title === titleMatch);

                const s = (ok: boolean | null) => ok === null ? "—" : ok ? "✓" : "✗";
                const c = (ok: boolean | null) => ok === null ? "text-muted-foreground" : ok ? "text-green-500" : "text-destructive";

                const uiOk = true;
                const uiTraceId = trace?.request_trace_id || (selectedItem as any).source_id || null;
                const uiTrigger = (selectedItem as any).source_type || "unknown";

                const apiOk = trace ? !!trace.endpoint || !!trace.function_name : null;
                const apiEndpoint = trace?.endpoint || trace?.function_name || null;

                const runtimeOk = trace?.runtime_trace ? !trace.runtime_trace.error : trace?._insert_success != null ? true : null;
                const runtimeMsg = trace?.runtime_trace?.error || trace?.runtime_trace?.message || null;

                const dbOk = trace?._insert_success ?? null;
                const dbError = trace?._insert_error || null;

                const resultStatus = trace?._create_decision || (selectedItem.status === "open" ? "created" : selectedItem.status);
                const resultOk = resultStatus === "created";

                return (
                  <div className="border border-border rounded-md p-2 bg-muted/30 space-y-2">
                    <span className="text-muted-foreground text-xs font-medium">Full Trace Chain</span>
                    <div className="space-y-1">
                      {/* STEP 1: UI ACTION */}
                      <div className="flex items-start gap-2 text-[10px] font-mono">
                        <div className="flex flex-col items-center">
                          <span className={`font-bold ${c(uiOk)}`}>{s(uiOk)}</span>
                          <div className="w-px h-3 bg-border" />
                        </div>
                        <div>
                          <div className="font-semibold text-foreground">STEP 1: UI ACTION</div>
                          <div className="text-muted-foreground">trace_id: <span className="text-foreground">{uiTraceId || "–"}</span></div>
                          <div className="text-muted-foreground">trigger: <span className="text-foreground">{uiTrigger}</span></div>
                        </div>
                      </div>
                      {/* STEP 2: API CALL */}
                      <div className="flex items-start gap-2 text-[10px] font-mono">
                        <div className="flex flex-col items-center">
                          <span className={`font-bold ${c(apiOk)}`}>{s(apiOk)}</span>
                          <div className="w-px h-3 bg-border" />
                        </div>
                        <div>
                          <div className="font-semibold text-foreground">STEP 2: API CALL</div>
                          <div className="text-muted-foreground">endpoint: <span className="text-foreground">{apiEndpoint || "–"}</span></div>
                        </div>
                      </div>
                      {/* STEP 3: BACKEND */}
                      <div className="flex items-start gap-2 text-[10px] font-mono">
                        <div className="flex flex-col items-center">
                          <span className={`font-bold ${c(runtimeOk)}`}>{s(runtimeOk)}</span>
                          <div className="w-px h-3 bg-border" />
                        </div>
                        <div>
                          <div className="font-semibold text-foreground">STEP 3: FUNCTION</div>
                          <div className="text-muted-foreground">runtime: <span className={runtimeMsg ? "text-destructive" : "text-foreground"}>{runtimeMsg || (runtimeOk ? "success" : "–")}</span></div>
                        </div>
                      </div>
                      {/* STEP 4: DATABASE */}
                      <div className="flex items-start gap-2 text-[10px] font-mono">
                        <div className="flex flex-col items-center">
                          <span className={`font-bold ${c(dbOk)}`}>{s(dbOk)}</span>
                          <div className="w-px h-3 bg-border" />
                        </div>
                        <div>
                          <div className="font-semibold text-foreground">STEP 4: DATABASE</div>
                          <div className="text-muted-foreground">insert: <span className={dbError ? "text-destructive" : "text-foreground"}>{dbError || (dbOk ? "success" : "–")}</span></div>
                        </div>
                      </div>
                      {/* STEP 5: RESULT */}
                      <div className="flex items-start gap-2 text-[10px] font-mono">
                        <div className="flex flex-col items-center">
                          <span className={`font-bold ${c(resultOk)}`}>{s(resultOk)}</span>
                        </div>
                        <div>
                          <div className="font-semibold text-foreground">STEP 5: RESULT</div>
                          <div className="text-muted-foreground">status: <Badge variant={resultOk ? "default" : resultStatus === "skipped_dedup" ? "secondary" : "destructive"} className="text-[8px] px-1 py-0">{resultStatus}</Badge></div>
                        </div>
                      </div>
                    </div>
                    {!trace && (
                      <p className="text-[9px] text-muted-foreground italic">No trace data — run a scan to populate chain</p>
                    )}
                  </div>
                );
              })()}
              {noEffectFixIds.has(selectedItem.id) && (
                <div className="border border-destructive rounded-md p-2 bg-destructive/10 space-y-1">
                  <span className="text-destructive text-xs font-bold flex items-center gap-1">⚠️ no_effect_fix</span>
                  <p className="text-[9px] text-destructive/80">This item was marked as done, but the same issue reappeared within the last 2 scans. The fix may not have worked, or the assumption was wrong.</p>
                </div>
              )}
              {/* Fix Verification Status */}
              {selectedItem.status === "done" && (
                <div className="border border-border rounded-md p-2 bg-muted/30 space-y-1">
                  <span className="text-muted-foreground text-xs font-medium">Fix Verification</span>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge
                      variant={(selectedItem as any).verification_status === "confirmed" ? "default" : (selectedItem as any).verification_status === "failed" ? "destructive" : "outline"}
                      className="text-[10px]"
                    >
                      {(selectedItem as any).verification_status === "confirmed" ? "✅ Confirmed" : (selectedItem as any).verification_status === "failed" ? "❌ Failed" : (selectedItem as any).verification_status === "pending" ? "⏳ Pending" : "❓ Unknown"}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">
                      Scans checked: {(selectedItem as any).verification_scans_checked ?? 0}/2
                    </span>
                    {(selectedItem as any).verified_at && (
                      <span className="text-[10px] text-muted-foreground">
                        Verified: {format(new Date((selectedItem as any).verified_at), "yyyy-MM-dd HH:mm")}
                      </span>
                    )}
                  </div>
                  {(selectedItem as any).verification_status === "failed" && (
                    <p className="text-[9px] text-destructive">⚠️ Issue reappeared after fix — may need re-investigation</p>
                  )}
                </div>
              )}
              {/* Mark as Fixed + Verification Re-scan */}
              {selectedItem.status !== "done" && selectedItem.status !== "cancelled" && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-[10px] h-7"
                  disabled={verifyingFix}
                  onClick={async () => {
                    setVerifyingFix(true);
                    setVerifyResult(null);
                    try {
                      // 1. Mark as done
                      await supabase.from("work_items" as any).update({
                        status: "done",
                        completed_at: new Date().toISOString(),
                      }).eq("id", selectedItem.id);

                      // 2. Run partial scan targeting affected area
                      const meta = (selectedItem as any).metadata ? (typeof (selectedItem as any).metadata === "string" ? JSON.parse((selectedItem as any).metadata) : (selectedItem as any).metadata) : {};
                      const target = meta?.affected_area?.target || (selectedItem as any).source_component || (selectedItem as any).source_path || selectedItem.item_type;

                      const verifyRes = await safeInvoke("run-full-scan", {
                        action: "start", scan_mode: "targeted", target_area: target, verification_for: selectedItem.id,
                      });
                      const scanData = verifyRes?.data ?? verifyRes;

                      // 3. Check if issue still found
                      const fp = selectedItem.issue_fingerprint;
                      const title = selectedItem.title;
                      let stillFound = false;

                      if (scanData) {
                        const raw = typeof scanData === "string" ? JSON.parse(scanData) : scanData;
                        const allIssues = raw?.issues || raw?.results?.issues || [];
                        stillFound = allIssues.some((i: any) =>
                          (fp && i.issue_fingerprint === fp) || (i.title && i.title === title)
                        );
                      }

                      const vStatus = stillFound ? "failed" : "confirmed";

                      // 4. Update work item with verification result
                      await supabase.from("work_items" as any).update({
                        verification_status: vStatus,
                        verified_at: new Date().toISOString(),
                      }).eq("id", selectedItem.id);

                      setVerifyResult({ itemId: selectedItem.id, status: vStatus });

                      // 5. Refresh
                      queryClient.invalidateQueries({ queryKey: ["system-explorer-work-items"] });
                      queryClient.invalidateQueries({ queryKey: ["system-explorer-history", selectedItem.id] });

                      // Update selected item locally
                      setSelectedItem({ ...selectedItem, status: "done", verification_status: vStatus } as any);
                    } catch (err) {
                      console.error("Verification scan failed:", err);
                      setVerifyResult({ itemId: selectedItem.id, status: "failed" });
                    } finally {
                      setVerifyingFix(false);
                    }
                  }}
                >
                  {verifyingFix ? <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Verifying…</> : "✅ Mark as Fixed (+ Re-scan)"}
                </Button>
              )}
              {/* Verification Re-scan Result */}
              {verifyResult && verifyResult.itemId === selectedItem.id && (
                <div className={`border rounded-md p-2 space-y-1 ${verifyResult.status === "confirmed" ? "border-primary/40 bg-primary/5" : "border-destructive/40 bg-destructive/5"}`}>
                  <span className={`text-xs font-bold ${verifyResult.status === "confirmed" ? "text-primary" : "text-destructive"}`}>
                    {verifyResult.status === "confirmed" ? "✅ Re-scan result: Fixed" : "❌ Re-scan result: Still broken"}
                  </span>
                  <p className="text-[9px] text-muted-foreground">
                    {verifyResult.status === "confirmed"
                      ? "Issue was NOT found in verification scan — fix confirmed."
                      : "Issue was STILL found in verification scan — fix did not resolve the problem."}
                  </p>
                </div>
              )}
              {(() => {
                const meta = (selectedItem as any).metadata ? (typeof (selectedItem as any).metadata === "string" ? JSON.parse((selectedItem as any).metadata) : (selectedItem as any).metadata) : {};
                const dt = meta?.data_trace;
                const it = meta?.id_trace;
                const vf = meta?.validation_fields;
                const hasTrace = dt || it || vf;
                if (!hasTrace) return null;

                const traceSteps = [];
                if (dt) {
                  traceSteps.push(
                    { label: "UI (Input)", ok: dt.input_detected },
                    { label: "MAP", ok: dt.mapped },
                    { label: "TRANSFORM", ok: dt.transformed },
                    { label: "DB (Saved)", ok: dt.saved_to_db },
                  );
                }
                if (it) {
                  traceSteps.push(
                    { label: "ID Generated", ok: it.generated },
                    { label: "ID Persisted", ok: it.persisted },
                    { label: "ID Returned", ok: it.returned },
                  );
                }

                return (
                  <div className="border border-border rounded-md p-2 bg-muted/30 space-y-2">
                    <span className="text-muted-foreground text-xs font-medium">Data Trace</span>
                    {traceSteps.length > 0 && (
                      <div className="flex items-center gap-1 flex-wrap">
                        {traceSteps.map((step, idx) => (
                          <React.Fragment key={step.label}>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded border font-medium ${step.ok ? "border-primary/30 text-primary bg-primary/5" : "border-destructive/40 text-destructive bg-destructive/5 font-bold"}`}>
                              {step.ok ? "✅" : "❌"} {step.label}
                            </span>
                            {idx < traceSteps.length - 1 && <span className="text-[9px] text-muted-foreground">→</span>}
                          </React.Fragment>
                        ))}
                      </div>
                    )}
                    {vf && (
                      <div className="space-y-1">
                        <div className="flex items-center gap-1">
                          <span className={`text-[9px] px-1.5 py-0.5 rounded border ${vf.id === "present" ? "border-primary/30 text-primary" : "border-destructive/40 text-destructive font-bold"}`}>
                            {vf.id === "present" ? "✅" : "❌"} ID: {vf.id}
                          </span>
                        </div>
                        {vf.required_fields_missing?.length > 0 && (
                          <p className="text-[9px] text-destructive">❌ Missing: {vf.required_fields_missing.join(", ")}</p>
                        )}
                        {vf.null_fields?.length > 0 && (
                          <p className="text-[9px] text-destructive">⚠️ Null: {vf.null_fields.join(", ")}</p>
                        )}
                        {(!vf.required_fields_missing?.length && !vf.null_fields?.length && vf.id === "present") && (
                          <p className="text-[9px] text-primary">✅ All fields valid</p>
                        )}
                      </div>
                    )}
                    {/* Break point indicator */}
                    {traceSteps.some(s => !s.ok) && (
                      <p className="text-[9px] text-destructive font-medium">
                        💥 Break at: {traceSteps.find(s => !s.ok)?.label}
                      </p>
                    )}
                  </div>
                );
              })()}
              {/* Runtime Trace Section */}
              <RuntimeTraceSection traceId={(selectedItem as any).runtime_trace_id} />
              {/* Pipeline Trace: SCAN → FILTER → DEDUP → CREATE */}
              {(() => {
                const fp = (selectedItem as any).issue_fingerprint;
                const trace = (scanResults?._create_trace ?? [] as any[]).find((t: any) => t.fingerprint === fp || t.title === selectedItem.title);
                const scanned = true; // if it exists, scan found it
                const filterDecision = trace?._filter_decision;
                const filtered = filterDecision === "passed";
                const filterReason = trace?._filter_reason || (filterDecision && filterDecision !== "passed" ? filterDecision : null);
                const dedupDecision = trace?._create_decision;
                const deduped = dedupDecision !== "skipped_dedup";
                const dedupReason = trace?._dedup_reason || (dedupDecision === "skipped_dedup" ? "duplicate" : null);
                const created = dedupDecision === "created";
                const createError = trace?._create_error || (dedupDecision === "skipped_validation" ? trace?._validation_reason : null);

                const steps = [
                  { label: "SCAN", ok: scanned, reason: null as string | null },
                  { label: "FILTER", ok: trace ? filtered : null, reason: filterReason },
                  { label: "DEDUP", ok: trace ? deduped : null, reason: dedupReason },
                  { label: "CREATE", ok: trace ? created : null, reason: createError },
                ];

                return (
                  <div className="border border-border rounded-md p-2 bg-muted/30 space-y-2">
                    <span className="text-muted-foreground text-xs font-medium">Pipeline Trace</span>
                    <div className="flex items-center gap-1 flex-wrap">
                      {steps.map((step, idx) => (
                        <React.Fragment key={step.label}>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded border font-medium ${step.ok === true ? "border-primary/30 text-primary bg-primary/5" : step.ok === false ? "border-destructive/40 text-destructive bg-destructive/5 font-bold" : "border-border text-muted-foreground bg-muted/20"}`}>
                            {step.ok === true ? "✅" : step.ok === false ? "❌" : "–"} {step.label}
                          </span>
                          {idx < steps.length - 1 && <span className="text-[9px] text-muted-foreground">→</span>}
                        </React.Fragment>
                      ))}
                    </div>
                    {steps.find(s => s.ok === false) && (
                      <p className="text-[9px] text-destructive font-medium">
                        💥 Stopped at: {steps.find(s => s.ok === false)?.label}
                        {steps.find(s => s.ok === false)?.reason && ` — ${steps.find(s => s.ok === false)?.reason}`}
                      </p>
                    )}
                    {!trace && (
                      <p className="text-[9px] text-muted-foreground">No trace found in latest scan (may be from older scan)</p>
                    )}
                  </div>
                );
              })()}
              {/* Apply Fix (Preview) */}
              {(() => {
                const fp = (selectedItem as any).issue_fingerprint;
                const trace = (scanResults?._create_trace ?? [] as any[]).find((t: any) => t.fingerprint === fp || t.title === selectedItem.title);
                const fixCode = trace?._suggested_fix_code || null;
                const fixType = trace?._suggested_fix_type || null;
                const affectedArea = trace?.affected_area;
                const endpoint = (selectedItem as any).source_path || affectedArea?.target || "–";
                if (!fixCode) return null;

                return (
                  <div className="border border-border rounded-md p-2 bg-muted/30 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-xs font-medium">Suggested Fix</span>
                      <Badge variant="outline" className="text-[9px]">{fixType || "–"}</Badge>
                    </div>
                    {trace?._fix_confidence != null && (
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] font-medium text-foreground">🎯 Fix confidence: {trace._fix_confidence}/5</span>
                        <div className="flex gap-0.5">
                          {[1,2,3,4,5].map(n => (
                            <div key={n} className={`w-2 h-2 rounded-full ${n <= trace._fix_confidence ? "bg-primary" : "bg-muted"}`} />
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="text-[10px] text-muted-foreground space-y-0.5">
                      <p>📍 Affected: <span className="font-mono text-foreground">{endpoint}</span></p>
                    </div>
                    <pre className="bg-muted/50 border border-border rounded px-2 py-1.5 text-[10px] font-mono text-foreground whitespace-pre-wrap break-all select-all">{fixCode}</pre>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-[10px] h-7"
                      onClick={() => {
                        navigator.clipboard.writeText(fixCode);
                        navigator.clipboard.writeText(fixCode);
                      }}
                    >
                      📋 Copy Fix
                    </Button>
                  </div>
                );
              })()}
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
