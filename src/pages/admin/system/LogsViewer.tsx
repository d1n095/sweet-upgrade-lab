import React from "react";
import { useActionMonitorStore } from "@/lib/actionMonitor";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

export function LogsViewer() {
  const { events } = useActionMonitorStore();

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">System Log ({events.length})</h3>
      <ScrollArea className="h-72">
        {events.length === 0 && <p className="text-xs text-muted-foreground">No events.</p>}
        {events.map((e) => (
          <div key={e.id} className="flex items-center gap-2 text-xs border-b py-1">
            <span className="text-muted-foreground w-14 shrink-0">{e.timestamp.slice(11, 19)}</span>
            <Badge variant={e.status === "ok" ? "default" : e.status === "error" ? "destructive" : "secondary"} className="text-[10px] h-4">{e.type}</Badge>
            <span>{e.label}</span>
          </div>
        ))}
      </ScrollArea>
    </div>
  );
}
