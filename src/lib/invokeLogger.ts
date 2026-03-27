/**
 * invokeLogger — in-memory log of every edge-function call made during this
 * browser session.  Populated by the global invoke guard in client.ts and
 * readable from the AdminSystemMonitor page.
 */

export type InvokeStatus = 'blocked' | 'success' | 'error' | 'pending';

export interface InvokeLogEntry {
  id: string;
  fn: string;
  calledAt: string;   // ISO timestamp
  status: InvokeStatus;
  /** ms taken (undefined while pending) */
  durationMs?: number;
  errorMessage?: string;
  payload?: Record<string, any>;
}

const MAX_ENTRIES = 500;

// Module-level array — persists for the lifetime of the tab.
const _log: InvokeLogEntry[] = [];

/** Add a new entry and return its id so the caller can update it later. */
export function logInvokeStart(fn: string, payload?: Record<string, any>): string {
  const id = crypto.randomUUID();
  const entry: InvokeLogEntry = {
    id,
    fn,
    calledAt: new Date().toISOString(),
    status: 'pending',
    payload,
  };
  _log.unshift(entry);
  if (_log.length > MAX_ENTRIES) _log.length = MAX_ENTRIES;
  return id;
}

/** Update an existing entry (by id) with a final status and duration. */
export function logInvokeEnd(
  id: string,
  status: InvokeStatus,
  durationMs: number,
  errorMessage?: string
) {
  const entry = _log.find(e => e.id === id);
  if (!entry) return;
  entry.status = status;
  entry.durationMs = durationMs;
  if (errorMessage) entry.errorMessage = errorMessage;
}

/** Log a blocked call immediately (no start/end lifecycle needed). */
export function logInvokeBlocked(fn: string, reason: string) {
  const entry: InvokeLogEntry = {
    id: crypto.randomUUID(),
    fn,
    calledAt: new Date().toISOString(),
    status: 'blocked',
    errorMessage: reason,
    durationMs: 0,
  };
  _log.unshift(entry);
  if (_log.length > MAX_ENTRIES) _log.length = MAX_ENTRIES;
}

/** Return a snapshot copy of the log. */
export function getInvokeLog(): InvokeLogEntry[] {
  return [..._log];
}

/** Clear the log. */
export function clearInvokeLog() {
  _log.length = 0;
}
