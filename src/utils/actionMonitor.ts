/**
 * ActionMonitor
 *
 * Modular service for collecting and tracking action/scan/test data points.
 *
 * Interface:
 *   startMonitor()  — enable collection
 *   stopMonitor()   — disable collection
 *   logData(entry)  — record a data point (with automatic retry)
 *
 * Failures are persisted to localStorage under the key
 * "actionmonitor.log" (simulating /debug/logs/actionmonitor.log).
 */
import { create } from 'zustand';

// ── Types ──

export type MonitorEntryType =
  | 'scan_step'
  | 'scan_complete'
  | 'scan_error'
  | 'test_result'
  | 'endpoint_call'
  | 'manual';

export interface MonitorEntry {
  id: string;
  type: MonitorEntryType;
  timestamp: number;
  /** Page or component that generated this entry */
  page?: string;
  /** Endpoint or scan step identifier */
  endpoint?: string;
  /** Free-form payload */
  data?: Record<string, any>;
  /** Whether this entry was successfully recorded */
  ok: boolean;
  /** Error message when ok === false */
  error?: string;
  /** How many attempts were made */
  attempts: number;
}

export interface ActionMonitorState {
  /** Whether the monitor is actively collecting data */
  enabled: boolean;
  /** Collected data points (capped at maxEntries) */
  entries: MonitorEntry[];
  /** Failure log (mirrors /debug/logs/actionmonitor.log via localStorage) */
  failureLog: MonitorEntry[];
  /** Timestamp of last successful logData() call */
  lastSuccessAt: number | null;
  /** Total failures since last startMonitor() call */
  failureCount: number;
  maxEntries: number;
  maxFailureLog: number;

  // ── Controls ──
  startMonitor: () => void;
  stopMonitor: () => void;
  clearEntries: () => void;
  clearFailureLog: () => void;

  // ── Internal – use logData() from outside the store ──
  _pushEntry: (entry: MonitorEntry) => void;
  _pushFailure: (entry: MonitorEntry) => void;
}

const FAILURE_LOG_KEY = 'actionmonitor.log';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 500;

let entryCounter = 0;
const genId = () => `am-${++entryCounter}-${Date.now()}`;

// ── Persist / load failure log via localStorage ──

function loadPersistedFailures(): MonitorEntry[] {
  try {
    const raw = localStorage.getItem(FAILURE_LOG_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as MonitorEntry[];
  } catch {
    return [];
  }
}

function persistFailures(entries: MonitorEntry[]) {
  try {
    localStorage.setItem(FAILURE_LOG_KEY, JSON.stringify(entries.slice(-500)));
  } catch {
    // quota exceeded or SSR — silently ignore
  }
}

// ── Store ──

export const useActionMonitorStore = create<ActionMonitorState>((set, get) => ({
  enabled: true,
  entries: [],
  failureLog: loadPersistedFailures(),
  lastSuccessAt: null,
  failureCount: 0,
  maxEntries: 200,
  maxFailureLog: 500,

  startMonitor: () => {
    set({ enabled: true, failureCount: 0 });
    console.info('[ActionMonitor] Started');
  },

  stopMonitor: () => {
    set({ enabled: false });
    console.info('[ActionMonitor] Stopped');
  },

  clearEntries: () => set({ entries: [], lastSuccessAt: null }),

  clearFailureLog: () => {
    set({ failureLog: [], failureCount: 0 });
    try { localStorage.removeItem(FAILURE_LOG_KEY); } catch { /* ignore */ }
  },

  _pushEntry: (entry: MonitorEntry) => {
    set(s => ({
      entries: [...s.entries.slice(-(s.maxEntries - 1)), entry],
      lastSuccessAt: entry.ok ? entry.timestamp : s.lastSuccessAt,
    }));
  },

  _pushFailure: (entry: MonitorEntry) => {
    set(s => {
      const next = [...s.failureLog.slice(-(s.maxFailureLog - 1)), entry];
      persistFailures(next);
      return { failureLog: next, failureCount: s.failureCount + 1 };
    });
  },
}));

// ── Public API ──

/** Enable ActionMonitor data collection */
export function startMonitor() {
  useActionMonitorStore.getState().startMonitor();
}

/** Disable ActionMonitor data collection */
export function stopMonitor() {
  useActionMonitorStore.getState().stopMonitor();
}

/**
 * Log a data point to ActionMonitor.
 * Retries up to MAX_RETRIES times on failure.
 * Failures are written to the persisted failure log.
 */
export async function logData(input: {
  type: MonitorEntryType;
  page?: string;
  endpoint?: string;
  data?: Record<string, any>;
}): Promise<boolean> {
  const store = useActionMonitorStore.getState();
  if (!store.enabled) return false;

  const id = genId();
  let attempts = 0;
  let lastError: string | undefined;

  while (attempts < MAX_RETRIES) {
    attempts++;
    try {
      // Simulate the "recording" operation — in a real service this would
      // be a network call; here we record in-memory and to localStorage.
      const entry: MonitorEntry = {
        id,
        type: input.type,
        timestamp: Date.now(),
        page: input.page,
        endpoint: input.endpoint,
        data: input.data,
        ok: true,
        attempts,
      };

      useActionMonitorStore.getState()._pushEntry(entry);
      return true;
    } catch (err: any) {
      lastError = err?.message || 'Unknown error';
      if (attempts < MAX_RETRIES) {
        await sleep(RETRY_DELAY_MS * attempts);
      }
    }
  }

  // All retries exhausted — write to failure log
  const failEntry: MonitorEntry = {
    id,
    type: input.type,
    timestamp: Date.now(),
    page: input.page,
    endpoint: input.endpoint,
    data: input.data,
    ok: false,
    error: lastError,
    attempts,
  };
  useActionMonitorStore.getState()._pushFailure(failEntry);
  console.error('[ActionMonitor] logData failed after', attempts, 'attempts:', lastError);
  return false;
}

/** Check whether ActionMonitor is currently running */
export function isMonitorRunning(): boolean {
  return useActionMonitorStore.getState().enabled;
}

// ── Helpers ──

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
