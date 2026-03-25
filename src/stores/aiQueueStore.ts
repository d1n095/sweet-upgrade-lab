import { create } from 'zustand';

export type QueueTaskStatus = 'queued' | 'running' | 'completed' | 'failed' | 'blocked' | 'validating';
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
  result?: any;
  failureReport?: FailureReport;
}

const MAX_CONCURRENT = 2;

interface AiQueueState {
  tasks: QueueTask[];
  maxConcurrent: number;
  failureLog: FailureReport[];
  addTask: (task: Omit<QueueTask, 'id' | 'status' | 'createdAt'> & { id?: string }) => string;
  removeTask: (id: string) => void;
  clearCompleted: () => void;
  clearFailureLog: () => void;
  processQueue: () => Promise<void>;
  retryTask: (id: string) => void;
  cancelTask: (id: string) => void;
  _isProcessing: boolean;
}

const generateId = () => `qt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

// Default post-execution validator when none is provided
const defaultValidator = async (_result: any): Promise<FailureCheck[]> => {
  const checks: FailureCheck[] = [];

  // Check 1: Result exists (not null/undefined)
  checks.push({
    name: 'Resultat finns',
    passed: _result !== null && _result !== undefined,
    detail: _result === null || _result === undefined ? 'Inget resultat returnerades' : undefined,
  });

  // Check 2: No error property in result
  const hasError = _result && typeof _result === 'object' && ('error' in _result || 'errors' in _result);
  checks.push({
    name: 'Inga fel i svar',
    passed: !hasError,
    detail: hasError
      ? `Felsvar: ${JSON.stringify(_result.error || _result.errors).slice(0, 200)}`
      : undefined,
  });

  // Check 3: Data integrity — if result has data, it should not be empty
  const hasEmptyData =
    _result &&
    typeof _result === 'object' &&
    'data' in _result &&
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

export const useAiQueueStore = create<AiQueueState>((set, get) => ({
  tasks: [],
  maxConcurrent: MAX_CONCURRENT,
  failureLog: [],
  _isProcessing: false,

  addTask: (input) => {
    const id = input.id || generateId();
    const task: QueueTask = {
      ...input,
      id,
      status: 'queued',
      createdAt: new Date().toISOString(),
    };
    set((s) => ({ tasks: [...s.tasks, task] }));
    setTimeout(() => get().processQueue(), 0);
    return id;
  },

  removeTask: (id) => set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),
  clearCompleted: () => set((s) => ({ tasks: s.tasks.filter((t) => t.status !== 'completed') })),
  clearFailureLog: () => set({ failureLog: [] }),

  cancelTask: (id) =>
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === id && t.status === 'queued' ? { ...t, status: 'blocked' as const } : t)),
    })),

  retryTask: (id) => {
    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === id && (t.status === 'failed' || t.status === 'blocked')
          ? { ...t, status: 'queued' as const, error: undefined, failureReport: undefined }
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

        // Block tasks whose dependencies failed
        const failedIds = new Set(current.tasks.filter((t) => t.status === 'failed').map((t) => t.id));
        let updatedTasks = current.tasks;
        for (const fid of failedIds) {
          updatedTasks = blockDependents(updatedTasks, fid);
        }

        // Find next runnable task sorted by priority
        const priorityOrder: Record<QueueTaskPriority, number> = { critical: 0, high: 1, normal: 2 };
        const completedIds = new Set(updatedTasks.filter((t) => t.status === 'completed').map((t) => t.id));

        const nextTask = updatedTasks
          .filter(
            (t) =>
              t.status === 'queued' &&
              (!t.dependsOn || t.dependsOn.every((dep) => completedIds.has(dep)))
          )
          .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])[0];

        if (!nextTask) {
          set({ tasks: updatedTasks });
          break;
        }

        // Mark as running
        set({
          tasks: updatedTasks.map((t) =>
            t.id === nextTask.id
              ? { ...t, status: 'running' as const, startedAt: new Date().toISOString() }
              : t
          ),
        });

        // Execute + validate
        if (nextTask.executor) {
          nextTask
            .executor()
            .then(async (result) => {
              // Move to validating
              set((s) => ({
                tasks: s.tasks.map((t) =>
                  t.id === nextTask.id ? { ...t, status: 'validating' as const, result } : t
                ),
              }));

              // Run post-execution checks
              const validate = nextTask.validator || defaultValidator;
              try {
                const checks = await validate(result);
                const anyFailed = checks.some((c) => !c.passed);

                if (anyFailed) {
                  const report = buildFailureReport(nextTask, checks);
                  set((s) => ({
                    tasks: blockDependents(
                      s.tasks.map((t) =>
                        t.id === nextTask.id
                          ? {
                              ...t,
                              status: 'failed' as const,
                              error: `Validering misslyckades: ${checks.filter((c) => !c.passed).length} kontroll(er)`,
                              failureReport: report,
                              completedAt: new Date().toISOString(),
                            }
                          : t
                      ),
                      nextTask.id
                    ),
                    failureLog: [...s.failureLog, report],
                  }));
                } else {
                  set((s) => ({
                    tasks: s.tasks.map((t) =>
                      t.id === nextTask.id
                        ? { ...t, status: 'completed' as const, completedAt: new Date().toISOString(), result }
                        : t
                    ),
                  }));
                }
              } catch (valErr) {
                // Validator itself crashed
                const report = buildFailureReport(nextTask, [
                  { name: 'Valideringsmotor', passed: false, detail: String(valErr) },
                ]);
                set((s) => ({
                  tasks: blockDependents(
                    s.tasks.map((t) =>
                      t.id === nextTask.id
                        ? {
                            ...t,
                            status: 'failed' as const,
                            error: 'Valideringsmotorn kraschade',
                            failureReport: report,
                            completedAt: new Date().toISOString(),
                          }
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
                      ? {
                          ...t,
                          status: 'failed' as const,
                          error: err?.message || String(err),
                          failureReport: report,
                          completedAt: new Date().toISOString(),
                        }
                      : t
                  ),
                  nextTask.id
                ),
                failureLog: [...s.failureLog, report],
              }));
              set({ _isProcessing: false });
              get().processQueue();
            });
        } else {
          // No executor — mark completed immediately
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
