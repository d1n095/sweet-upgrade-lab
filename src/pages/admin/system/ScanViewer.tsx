import React from "react";
import { useActionMonitorStore } from "@/lib/actionMonitor";
import { Badge } from "@/components/ui/badge";

export function ScanViewer() {
  const { events } = useActionMonitorStore();
  const scanEvents = events.filter((e) => e.type === "scan");

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">Scan Results</h3>
      {scanEvents.length === 0 && <p className="text-xs text-muted-foreground">No scan results yet. Trigger a scan to see results.</p>}
      {scanEvents.map((e) => (
        <div key={e.id} className="flex items-center gap-2 text-xs border rounded p-2">
          <Badge variant={e.status === "ok" ? "default" : "destructive"}>{e.status}</Badge>
          <span>{e.label}</span>
          <span className="text-muted-foreground ml-auto">{e.timestamp.slice(0, 19).replace("T", " ")}</span>
        </div>
      ))}
    </div>
  );
}
