import React from "react";
import { useActionMonitorStore } from "@/lib/actionMonitor";
import { Badge } from "@/components/ui/badge";

export function ErrorViewer() {
  const { events, lastError } = useActionMonitorStore();
  const errors = events.filter((e) => e.status === "error");

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-red-500">Errors ({errors.length})</h3>
      {lastError && (
        <div className="text-xs bg-red-950/40 border border-red-800 rounded p-2 mb-2">
          <span className="font-semibold">Last error: </span>{lastError.label}
          <span className="text-muted-foreground ml-2">{lastError.timestamp.slice(0, 19).replace("T", " ")}</span>
        </div>
      )}
      {errors.length === 0 && <p className="text-xs text-muted-foreground">No errors detected.</p>}
      {errors.map((e) => (
        <div key={e.id} className="flex items-center gap-2 text-xs border border-red-900/30 rounded p-1.5">
          <Badge variant="destructive" className="text-[10px] h-4">{e.source}</Badge>
          <span className="text-red-300">{e.label}</span>
          <span className="text-muted-foreground ml-auto">{e.timestamp.slice(11, 19)}</span>
        </div>
      ))}
    </div>
  );
}
