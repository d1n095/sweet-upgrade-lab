import { create } from 'zustand';

export type LockArea = 'bugs' | 'scans' | 'ui' | 'pipeline';

export interface AreaLock {
  area: LockArea;
  lockedBy: string; // task id
  lockedAt: string;
  description?: string;
}

export interface LockConflict {
  taskId: string;
  taskTitle: string;
  requestedArea: LockArea;
  blockedBy: string; // task id holding the lock
  detectedAt: string;
  resolved: boolean;
}

/** Maps a task item_type / source_type / scan_type to a lock area */
export function resolveArea(hint?: string): LockArea | null {
  if (!hint) return null;
  const h = hint.toLowerCase();
  if (['bug', 'bug_report', 'bug_fix'].includes(h)) return 'bugs';
  if (['scan', 'system_scan', 'data_integrity', 'content_validation', 'sync_scan', 'feature_detection', 'visual_qa', 'nav_scan', 'ux_scan', 'human_test'].includes(h)) return 'scans';
  if (['ui', 'interaction_qa', 'ui_fix', 'visual'].includes(h)) return 'ui';
  if (['pipeline', 'action_governor', 'verification', 'work_item', 'change_log'].includes(h)) return 'pipeline';
  return null;
}

/** Maximum lock age in milliseconds before auto-release (5 minutes) */
const LOCK_TIMEOUT_MS = 5 * 60 * 1000;

interface ExecutionLockState {
  locks: AreaLock[];
  conflicts: LockConflict[];

  /** Try to acquire a lock. Returns true if acquired, false if conflict. */
  acquire: (area: LockArea, taskId: string, description?: string) => boolean;

  /** Release a lock held by a task. */
  release: (taskId: string) => void;

  /** Release all locks for a specific area. */
  releaseArea: (area: LockArea) => void;

  /** Check if an area is currently locked (auto-releases stale locks). */
  isLocked: (area: LockArea) => boolean;

  /** Get the lock holder for an area. */
  getHolder: (area: LockArea) => AreaLock | undefined;

  /** Log a conflict when a task is blocked. */
  logConflict: (taskId: string, taskTitle: string, area: LockArea, blockedBy: string) => void;

  /** Clear resolved conflicts. */
  clearConflicts: () => void;

  /** Get all active locks. */
  getActiveLocks: () => AreaLock[];

  /** Force-release all stale locks (older than timeout). Returns count released. */
  releaseStale: () => number;
}

function isStale(lock: AreaLock): boolean {
  return Date.now() - new Date(lock.lockedAt).getTime() > LOCK_TIMEOUT_MS;
}

export const useExecutionLockStore = create<ExecutionLockState>((set, get) => ({
  locks: [],
  conflicts: [],

  acquire: (area, taskId, description) => {
    // Auto-release stale locks first
    const now = Date.now();
    const freshLocks = get().locks.filter(l => {
      if (isStale(l)) {
        return false;
      }
      return true;
    });

    const existing = freshLocks.find(l => l.area === area);
    if (existing && existing.lockedBy !== taskId) {
      // Conflict — area is locked by another task
      set({ locks: freshLocks });
      return false;
    }
    if (existing && existing.lockedBy === taskId) {
      set({ locks: freshLocks });
      return true;
    }
    set({
      locks: [...freshLocks, { area, lockedBy: taskId, lockedAt: new Date().toISOString(), description }],
    });
    return true;
  },

  release: (taskId) => {
    set(s => ({
      locks: s.locks.filter(l => l.lockedBy !== taskId),
      conflicts: s.conflicts.map(c =>
        c.blockedBy === taskId ? { ...c, resolved: true } : c
      ),
    }));
  },

  releaseArea: (area) => {
    set(s => ({
      locks: s.locks.filter(l => l.area !== area),
      conflicts: s.conflicts.map(c =>
        c.requestedArea === area ? { ...c, resolved: true } : c
      ),
    }));
  },

  isLocked: (area) => {
    // Clean stale locks on check
    const locks = get().locks.filter(l => !isStale(l));
    if (locks.length !== get().locks.length) {
      set({ locks });
    }
    return !!locks.find(l => l.area === area);
  },

  getHolder: (area) => {
    const lock = get().locks.find(l => l.area === area);
    if (lock && isStale(lock)) {
      set(s => ({ locks: s.locks.filter(l => l.area !== area) }));
      return undefined;
    }
    return lock;
  },

  logConflict: (taskId, taskTitle, area, blockedBy) => {
    set(s => ({
      conflicts: [...s.conflicts, {
        taskId, taskTitle, requestedArea: area, blockedBy,
        detectedAt: new Date().toISOString(), resolved: false,
      }],
    }));
  },

  clearConflicts: () => set(s => ({ conflicts: s.conflicts.filter(c => !c.resolved) })),

  getActiveLocks: () => get().locks.filter(l => !isStale(l)),

  releaseStale: () => {
    const stale = get().locks.filter(isStale);
    if (stale.length > 0) {
      set(s => ({
        locks: s.locks.filter(l => !isStale(l)),
        conflicts: s.conflicts.map(c =>
          stale.some(sl => sl.lockedBy === c.blockedBy) ? { ...c, resolved: true } : c
        ),
      }));
    }
    return stale.length;
  },
}));
