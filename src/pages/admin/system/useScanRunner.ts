import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getRawSources } from "@/lib/fileSystemMap";

declare global {
  interface Window {
    __SCAN_DEBUG__: boolean;
  }
}

window.__SCAN_DEBUG__ = true;

export function useScanRunner(onScanComplete?: () => void) {
  const [isScanning, setIsScanning] = useState(false);
  const queryClient = useQueryClient();

  const runFullScan = async () => {
    if (window.__SCAN_DEBUG__) {
      console.log("SCAN CLICKED");
    }

    setIsScanning(true);

    try {
      // Kill stuck running scans before starting a new one
      await supabase
        .from("scan_runs" as any)
        .update({ status: "killed" } as any)
        .eq("status", "running");
      console.log("🧹 KILLED OLD SCANS");

      const structure_map = Object.keys(getRawSources() || {}).map((path) => ({ path }));

      if (window.__SCAN_DEBUG__) {
        console.log("INVOKE SENT", { function: "run-full-scan", structure_map_count: structure_map.length });
      }

      console.log("🚀 STARTING FULL SCAN");

      const res = await supabase.functions.invoke("run-full-scan", {
        body: { action: "start", scan_mode: "full", structure_map },
      });

      if (window.__SCAN_DEBUG__) {
        console.log("INVOKE RESPONSE", { data: res.data, error: res.error });
      }

      if (res.error) {
        console.error("❌ FULL SCAN FAIL:", res.error);
      } else {
        console.log("✅ SCAN OK:", res.data);
      }

      await queryClient.invalidateQueries({ queryKey: ["system-explorer-latest-run"] });
      await queryClient.invalidateQueries({ queryKey: ["backend-scan-latest"] });
      await queryClient.invalidateQueries({ queryKey: ["system-explorer-latest-scan"] });

      onScanComplete?.();
    } catch (err) {
      console.error("❌ FULL SCAN FAIL:", err);
    } finally {
      setIsScanning(false);
    }
  };

  return { runFullScan, isScanning };
}
