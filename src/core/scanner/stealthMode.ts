/**
 * STEALTH MODE — invisible background scheduler.
 * UI surfaces hide themselves while ACTIVE. All output flows to systemStateRegistry.
 */
import { create } from "zustand";
import { runAndStore, useSystemStateStore, type ModuleKey } from "@/stores/systemStateStore";
import { systemStateRegistry } from "./systemStateRegistry";

export type StealthStatus = "ACTIVE" | "DISABLED";

export interface BackgroundTask {
  key: ModuleKey;
  run: () => Promise<unknown> | unknown;
  interval_ms: number;
}

interface HiddenLog {
  at: string;
  task: ModuleKey | "system";
  level: "info" | "error";
  msg: string;
}

interface StealthState {
  status: StealthStatus;
  started_at: string | null;
  disabled_reason: string | null;
  task_count: number;
  hidden_logs: HiddenLog[];
  last_run: Record<string, string>;
  enable: () => void;
  disable: (reason?: string) => void;
  log: (entry: Omit<HiddenLog, "at">) => void;
}

const MAX_LOGS = 200;

export const useStealthStore = create<StealthState>((set, get) => ({
  status: "DISABLED",
  started_at: null,
  disabled_reason: null,
  task_count: 0,
  hidden_logs: [],
  last_run: {},
  enable: () => {
    if (get().status === "ACTIVE") return;
    set({ status: "ACTIVE", started_at: new Date().toISOString(), disabled_reason: null });
    StealthScheduler.start();
  },
  disable: (reason) => {
    StealthScheduler.stop();
    set({ status: "DISABLED", disabled_reason: reason ?? null });
  },
  log: (entry) =>
    set((s) => ({
      hidden_logs: [{ at: new Date().toISOString(), ...entry }, ...s.hidden_logs].slice(0, MAX_LOGS),
    })),
}));

type IdleHandle = number;
type IdleCb = (deadline: { timeRemaining: () => number; didTimeout: boolean }) => void;
const ric: (cb: IdleCb, opts?: { timeout: number }) => IdleHandle =
  (typeof window !== "undefined" && (window as unknown as { requestIdleCallback?: typeof ric }).requestIdleCallback) ||
  ((cb) => window.setTimeout(() => cb({ timeRemaining: () => 8, didTimeout: true }), 250) as unknown as IdleHandle);
const cic: (h: IdleHandle) => void =
  (typeof window !== "undefined" && (window as unknown as { cancelIdleCallback?: typeof cic }).cancelIdleCallback) ||
  ((h) => window.clearTimeout(h as unknown as number));

class _StealthScheduler {
  private tasks: BackgroundTask[] = [];
  private handle: IdleHandle | null = null;
  private errorWindow: number[] = [];
  private longTaskObserver: PerformanceObserver | null = null;
  private longTaskHits = 0;

  register(task: BackgroundTask) {
    if (!this.tasks.find((t) => t.key === task.key)) {
      this.tasks.push(task);
      useStealthStore.setState({ task_count: this.tasks.length });
    }
  }

  start() {
    this.installLongTaskGuard();
    this.schedule();
  }

  stop() {
    if (this.handle != null) {
      cic(this.handle);
      this.handle = null;
    }
    this.longTaskObserver?.disconnect();
    this.longTaskObserver = null;
  }

  private schedule() {
    if (useStealthStore.getState().status !== "ACTIVE") return;
    this.handle = ric((deadline) => this.tick(deadline), { timeout: 1000 });
  }

  private async tick(deadline: { timeRemaining: () => number }) {
    const store = useStealthStore.getState();
    if (store.status !== "ACTIVE") return;
    const now = Date.now();
    for (const task of this.tasks) {
      if (deadline.timeRemaining() < 4) break;
      const last = store.last_run[task.key];
      const lastMs = last ? Date.parse(last) : 0;
      if (now - lastMs < task.interval_ms) continue;
      try {
        const slot = await runAndStore(task.key, task.run);
        useStealthStore.setState((s) => ({
          last_run: { ...s.last_run, [task.key]: new Date().toISOString() },
        }));
        if (slot.health === "error") this.recordError(task.key, slot.error ?? "unknown");
      } catch (err) {
        this.recordError(task.key, err instanceof Error ? err.message : String(err));
      }
    }
    window.setTimeout(() => this.schedule(), 1500);
  }

  private recordError(task: ModuleKey, msg: string) {
    useStealthStore.getState().log({ task, level: "error", msg });
    const now = Date.now();
    this.errorWindow.push(now);
    this.errorWindow = this.errorWindow.filter((t) => now - t < 30_000);
    if (this.errorWindow.length >= 5) {
      useStealthStore.getState().disable(`auto-disabled: ${this.errorWindow.length} errors in 30s`);
    }
  }

  private installLongTaskGuard() {
    if (typeof PerformanceObserver === "undefined") return;
    try {
      this.longTaskObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.duration > 200) {
            this.longTaskHits++;
            if (this.longTaskHits >= 3) {
              useStealthStore.getState().disable(
                `auto-disabled: ${this.longTaskHits} long tasks (>200ms) detected`,
              );
            }
          }
        }
      });
      this.longTaskObserver.observe({ entryTypes: ["longtask"] });
    } catch {}
  }
}

export const StealthScheduler = new _StealthScheduler();

StealthScheduler.register({
  key: "reality_check",
  interval_ms: 15_000,
  run: () => {
    const snap = systemStateRegistry.snapshot();
    return {
      valid: snap.total_records,
      invalid: snap.invalid_states.length,
      rejected: snap.invalid_states.length,
      generated_at: snap.generated_at,
    };
  },
});

StealthScheduler.register({
  key: "drift_detector",
  interval_ms: 30_000,
  run: () => {
    const slots = useSystemStateStore.getState().slots;
    const stale: string[] = [];
    const now = Date.now();
    for (const [k, v] of Object.entries(slots)) {
      if (v.updated_at && now - Date.parse(v.updated_at) > 5 * 60_000) stale.push(k);
    }
    return { stale_modules: stale, checked_at: new Date().toISOString() };
  },
});
