import { Loader2, Radar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useScanRunner } from "./useScanRunner";

interface ScanControlsProps {
  onScanComplete?: () => void;
}

export function ScanControls({ onScanComplete }: ScanControlsProps) {
  const { runFullScan, isScanning } = useScanRunner(onScanComplete);

  return (
    <Button variant="default" size="sm" onClick={() => { console.log("🧪 CLICK: Run Full Scan"); runFullScan(); }} disabled={isScanning}>
      {isScanning ? (
        <Loader2 className="h-4 w-4 animate-spin mr-1" />
      ) : (
        <Radar className="h-4 w-4 mr-1" />
      )}
      {isScanning ? "Scanning..." : "Run Full Scan"}
    </Button>
  );
}
