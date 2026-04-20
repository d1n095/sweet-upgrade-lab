/**
 * QUEUE COLLAPSE PANEL — read-only reporter UI.
 *
 * Surfaces duplicates, already-executed, and outdated-scan tasks in the queue.
 * Operator can choose to apply the collapse (remove redundant tasks).
 */
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useWorkQueueStore } from "@/stores/workQueueStore";
import {
  runQueueCollapse,
  applyCollapse,
  type CollapseReason,
} from "@/core/scanner/queueCollapseEngine";
import { Layers, Trash2, GitMerge, Clock, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

const REASON_META: Record<CollapseReason, { label: string; icon: typeof GitMerge; variant: "default" | "secondary" | "destructive" }> = {
  duplicate_goal: { label: "Duplicate goal", icon: GitMerge, variant: "secondary" },
  already_executed: { label: "Already executed", icon: CheckCircle2, variant: "default" },
  outdated_scan: { label: "Outdated scan", icon: Clock, variant: "destructive" },
};

export function QueueCollapsePanel() {
  const tasks = useWorkQueueStore((s) => s.tasks);
  const [applying, setApplying] = useState(false);

  const report = useMemo(() => runQueueCollapse(tasks), [tasks]);

  const handleApply = () => {
    if (report.removed_tasks.length === 0) {
      toast.info("Inget att kollapsa — kön är redan ren");
      return;
    }
    setApplying(true);
    try {
      const { removed } = applyCollapse(report);
      toast.success(`Kollapsade ${removed} redundanta uppgifter`);
    } finally {
      setApplying(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Layers className="h-4 w-4" />
            Queue Collapse Engine
            <Badge variant="outline" className="ml-1 font-mono text-[10px]">
              READ-ONLY REPORTER
            </Badge>
          </CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={handleApply}
            disabled={applying || report.removed_tasks.length === 0}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
            Apply collapse ({report.removed_tasks.length})
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <Stat label="Queued" value={report.total_queued} />
          <Stat label="Cleaned" value={report.cleaned_queue_ids.length} />
          <Stat label="Removed" value={report.removed_tasks.length} accent />
          <Stat label="Latest scan" value={report.latest_scan_ref ? report.latest_scan_ref.slice(0, 8) : "—"} mono />
        </div>

        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(REASON_META) as CollapseReason[]).map((reason) => {
            const meta = REASON_META[reason];
            const Icon = meta.icon;
            return (
              <div
                key={reason}
                className="flex items-center gap-2 rounded-md border bg-muted/30 px-2 py-1.5 text-xs"
              >
                <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground truncate">{meta.label}</span>
                <span className="ml-auto font-mono font-medium">{report.by_reason[reason]}</span>
              </div>
            );
          })}
        </div>

        {report.removed_tasks.length === 0 ? (
          <div className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
            Kön är redan minimal — inga dubletter eller stale referenser hittades.
          </div>
        ) : (
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-2">
              Removed tasks ({report.removed_tasks.length})
            </div>
            <ScrollArea className="max-h-72 rounded-md border">
              <ul className="divide-y">
                {report.removed_tasks.map((entry) => {
                  const meta = REASON_META[entry.reason];
                  const Icon = meta.icon;
                  return (
                    <li key={entry.task_id} className="p-2.5 text-xs">
                      <div className="flex items-start gap-2">
                        <Icon className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant={meta.variant} className="text-[10px] h-4">
                              {meta.label}
                            </Badge>
                            <span className="font-mono text-[10px] text-muted-foreground truncate">
                              {entry.task_id}
                            </span>
                          </div>
                          <div className="mt-1 font-medium truncate">{entry.task_title}</div>
                          <div className="mt-0.5 text-muted-foreground">{entry.detail}</div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </ScrollArea>
          </div>
        )}

        <p className="text-[11px] text-muted-foreground">
          This engine reports redundant queue items — it cannot block execution. The
          ExecutionController remains the sole authority for STOP/CONTINUE.
        </p>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, accent, mono }: { label: string; value: number | string; accent?: boolean; mono?: boolean }) {
  return (
    <div className="rounded-md border bg-card p-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`${mono ? "font-mono" : ""} ${accent ? "text-primary" : ""} mt-0.5 text-base font-semibold`}>
        {value}
      </div>
    </div>
  );
}
