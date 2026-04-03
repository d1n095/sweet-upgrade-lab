/**
 * ActionMonitor
 *
 * Single source of truth for all action/scan/test/error events.
 * Always logs — no toggle states, no silent disables.
 *
 * Public API:
 *   startMonitor()  — reset counters and mark as started
 *   stopMonitor()   — mark as stopped (logging continues)
 *   logData(event)  — record an event (retries 3×, then persists to failure log)
 *   getStatus()     — returns "OK" | "DEGRADED" | "FAILED"
 */
import { create } from 'zustand';

// ── Types ──

export type MonitorEventType = 'scan' | 'test' | 'action' | 'error';
export type MonitorEventSource = 'scanner' | 'verification' | 'ui' | 'system';

export interface MonitorEvent {
  id: string;
  type: MonitorEventType;
  source: MonitorEventSource;
  timestamp: number;
  payload: any;
  status?: 'success' | 'failed';
  /** How many attempts were made to record this event */
  attempts: number;
  /** Error message when recording failed */
  error?: string;
}

export type MonitorStatus = 'OK' | 'DEGRADED' | 'FAILED';

export interface ActionMonitorState {
  /** All recorded events (capped at maxEvents) */
  events: MonitorEvent[];
  /** Most recently recorded event */
  lastEvent: MonitorEvent | null;
  /** Events that could not be recorded after all retries */
  failures: MonitorEvent[];
  /** Timestamp of last successful logData() call */
  lastSuccessTimestamp: number | null;
  /** Whether startMonitor() has been called */
  running: boolean;

  maxEvents: number;
  maxFailures: number;

  // ── Controls ──
  startMonitor: () => void;
  stopMonitor: () => void;
  clearEvents: () => void;
  clearFailures: () => void;

  // ── Internal – use logData() from outside the store ──
  _pushEvent: (event: MonitorEvent) => void;
  _pushFailure: (event: MonitorEvent) => void;
}

const FAILURE_LOG_KEY = 'actionmonitor.log';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 500;

let eventCounter = 0;
const genId = () => `am-${++eventCounter}-${Date.now()}`;

// ── Persist / load failure log via localStorage ──

function loadPersistedFailures(): MonitorEvent[] {
  try {
    const raw = localStorage.getItem(FAILURE_LOG_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as MonitorEvent[];
  } catch {
    return [];
  }
}

function persistFailures(entries: MonitorEvent[]) {
  try {
    localStorage.setItem(FAILURE_LOG_KEY, JSON.stringify(entries.slice(-500)));
  } catch {
    // quota exceeded or SSR — silently ignore
  }
}

// ── Store ──

export const useActionMonitorStore = create<ActionMonitorState>((set, get) => ({
  events: [],
  lastEvent: null,
  failures: loadPersistedFailures(),
  lastSuccessTimestamp: null,
  running: false,
  maxEvents: 200,
  maxFailures: 500,

  startMonitor: () => {
    set({ running: true, events: [], failures: [], lastSuccessTimestamp: null });
    console.info('[ActionMonitor] Started');
  },

  stopMonitor: () => {
    set({ running: false });
    console.info('[ActionMonitor] Stopped');
  },

  clearEvents: () => set({ events: [], lastEvent: null, lastSuccessTimestamp: null }),

  clearFailures: () => {
    set({ failures: [] });
    try { localStorage.removeItem(FAILURE_LOG_KEY); } catch { /* ignore */ }
  },

  _pushEvent: (event: MonitorEvent) => {
    set(s => ({
      events: [...s.events.slice(-(s.maxEvents - 1)), event],
      lastEvent: event,
      lastSuccessTimestamp: event.timestamp,
    }));
  },

  _pushFailure: (event: MonitorEvent) => {
    set(s => {
      const next = [...s.failures.slice(-(s.maxFailures - 1)), event];
      persistFailures(next);
      return { failures: next, lastEvent: event };
    });
  },
}));

// ── Public API ──

/** Enable ActionMonitor data collection and reset state */
export function startMonitor() {
  useActionMonitorStore.getState().startMonitor();
}

/** Mark monitor as stopped (events continue to be stored) */
export function stopMonitor() {
  useActionMonitorStore.getState().stopMonitor();
}

/**
 * Log an event to ActionMonitor.
 * Always records — never silently discarded.
 * Retries up to MAX_RETRIES times on failure.
 * Persistent failures are written to localStorage (simulating /debug/logs/actionmonitor.log).
 */
export async function logData(input: {
  type: MonitorEventType;
  source: MonitorEventSource;
  timestamp?: number;
  payload: any;
  status?: 'success' | 'failed';
}): Promise<boolean> {
  const id = genId();
  let attempts = 0;
  let lastError: string | undefined;

  while (attempts < MAX_RETRIES) {
    attempts++;
    try {
      const event: MonitorEvent = {
        id,
        type: input.type,
        source: input.source,
        timestamp: input.timestamp ?? Date.now(),
        payload: input.payload,
        status: input.status,
        attempts,
      };

      useActionMonitorStore.getState()._pushEvent(event);
      return true;
    } catch (err: any) {
      lastError = err?.message || 'Unknown error';
      if (attempts < MAX_RETRIES) {
        await sleep(RETRY_DELAY_MS * attempts);
      }
    }
  }

  // All retries exhausted — write to failure log
  const failEvent: MonitorEvent = {
    id,
    type: input.type,
    source: input.source,
    timestamp: input.timestamp ?? Date.now(),
    payload: input.payload,
    status: 'failed',
    error: lastError,
    attempts,
  };
  useActionMonitorStore.getState()._pushFailure(failEvent);
  console.error('[ActionMonitor] logData failed after', attempts, 'attempts:', lastError);
  return false;
}

/**
 * Returns the overall health status of the ActionMonitor.
 * - OK      — no failures in current session
 * - DEGRADED — 1–4 failures
 * - FAILED  — 5+ failures or store is not running
 */
export function getStatus(): MonitorStatus {
  const { failures, running } = useActionMonitorStore.getState();
  if (!running) return 'FAILED';
  if (failures.length === 0) return 'OK';
  if (failures.length < 5) return 'DEGRADED';
  return 'FAILED';
}

/** Check whether ActionMonitor is currently running */
export function isMonitorRunning(): boolean {
  return useActionMonitorStore.getState().running;
}

// ── Helpers ──

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
