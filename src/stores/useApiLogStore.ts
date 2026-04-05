import { create } from 'zustand';

export interface ApiLogEntry {
  traceId: string;
  functionName: string;
  method: 'GET' | 'POST';
  timestamp: number;
  attempt: number;
  status: 'pending' | 'success' | 'error' | 'blocked';
  durationMs?: number;
  errorMessage?: string;
}

interface ApiLogState {
  entries: ApiLogEntry[];
  /** Push a new log entry (capped at 100). */
  push: (entry: ApiLogEntry) => void;
  /** Update the last entry with a matching traceId + attempt. */
  update: (traceId: string, attempt: number, patch: Partial<ApiLogEntry>) => void;
  clear: () => void;
}

const MAX_ENTRIES = 100;

export const useApiLogStore = create<ApiLogState>((set) => ({
  entries: [],

  push: (entry) =>
    set((s) => ({
      entries: [entry, ...s.entries].slice(0, MAX_ENTRIES),
    })),

  update: (traceId, attempt, patch) =>
    set((s) => ({
      entries: s.entries.map((e) =>
        e.traceId === traceId && e.attempt === attempt ? { ...e, ...patch } : e
      ),
    })),

  clear: () => set({ entries: [] }),
}));
