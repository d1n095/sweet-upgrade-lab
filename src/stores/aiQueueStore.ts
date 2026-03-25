import { create } from 'zustand';
import { useSafeModeStore } from './safeModeStore';

export type QueueTaskStatus = 'queued' | 'running' | 'completed' | 'failed' | 'blocked' | 'validating' | 'regressed';
export type QueueTaskPriority = 'critical' | 'high' | 'normal';

export interface FailureCheck {
  name: string;
  passed: boolean;
  detail?: string;
}

export interface FailureReport {
  what: string;
  where: string;
  why: string;
  checks: FailureCheck[];
  timestamp: string;
}

export interface StateSnapshot {
  key: string;
  value: any;
  capturedAt: string;
}

export interface RegressionEntry {
  taskId: string;
  taskTitle: string;
  affectedKey: string;
  previousValue: any;
  currentValue: any;
  detectedAt: string;
  linkedChangeId?: string;
  reopened: boolean;
}

export interface QueueTask {
  id: string;
  title: string;
  description?: string;
  status: QueueTaskStatus;
  priority: QueueTaskPriority;
  dependsOn?: string[];
  error?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  executor?: () => Promise<any>;
  validator?: (result: any) => Promise<FailureCheck[]>;
  /** Captures state BEFORE execution for regression comparison */
  snapshotBefore?: () => Promise<Record<string, any>>;
  /** Captures state AFTER execution — compared against snapshotBefore */
  snapshotAfter?: () => Promise<Record<string, any>>;
  /** Keys that must NOT change (regression = value changed) */
  guardKeys?: string[];
  /** Keys that MUST change (regression = value stayed the same — fix didn't work) */
  expectChangedKeys?: string[];
  result?: any;
  failureReport?: FailureReport;
  preSnapshot?: Record<string, any>;
  regressions?: RegressionEntry[];
}

const MAX_CONCURRENT = 2;

interface AiQueueState {
  tasks: QueueTask[];
  maxConcurrent: number;
  failureLog: FailureReport[];
  regressionLog: RegressionEntry[];
  addTask: (task: Omit<QueueTask, 'id' | 'status' | 'createdAt'> & { id?: string }) => string;
  removeTask: (id: string) => void;
  clearCompleted: () => void;
  clearFailureLog: () => void;
  clearRegressionLog: () => void;
  processQueue: () => Promise<void>;
  retryTask: (id: string) => void;
  cancelTask: (id: string) => void;
  _isProcessing: boolean;
}

