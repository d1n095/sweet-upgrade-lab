import { create } from 'zustand';

export type QueueTaskStatus = 'queued' | 'running' | 'completed' | 'failed' | 'blocked';
export type QueueTaskPriority = 'critical' | 'high' | 'normal';

export interface QueueTask {
  id: string;
  title: string;
  description?: string;
  status: QueueTaskStatus;
  priority: QueueTaskPriority;
  dependsOn?: string[]; // IDs of tasks this depends on
  error?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  executor?: () => Promise<any>;
  result?: any;
}

const MAX_CONCURRENT = 2;

interface AiQueueState {
  tasks: QueueTask[];
  maxConcurrent: number;
  addTask: (task: Omit<QueueTask, 'id' | 'status' | 'createdAt'> & { id?: string }) => string;
  removeTask: (id: string) => void;
  clearCompleted: () => void;
  processQueue: () => Promise<void>;
  retryTask: (id: string) => void;
  cancelTask: (id: string) => void;
  _isProcessing: boolean;
}

const generateId = () => `qt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

export const useAiQueueStore = create<AiQueueState>((set, get) => ({
  tasks: [],
  maxConcurrent: MAX_CONCURRENT,
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
    // Auto-process after adding
    setTimeout(() => get().processQueue(), 0);
    return id;
  },

  removeTask: (id) => set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),

  clearCompleted: () => set((s) => ({ tasks: s.tasks.filter((t) => t.status !== 'completed') })),

  cancelTask: (id) =>
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === id && t.status === 'queued' ? { ...t, status: 'blocked' as const } : t)),
    })),

  retryTask: (id) => {
    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === id && (t.status === 'failed' || t.status === 'blocked')
          ? { ...t, status: 'queued' as const, error: undefined }
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
        const running = current.tasks.filter((t) => t.status === 'running');
        if (running.length >= current.maxConcurrent) break;

        // Block tasks whose dependencies failed
        const failedIds = new Set(current.tasks.filter((t) => t.status === 'failed').map((t) => t.id));
        const updatedTasks = current.tasks.map((t) => {
          if (
            t.status === 'queued' &&
            t.dependsOn?.some((dep) => failedIds.has(dep))
          ) {
            return { ...t, status: 'blocked' as const, error: 'Beroende uppgift misslyckades' };
          }
          return t;
        });

        // Find next runnable task sorted by priority
        const priorityOrder: Record<QueueTaskPriority, number> = { critical: 0, high: 1, normal: 2 };
        const pendingDoneIds = new Set(
          updatedTasks.filter((t) => t.status === 'completed').map((t) => t.id)
        );
        const runningIds = new Set(running.map((t) => t.id));

        const nextTask = updatedTasks
          .filter(
            (t) =>
              t.status === 'queued' &&
              !t.dependsOn?.some(
                (dep) => !pendingDoneIds.has(dep) && !runningIds.has(dep) ? true : false
              ) &&
              // All deps must be completed
              (!t.dependsOn || t.dependsOn.every((dep) => pendingDoneIds.has(dep)))
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

        // Execute
        if (nextTask.executor) {
          nextTask
            .executor()
            .then((result) => {
              set((s) => ({
                tasks: s.tasks.map((t) =>
                  t.id === nextTask.id
                    ? { ...t, status: 'completed' as const, completedAt: new Date().toISOString(), result }
                    : t
                ),
              }));
              // Continue processing
              set({ _isProcessing: false });
              get().processQueue();
            })
            .catch((err) => {
              set((s) => ({
                tasks: s.tasks.map((t) =>
                  t.id === nextTask.id
                    ? { ...t, status: 'failed' as const, error: err?.message || String(err), completedAt: new Date().toISOString() }
                    : t
                ),
              }));
              // Block dependents and continue
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

        // Only start up to max concurrent
        if (running.length + 1 >= current.maxConcurrent) break;
      }
    } finally {
      set({ _isProcessing: false });
    }
  },
}));
