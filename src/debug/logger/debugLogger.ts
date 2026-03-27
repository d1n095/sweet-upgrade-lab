/**
 * Debug Logger — Global DEBUG mode (TASK 3).
 * Log ALL errors with: file, function, stack trace. Detect silent failures.
 */
import { create } from 'zustand';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'critical';

export interface LogEntry {
  id: string;
  level: LogLevel;
  file: string;
  fn?: string;
  message: string;
  details?: Record<string, any>;
  stack?: string;
  timestamp: number;
}

const STORAGE_KEY = 'debug_log';
const MAX_ENTRIES = 1000;
let idCounter = 0;
const genId = () => `log-${Date.now()}-${++idCounter}`;

function persistToStorage(entries: LogEntry[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(-MAX_ENTRIES))); } catch { /* ignore */ }
}

function loadFromStorage(): LogEntry[] {
  try { const raw = localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : []; } catch { return []; }
}

interface DebugLoggerState {
  enabled: boolean;
  entries: LogEntry[];
  silentFailures: LogEntry[];
  toggle: () => void;
  enable: () => void;
  disable: () => void;
  clear: () => void;
  addEntry: (entry: Omit<LogEntry, 'id' | 'timestamp'>) => void;
  exportLog: () => string;
  filterByLevel: (level: LogLevel) => LogEntry[];
  filterByFile: (file: string) => LogEntry[];
}

export const useDebugLoggerStore = create<DebugLoggerState>((set, get) => ({
  enabled: false,
  entries: loadFromStorage(),
  silentFailures: [],
  toggle: () => set(s => ({ enabled: !s.enabled })),
  enable: () => set({ enabled: true }),
  disable: () => set({ enabled: false }),
  clear: () => { set({ entries: [], silentFailures: [] }); try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ } },
  addEntry: (entry) => {
    if (!get().enabled) return;
    const full: LogEntry = { ...entry, id: genId(), timestamp: Date.now() };
    set(s => {
      const entries = [...s.entries, full].slice(-MAX_ENTRIES);
      persistToStorage(entries);
      const silentFailures = entry.level === 'error' && !entry.message.toLowerCase().includes('toast')
        ? [...s.silentFailures, full].slice(-200) : s.silentFailures;
      return { entries, silentFailures };
    });
  },
  exportLog: () => get().entries.map(e => {
    const ts = new Date(e.timestamp).toISOString();
    const loc = e.fn ? `${e.file}::${e.fn}` : e.file;
    const details = e.details ? `\n  details: ${JSON.stringify(e.details)}` : '';
    const stack = e.stack ? `\n  stack: ${e.stack}` : '';
    return `[${ts}] [${e.level.toUpperCase()}] [${loc}] ${e.message}${details}${stack}`;
  }).join('\n'),
  filterByLevel: (level) => get().entries.filter(e => e.level === level),
  filterByFile: (file) => get().entries.filter(e => e.file.toLowerCase().includes(file.toLowerCase())),
}));

export function debugLog(file: string, message: string, details?: Record<string, any>, fn?: string) {
  useDebugLoggerStore.getState().addEntry({ level: 'debug', file, fn, message, details });
}
export function debugInfo(file: string, message: string, details?: Record<string, any>, fn?: string) {
  useDebugLoggerStore.getState().addEntry({ level: 'info', file, fn, message, details });
}
export function debugWarn(file: string, message: string, details?: Record<string, any>, fn?: string) {
  useDebugLoggerStore.getState().addEntry({ level: 'warn', file, fn, message, details });
  if (useDebugLoggerStore.getState().enabled) console.warn(`[DebugLogger][WARN][${file}${fn ? '::' + fn : ''}]`, message, details || '');
}
export function debugError(file: string, message: string, err?: unknown, details?: Record<string, any>, fn?: string) {
  useDebugLoggerStore.getState().addEntry({ level: 'error', file, fn, message, details, stack: err instanceof Error ? err.stack : undefined });
  if (useDebugLoggerStore.getState().enabled) console.error(`[DebugLogger][ERROR][${file}${fn ? '::' + fn : ''}]`, message, err || '', details || '');
}
export function debugCritical(file: string, message: string, err?: unknown, details?: Record<string, any>, fn?: string) {
  useDebugLoggerStore.getState().addEntry({ level: 'critical', file, fn, message, details, stack: err instanceof Error ? err.stack : undefined });
  console.error(`[DebugLogger][CRITICAL][${file}${fn ? '::' + fn : ''}]`, message, err || '', details || '');
}
