/**
 * QUEUE COLLAPSE ENGINE
 *
 * GOAL: Remove duplicate and redundant executions from the work queue.
 *
 * RULES (deterministic, no AI):
 *   R1. SAME GOAL → MERGE       — two queued tasks with identical goal-key are merged
 *                                 into the highest-priority one; others marked redundant.
 *   R2. ALREADY EXECUTED → REMOVE — if a queued task's goal-key already has a
 *                                 completed task in this session, mark it redundant.
 *   R3. OUTDATED SCAN → REMOVE  — if a queued task references a scan_run_id older than
 *                                 the latest known scan, mark it stale.
 *
 * AUTHORITY:
 *   This engine is a READ-ONLY REPORTER under the Absolute Control Layer.
 *   It does NOT mutate the queue itself. It returns a CollapseReport that the
 *   ExecutionController (or operator UI) may apply by calling `applyCollapse`.
 */
import { useWorkQueueStore, type QueueTask, type QueueTaskPriority } from "@/stores/workQueueStore";

export type CollapseReason = "duplicate_goal" | "already_executed" | "outdated_scan";

export interface CollapseEntry {
  task_id: string;
  task_title: string;
  reason: CollapseReason;
  merged_into?: string;
  stale_scan_ref?: string;
  detail: string;
}

export interface CollapseReport {
  generated_at: string;
  total_queued: number;
  total_examined: number;
  cleaned_queue_ids: string[];
  removed_tasks: CollapseEntry[];
  by_reason: Record<CollapseReason, number>;
  latest_scan_ref: string | null;
}

const PRIORITY_RANK: Record<QueueTaskPriority, number> = {
  critical: 3,
  high: 2,
  normal: 1,
};

export function goalKey(task: Pick<QueueTask, "title" | "lockArea">): string {
  const normalized = task.title
    .replace(/^\[.*?\]\s*/g, "")
    .replace(/\(?\+\d+\s*liknande\)?/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  const area = task.lockArea ?? "global";
  return `${area}::${normalized}`;
}

function extractScanRef(task: QueueTask): string | null {
  const src = `${task.description ?? ""} ${task.error ?? ""}`;
  const m = src.match(/scan[_-]?(?:run[_-]?)?id[:=\s]+([a-z0-9-]{6,})/i);
  return m ? m[1] : null;
}

function findLatestScanRef(tasks: QueueTask[]): string | null {
  let latest: { ref: string; ts: number } | null = null;
  for (const t of tasks) {
    const ref = extractScanRef(t);
    if (!ref) continue;
    const ts = new Date(t.createdAt).getTime();
    if (!latest || ts > latest.ts) latest = { ref, ts };
  }
  return latest?.ref ?? null;
}

export function runQueueCollapse(tasks: QueueTask[]): CollapseReport {
  const queued = tasks.filter((t) => t.status === "queued");
  const completedKeys = new Set(
    tasks.filter((t) => t.status === "completed").map((t) => goalKey(t))
  );
  const latestScanRef = findLatestScanRef(tasks);

  const removed: CollapseEntry[] = [];
  const removedIds = new Set<string>();

  // R1. SAME GOAL → MERGE
  const groups = new Map<string, QueueTask[]>();
  for (const t of queued) {
    const key = goalKey(t);
    const arr = groups.get(key) ?? [];
    arr.push(t);
    groups.set(key, arr);
  }
  for (const [, group] of groups) {
    if (group.length < 2) continue;
    const survivor = [...group].sort((a, b) => {
      const pr = PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority];
      if (pr !== 0) return pr;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    })[0];
    for (const t of group) {
      if (t.id === survivor.id) continue;
      removedIds.add(t.id);
      removed.push({
        task_id: t.id,
        task_title: t.title,
        reason: "duplicate_goal",
        merged_into: survivor.id,
        detail: `merged into ${survivor.id} (priority=${survivor.priority})`,
      });
    }
  }

  // R2. ALREADY EXECUTED → REMOVE
  for (const t of queued) {
    if (removedIds.has(t.id)) continue;
    if (completedKeys.has(goalKey(t))) {
      removedIds.add(t.id);
      removed.push({
        task_id: t.id,
        task_title: t.title,
        reason: "already_executed",
        detail: "an identical-goal task already completed in this session",
      });
    }
  }

  // R3. OUTDATED SCAN → REMOVE
  if (latestScanRef) {
    for (const t of queued) {
      if (removedIds.has(t.id)) continue;
      const ref = extractScanRef(t);
      if (ref && ref !== latestScanRef) {
        removedIds.add(t.id);
        removed.push({
          task_id: t.id,
          task_title: t.title,
          reason: "outdated_scan",
          stale_scan_ref: ref,
          detail: `references stale scan ${ref}; latest is ${latestScanRef}`,
        });
      }
    }
  }

  const cleanedQueueIds = queued.filter((t) => !removedIds.has(t.id)).map((t) => t.id);
  const byReason: Record<CollapseReason, number> = {
    duplicate_goal: 0,
    already_executed: 0,
    outdated_scan: 0,
  };
  for (const r of removed) byReason[r.reason]++;

  return {
    generated_at: new Date().toISOString(),
    total_queued: queued.length,
    total_examined: tasks.length,
    cleaned_queue_ids: cleanedQueueIds,
    removed_tasks: removed,
    by_reason: byReason,
    latest_scan_ref: latestScanRef,
  };
}

export function runQueueCollapseLive(): CollapseReport {
  return runQueueCollapse(useWorkQueueStore.getState().tasks);
}

export function applyCollapse(report: CollapseReport): { removed: number } {
  const store = useWorkQueueStore.getState();
  const queuedIds = new Set(store.tasks.filter((t) => t.status === "queued").map((t) => t.id));
  let removed = 0;
  for (const entry of report.removed_tasks) {
    if (queuedIds.has(entry.task_id)) {
      store.removeTask(entry.task_id);
      removed++;
    }
  }
  return { removed };
}
