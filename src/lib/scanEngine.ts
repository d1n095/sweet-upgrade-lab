/**
 * GLOBAL SCAN ENGINE
 * - One engine for all scan types
 * - Collision prevention via currentJob guard
 * - localStorage persistence for background/refresh survival
 * - On-load resume of interrupted jobs
 */

import { useFullScanOrchestrator } from '@/stores/fullScanOrchestrator';

export type ScanJobType = 'system' | 'ux' | 'sync' | 'actions';
export type ScanJobStatus = 'running' | 'done' | 'error';

export interface ScanJob {
  id: number;
  type: ScanJobType;
  status: ScanJobStatus;
}

const STORAGE_KEY = 'scanJob';

let currentJob: ScanJob | null = null;

/** Persist current job to localStorage so it survives page refresh */
function persistJob(job: ScanJob | null) {
  if (job) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(job));
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

/** Execute the underlying scan for a given type */
async function runFrontendScan(type: ScanJobType): Promise<void> {
  // All scan types run through the unified full-scan orchestrator
  const orchestrator = useFullScanOrchestrator.getState();

  await orchestrator.runOrchestrated();
}

/**
 * Start a scan job.
 * Returns immediately if a job is already running.
 */
export const startScanJob = async (type: ScanJobType): Promise<void> => {
  if (currentJob) {

    return;
  }

  currentJob = {
    id: Date.now(),
    type,
    status: 'running',
  };

  persistJob(currentJob);



  try {
    await runFrontendScan(type);
    currentJob.status = 'done';
    persistJob(currentJob);
  } catch (err) {

    if (currentJob) {
      currentJob.status = 'error';
      persistJob(currentJob);
    }
  } finally {
    setTimeout(() => {
      currentJob = null;
      persistJob(null);
    }, 1000);
  }
};

/** Return current job state (read-only snapshot) */
export const getCurrentJob = (): ScanJob | null => currentJob;

/**
 * On app load: check localStorage for an interrupted running job and resume it.
 * Call this once at startup (e.g. from App.tsx or a top-level effect).
 */
export function resumeInterruptedJob(): void {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;

    const job: ScanJob = JSON.parse(saved);

    if (job.status === 'running') {

      // Small delay so stores are initialised before the scan starts
      setTimeout(() => startScanJob(job.type), 500);
    } else {
      // Clean up stale non-running entries
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}