const generateId = () => `qt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

// Default post-execution validator when none is provided
const defaultValidator = async (_result: any): Promise<FailureCheck[]> => {
  const checks: FailureCheck[] = [];
  checks.push({
    name: 'Resultat finns',
    passed: _result !== null && _result !== undefined,
    detail: _result === null || _result === undefined ? 'Inget resultat returnerades' : undefined,
  });
  const hasError = _result && typeof _result === 'object' && ('error' in _result || 'errors' in _result);
  checks.push({
    name: 'Inga fel i svar',
    passed: !hasError,
    detail: hasError ? `Felsvar: ${JSON.stringify(_result.error || _result.errors).slice(0, 200)}` : undefined,
  });
  const hasEmptyData =
    _result && typeof _result === 'object' && 'data' in _result &&
    (Array.isArray(_result.data) ? _result.data.length === 0 : !_result.data);
  checks.push({
    name: 'Data finns',
    passed: !hasEmptyData,
    detail: hasEmptyData ? 'Tom eller saknad data i svaret' : undefined,
  });
  return checks;
};

function buildFailureReport(task: QueueTask, checks: FailureCheck[]): FailureReport {
  const failedChecks = checks.filter((c) => !c.passed);
  return {
    what: `${task.title} — ${failedChecks.length} kontroll(er) misslyckades`,
    where: task.description || task.title,
    why: failedChecks.map((c) => `${c.name}: ${c.detail || 'Misslyckad'}`).join('; '),
    checks,
    timestamp: new Date().toISOString(),
  };
}

function blockDependents(tasks: QueueTask[], failedId: string): QueueTask[] {
  return tasks.map((t) => {
    if (t.status === 'queued' && t.dependsOn?.includes(failedId)) {
      return { ...t, status: 'blocked' as const, error: 'Beroende uppgift misslyckades' };
    }
    return t;
  });
}

/** Deep-compare two values; returns true if different */
function valueChanged(a: any, b: any): boolean {
  if (a === b) return false;
  if (a === undefined || b === undefined || a === null || b === null) return a !== b;
  try {
    return JSON.stringify(a) !== JSON.stringify(b);
  } catch {
    return a !== b;
  }
}

/** Detect regressions by comparing pre/post snapshots */
function detectRegressions(task: QueueTask, postSnapshot: Record<string, any>): RegressionEntry[] {
  const regressions: RegressionEntry[] = [];
  const pre = task.preSnapshot || {};
  const now = new Date().toISOString();

  // Guard keys: values that must NOT change
  if (task.guardKeys) {
    for (const key of task.guardKeys) {
      if (key in pre && key in postSnapshot && valueChanged(pre[key], postSnapshot[key])) {
        regressions.push({
          taskId: task.id,
          taskTitle: task.title,
          affectedKey: key,
          previousValue: pre[key],
          currentValue: postSnapshot[key],
          detectedAt: now,
          reopened: true,
        });
      }
    }
  }

  // Expect changed keys: values that MUST change (fix verification)
  if (task.expectChangedKeys) {
    for (const key of task.expectChangedKeys) {
      if (key in pre && key in postSnapshot && !valueChanged(pre[key], postSnapshot[key])) {
        regressions.push({
          taskId: task.id,
          taskTitle: task.title,
          affectedKey: key,
          previousValue: pre[key],
          currentValue: postSnapshot[key],
          detectedAt: now,
          reopened: true,
        });
      }
    }
  }

  return regressions;
}

async function runPostChecks(
  task: QueueTask,
  result: any,
  set: (fn: (s: AiQueueState) => Partial<AiQueueState>) => void,
  get: () => AiQueueState
) {
  // 1. Standard validation
  const validate = task.validator || defaultValidator;
  const checks = await validate(result);
  const anyFailed = checks.some((c) => !c.passed);

  if (anyFailed) {
    const report = buildFailureReport(task, checks);
    set((s) => ({
      tasks: blockDependents(
        s.tasks.map((t) =>
          t.id === task.id
            ? { ...t, status: 'failed' as const, error: `Validering misslyckades`, failureReport: report, completedAt: new Date().toISOString() }
            : t
        ),
        task.id
      ),
      failureLog: [...s.failureLog, report],
    }));
    // Evaluate safe mode
    const st = get();
    useSafeModeStore.getState().evaluateThreshold(
      st.tasks.filter(t => t.status === 'failed').length,
      st.regressionLog.length
    );
    return;
  }

  // 2. Regression detection
  let regressions: RegressionEntry[] = [];
  if (task.snapshotAfter && task.preSnapshot) {
    try {
      const postSnapshot = await task.snapshotAfter();
      regressions = detectRegressions(task, postSnapshot);
    } catch (err) {
      regressions = [{
        taskId: task.id,
        taskTitle: task.title,
        affectedKey: '_snapshot_error',
        previousValue: null,
        currentValue: String(err),
        detectedAt: new Date().toISOString(),
        reopened: false,
      }];
    }
  }

  if (regressions.length > 0) {
    const report: FailureReport = {
      what: `Regression i ${task.title} — ${regressions.length} nycklar påverkade`,
      where: regressions.map((r) => r.affectedKey).join(', '),
      why: regressions.map((r) => `${r.affectedKey}: förväntat ${JSON.stringify(r.previousValue)?.slice(0, 60)}, fick ${JSON.stringify(r.currentValue)?.slice(0, 60)}`).join('; '),
      checks: regressions.map((r) => ({
        name: `Regression: ${r.affectedKey}`,
        passed: false,
        detail: `Förändrad från ${JSON.stringify(r.previousValue)?.slice(0, 80)} till ${JSON.stringify(r.currentValue)?.slice(0, 80)}`,
      })),
      timestamp: new Date().toISOString(),
    };

    set((s) => ({
      tasks: blockDependents(
        s.tasks.map((t) =>
          t.id === task.id
            ? { ...t, status: 'regressed' as const, error: `Regression: ${regressions.length} nyckel(ar)`, failureReport: report, regressions, completedAt: new Date().toISOString() }
            : t
        ),
        task.id
      ),
      failureLog: [...s.failureLog, report],
      regressionLog: [...s.regressionLog, ...regressions],
    }));
    // Regression triggers safe mode evaluation
    useSafeModeStore.getState().evaluateThreshold(
      get().tasks.filter(t => t.status === 'failed').length,
      get().regressionLog.length
    );
    return;
  }

  // 3. All good
  set((s) => ({
    tasks: s.tasks.map((t) =>
      t.id === task.id
        ? { ...t, status: 'completed' as const, completedAt: new Date().toISOString(), result }
        : t
    ),
  }));
}

export const useAiQueueStore = create<AiQueueState>((set, get) => ({
  tasks: [],
  maxConcurrent: MAX_CONCURRENT,
  failureLog: [],
  regressionLog: [],
  _isProcessing: false,

  addTask: (input) => {
    const id = input.id || generateId();
    const task: QueueTask = { ...input, id, status: 'queued', createdAt: new Date().toISOString() };
    set((s) => ({ tasks: [...s.tasks, task] }));
    setTimeout(() => get().processQueue(), 0);
    return id;
  },

  removeTask: (id) => set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),
  clearCompleted: () => set((s) => ({ tasks: s.tasks.filter((t) => t.status !== 'completed') })),
  clearFailureLog: () => set({ failureLog: [] }),
  clearRegressionLog: () => set({ regressionLog: [] }),

  cancelTask: (id) =>
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === id && t.status === 'queued' ? { ...t, status: 'blocked' as const } : t)),
    })),

  retryTask: (id) => {
    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === id && (t.status === 'failed' || t.status === 'blocked' || t.status === 'regressed')
          ? { ...t, status: 'queued' as const, error: undefined, failureReport: undefined, regressions: undefined, preSnapshot: undefined }
          : t
      ),
    }));
    setTimeout(() => get().processQueue(), 0);
  },

  processQueue: async () => {
    const state = get();
    if (state._isProcessing) return;
    set({ _isProcessing: true });

    try {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const current = get();
        const running = current.tasks.filter((t) => t.status === 'running' || t.status === 'validating');
        if (running.length >= current.maxConcurrent) break;

        const failedIds = new Set(current.tasks.filter((t) => t.status === 'failed' || t.status === 'regressed').map((t) => t.id));
        let updatedTasks = current.tasks;
        for (const fid of failedIds) {
          updatedTasks = blockDependents(updatedTasks, fid);
        }

        const priorityOrder: Record<QueueTaskPriority, number> = { critical: 0, high: 1, normal: 2 };
        const completedIds = new Set(updatedTasks.filter((t) => t.status === 'completed').map((t) => t.id));

        // Safe Mode: skip non-critical tasks
        const safeMode = useSafeModeStore.getState();
        const nextTask = updatedTasks
          .filter((t) => {
            if (t.status !== 'queued') return false;
            if (t.dependsOn && !t.dependsOn.every((dep) => completedIds.has(dep))) return false;
            if (safeMode.active && t.priority !== 'critical') return false;
            return true;
          })
          .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])[0];

        if (!nextTask) {
          set({ tasks: updatedTasks });
          break;
        }

        // Capture pre-snapshot
        let preSnapshot: Record<string, any> | undefined;
        if (nextTask.snapshotBefore) {
          try {
            preSnapshot = await nextTask.snapshotBefore();
          } catch (err) {
            console.warn('Pre-snapshot failed', err);
          }
        }

        set({
          tasks: updatedTasks.map((t) =>
            t.id === nextTask.id
              ? { ...t, status: 'running' as const, startedAt: new Date().toISOString(), preSnapshot }
              : t
          ),
        });

        if (nextTask.executor) {
          const taskWithSnapshot = { ...nextTask, preSnapshot };
          taskWithSnapshot
            .executor!()
            .then(async (result) => {
              set((s) => ({
                tasks: s.tasks.map((t) =>
                  t.id === nextTask.id ? { ...t, status: 'validating' as const, result } : t
                ),
              }));

              try {
                await runPostChecks(taskWithSnapshot, result, set, get);
              } catch (valErr) {
                const report = buildFailureReport(taskWithSnapshot, [
                  { name: 'Valideringsmotor', passed: false, detail: String(valErr) },
                ]);
                set((s) => ({
                  tasks: blockDependents(
                    s.tasks.map((t) =>
                      t.id === nextTask.id
                        ? { ...t, status: 'failed' as const, error: 'Valideringsmotorn kraschade', failureReport: report, completedAt: new Date().toISOString() }
                        : t
                    ),
                    nextTask.id
                  ),
                  failureLog: [...s.failureLog, report],
                }));
              }

              set({ _isProcessing: false });
              get().processQueue();
            })
            .catch((err) => {
              const report = buildFailureReport(
                { ...nextTask, status: 'failed' },
                [{ name: 'Exekvering', passed: false, detail: err?.message || String(err) }]
              );
              set((s) => ({
                tasks: blockDependents(
                  s.tasks.map((t) =>
                    t.id === nextTask.id
                      ? { ...t, status: 'failed' as const, error: err?.message || String(err), failureReport: report, completedAt: new Date().toISOString() }
                      : t
                  ),
                  nextTask.id
                ),
                failureLog: [...s.failureLog, report],
              }));
              // Evaluate safe mode threshold
              const st = get();
              const recentFails = st.tasks.filter(t => t.status === 'failed').length;
              const recentRegs = st.tasks.filter(t => t.status === 'regressed').length;
              useSafeModeStore.getState().evaluateThreshold(recentFails, recentRegs);

              set({ _isProcessing: false });
              get().processQueue();
            });
        } else {
          set((s) => ({
            tasks: s.tasks.map((t) =>
              t.id === nextTask.id
                ? { ...t, status: 'completed' as const, completedAt: new Date().toISOString() }
                : t
            ),
          }));
        }

        if (running.length + 1 >= current.maxConcurrent) break;
      }
    } finally {
      set({ _isProcessing: false });
    }
  },
}));
