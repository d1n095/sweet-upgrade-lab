/**
 * FixExecutionLog
 *
 * Tracks fix execution history.
 * Fields: action_id, result, success/failure.
 */
import { create } from 'zustand';
import type { FixResult } from './AutoFixEngine';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface FixLogEntry {
  id: string;
  action_id: string;
  ts: number;
  success: boolean;
  simulated: boolean;
  fix_type: string;
  execution_mode: string;
  message: string;
  error?: string;
}

interface FixExecutionLogState {
  entries: FixLogEntry[];
  maxEntries: number;
  log: (result: FixResult) => void;
  clear: () => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

let logCounter = 0;
const genLogId = () => `fix-log-${++logCounter}-${Date.now()}`;

// ── Store ──────────────────────────────────────────────────────────────────────

export const useFixExecutionLog = create<FixExecutionLogState>((set) => ({
  entries: [],
  maxEntries: 200,

  log: (result: FixResult) =>
    set((s) => {
      const entry: FixLogEntry = {
        id: genLogId(),
        action_id: result.action_id,
        ts: Date.now(),
        success: result.success,
        simulated: result.simulated,
        fix_type: result.fix_type,
        execution_mode: result.execution_mode,
        message: result.message,
        error: result.error,
      };
      return {
        entries: [...s.entries.slice(-(s.maxEntries - 1)), entry],
      };
    }),

  clear: () => set({ entries: [] }),
}));
