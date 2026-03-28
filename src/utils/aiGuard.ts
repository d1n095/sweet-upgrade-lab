/**
 * aiGuard — Global AI observability layer.
 *
 * Provides a single `logAICall()` function that:
 *  - Writes a structured `[AI TRACE]` entry to the console
 *  - Appends the event to an in-memory ring buffer (last MAX_EVENTS entries)
 *  - Exposes a Zustand store so React components can subscribe to events
 */
import { create } from 'zustand';

// ── Types ──────────────────────────────────────────────────────────────────

export interface AIEvent {
  id: string;
  time: string;
  source: string;
  file?: string;
  action?: string;
  status: 'ATTEMPT' | 'BLOCKED' | 'EXECUTED';
  payload?: any;
}

interface AIGuardState {
  events: AIEvent[];
  _push: (event: AIEvent) => void;
  clear: () => void;
}

// ── Internals ───────────────────────────────────────────────────────────────

let _counter = 0;
const genId = () => `aig-${++_counter}-${Date.now()}`;
const MAX_EVENTS = 200;

// ── Store ───────────────────────────────────────────────────────────────────

export const useAIGuardStore = create<AIGuardState>((set) => ({
  events: [],
  _push: (event) =>
    set((s) => ({ events: [...s.events.slice(-(MAX_EVENTS - 1)), event] })),
  clear: () => set({ events: [] }),
}));

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Log an AI call event (ATTEMPT / BLOCKED / EXECUTED).
 * Always writes to console and to the in-memory store.
 */
export function logAICall(event: {
  source: string;
  file?: string;
  action?: string;
  status: 'ATTEMPT' | 'BLOCKED' | 'EXECUTED';
  payload?: any;
}): void {
  const e: AIEvent = {
    id: genId(),
    time: new Date().toISOString(),
    ...event,
  };
  console.log('[AI TRACE]', e);
  useAIGuardStore.getState()._push(e);
}

// ── Selectors ───────────────────────────────────────────────────────────────

/** Returns aggregate summary counts */
export function getAISummary(): { attempted: number; blocked: number; executed: number } {
  const { events } = useAIGuardStore.getState();
  return {
    attempted: events.filter((e) => e.status === 'ATTEMPT').length,
    blocked: events.filter((e) => e.status === 'BLOCKED').length,
    executed: events.filter((e) => e.status === 'EXECUTED').length,
  };
}
