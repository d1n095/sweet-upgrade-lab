/**
 * AutomationScheduler
 *
 * Client-safe interval-based scheduler for automation tasks.
 *
 * Rules:
 *  - NO backend calls, NO cron, NO side effects beyond calling ExecutionEngine
 *  - Only executes tasks with execution_mode="auto"
 *  - Respects user-controlled enable/disable flag
 *  - All execution goes via ExecutionEngine.executeAction (confirmed=true only for auto tasks)
 *  - Logs every run to AutomationLog (in-memory)
 *  - Fully stoppable / restartable
 */

import type { AutomationTask, TaskStatus } from './AutomationEngine';
import { getEligibleAutoTasks, updateTaskStatus } from './AutomationEngine';
import { executeAction } from '../actions/ExecutionEngine';

// ── Log types ──────────────────────────────────────────────────────────────────

export interface AutomationLogEntry {
  id: string;
  task_id: string;
  action_id: string;
  ts: number;
  status: TaskStatus;
  message: string;
  rollback_available: boolean;
}

// ── In-memory log ──────────────────────────────────────────────────────────────

const _log: AutomationLogEntry[] = [];
let _logCounter = 0;

function mkLogId(): string {
  return `al-${++_logCounter}-${Date.now()}`;
}

export function getAutomationLog(): readonly AutomationLogEntry[] {
  return _log;
}

export function clearAutomationLog(): void {
  _log.length = 0;
}

function appendLog(entry: Omit<AutomationLogEntry, 'id'>): void {
  _log.push({ id: mkLogId(), ...entry });
  // Keep last 500 entries
  if (_log.length > 500) _log.splice(0, _log.length - 500);
}

// ── Scheduler state ────────────────────────────────────────────────────────────

interface SchedulerState {
  enabled: boolean;
  intervalMs: number;
  timerId: ReturnType<typeof setInterval> | null;
  tasks: AutomationTask[];
  onTasksChange: ((tasks: AutomationTask[]) => void) | null;
}

const _state: SchedulerState = {
  enabled: false,
  intervalMs: 5 * 60 * 1000, // 5 minutes default
  timerId: null,
  tasks: [],
  onTasksChange: null,
};

// ── Core tick ──────────────────────────────────────────────────────────────────

function runTick(): void {
  if (!_state.enabled) return;

  const eligible = getEligibleAutoTasks(_state.tasks);
  if (eligible.length === 0) return;

  const updatedTasks = [..._state.tasks];

  for (const task of eligible) {
    try {
      // Mark running
      const idx = updatedTasks.findIndex((t) => t.id === task.id);
      if (idx === -1) continue;

      updatedTasks[idx] = updateTaskStatus(updatedTasks[idx], 'running');

      // Execute via ExecutionEngine with confirmed=true (auto tasks are pre-approved)
      const result = executeAction(task.action, true);

      const finalStatus: TaskStatus = result.success ? 'done' : 'failed';
      updatedTasks[idx] = updateTaskStatus(updatedTasks[idx], finalStatus, result.message);

      appendLog({
        task_id: task.id,
        action_id: task.action_id,
        ts: Date.now(),
        status: finalStatus,
        message: result.message,
        rollback_available: result.rollback_available,
      });
    } catch (err: unknown) {
      const idx = updatedTasks.findIndex((t) => t.id === task.id);
      if (idx !== -1) {
        updatedTasks[idx] = updateTaskStatus(updatedTasks[idx], 'failed', 'Scheduler error');
      }
      appendLog({
        task_id: task.id,
        action_id: task.action_id,
        ts: Date.now(),
        status: 'failed',
        message: err instanceof Error ? err.message : 'Unknown scheduler error',
        rollback_available: false,
      });
    }
  }

  _state.tasks = updatedTasks;
  _state.onTasksChange?.(updatedTasks);
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Load (or replace) the current task list.
 * The scheduler will pick up eligible tasks on the next tick.
 */
export function setSchedulerTasks(tasks: AutomationTask[]): void {
  _state.tasks = [...tasks];
}

/**
 * Register a callback invoked whenever the task list is mutated by the scheduler.
 */
export function onSchedulerTasksChange(
  cb: ((tasks: AutomationTask[]) => void) | null,
): void {
  _state.onTasksChange = cb;
}

/**
 * Enable or disable the scheduler.
 * Stopping clears the interval; starting creates a new one.
 */
export function setSchedulerEnabled(enabled: boolean): void {
  _state.enabled = enabled;

  if (!enabled) {
    if (_state.timerId !== null) {
      clearInterval(_state.timerId);
      _state.timerId = null;
    }
    return;
  }

  // Already running — just toggle the flag
  if (_state.timerId !== null) return;

  _state.timerId = setInterval(() => {
    try {
      runTick();
    } catch {
      // Never propagate — scheduler must not crash the page
    }
  }, _state.intervalMs);
}

/**
 * Change the tick interval (milliseconds). Restarts if currently running.
 */
export function setSchedulerInterval(ms: number): void {
  _state.intervalMs = ms;

  if (_state.timerId !== null) {
    clearInterval(_state.timerId);
    _state.timerId = null;
    setSchedulerEnabled(true);
  }
}

/**
 * Immediately run one tick regardless of the interval.
 * Safe to call at any time.
 */
export function runSchedulerNow(): void {
  try {
    runTick();
  } catch {
    // Never propagate
  }
}

/**
 * Fully stop and reset the scheduler.
 */
export function resetScheduler(): void {
  if (_state.timerId !== null) {
    clearInterval(_state.timerId);
    _state.timerId = null;
  }
  _state.enabled = false;
  _state.tasks = [];
  _state.onTasksChange = null;
}

/**
 * Read scheduler status (for UI display).
 */
export function getSchedulerStatus(): {
  enabled: boolean;
  intervalMs: number;
  pendingCount: number;
  doneCount: number;
  failedCount: number;
} {
  return {
    enabled: _state.enabled,
    intervalMs: _state.intervalMs,
    pendingCount: _state.tasks.filter((t) => t.status === 'pending').length,
    doneCount: _state.tasks.filter((t) => t.status === 'done').length,
    failedCount: _state.tasks.filter((t) => t.status === 'failed').length,
  };
}
