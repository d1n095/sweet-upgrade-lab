import React from "react";
import { useActionMonitorStore } from "@/lib/actionMonitor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

export function ActionMonitorPanel() {
  const { events, clearEvents } = useActionMonitorStore();

  return (
    <div className="border rounded-lg p-4 bg-black/80 text-white font-mono text-xs space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-green-400 font-bold">⬡ ActionMonitor — {events.length} events</span>
        <Button variant="ghost" size="sm" className="text-red-400 h-6 px-2" onClick={clearEvents}>
          Clear
        </Button>
      </div>
      <ScrollArea className="h-64">
        {events.length === 0 && (
          <p className="text-muted-foreground italic">No events yet.</p>
        )}
        {events.map((e) => (
          <div key={e.id} className="flex items-start gap-2 py-0.5 border-b border-white/5">
            <span className="text-muted-foreground w-20 shrink-0">{e.timestamp.slice(11, 23)}</span>
            <Badge
              variant={e.status === "ok" ? "default" : e.status === "error" ? "destructive" : "secondary"}
              className="text-[10px] h-4 px-1"
            >
              {e.type}
            </Badge>
            <span className={e.status === "error" ? "text-red-400" : "text-green-300"}>{e.label}</span>
          </div>
        ))}
      </ScrollArea>
    </div>
  );
}
