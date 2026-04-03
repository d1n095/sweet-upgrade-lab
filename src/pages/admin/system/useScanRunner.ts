import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { startScanJob } from "@/lib/scanEngine";

export function useScanRunner(onScanComplete?: () => void) {
  const [isScanning, setIsScanning] = useState(false);
  const queryClient = useQueryClient();

  const runFullScan = async () => {
    if (isScanning) {
      toast.info("En skanning körs redan");
      return;
    }

    setIsScanning(true);

    try {
      await startScanJob("system");

      await queryClient.invalidateQueries({ queryKey: ["system-explorer-latest-run"] });
      await queryClient.invalidateQueries({ queryKey: ["backend-scan-latest"] });
      await queryClient.invalidateQueries({ queryKey: ["system-explorer-latest-scan"] });

      onScanComplete?.();
    } catch (err: any) {
      console.error("❌ FULL SCAN FAIL:", err);
      toast.error(err?.message || "Skanning misslyckades");
    } finally {
      setIsScanning(false);
    }
  };

  return { runFullScan, isScanning };
}
