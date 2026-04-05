/**
 * Action Verification Engine
 * 
 * Wraps any user/system action and tracks every step of execution:
 * 1. action_start  — action initiated
 * 2. backend_call  — API/RPC call made
 * 3. db_write      — database mutation sent
 * 4. db_confirm    — read-back confirms persistence
 * 5. ui_update     — cache invalidated / state updated
 * 
 * If any step fails the action is marked FAILED with the exact failure point.
 * Failures are automatically recorded to Functional Failure Memory.
 */
import { create } from 'zustand';
import { recordFailure } from '@/lib/failureMemory';
import { logData } from '@/utils/actionMonitor';

// ── Types ──

export type VerifyStep = 'action_start' | 'backend_call' | 'db_write' | 'db_confirm' | 'ui_update';

export interface StepRecord {
  step: VerifyStep;
  status: 'ok' | 'failed' | 'skipped';
  ts: number;
  detail?: string;
}

export interface ActionRecord {
  id: string;
  action: string;
  component: string;
  entityType: string;
  entityId?: string;
  startedAt: number;
  completedAt?: number;
  status: 'running' | 'ok' | 'failed';
  failedStep?: VerifyStep;
  failReason?: string;
  steps: StepRecord[];
  durationMs?: number;
}

// ── Store ──

interface ActionVerificationState {
  actions: ActionRecord[];
  maxActions: number;
  clear: () => void;
}

export const useActionVerificationStore = create<ActionVerificationState>((set) => ({
  actions: [],
  maxActions: 200,
  clear: () => set({ actions: [] }),
}));

// ── Helpers ──

let counter = 0;
const genId = () => `av-${++counter}-${Date.now()}`;

function pushAction(record: ActionRecord) {
  const store = useActionVerificationStore.getState();
  useActionVerificationStore.setState({
    actions: [...store.actions.slice(-(store.maxActions - 1)), record],
  });
}

function updateAction(id: string, patch: Partial<ActionRecord>) {
  useActionVerificationStore.setState(s => ({
    actions: s.actions.map(a => a.id === id ? { ...a, ...patch } : a),
  }));
}

// ── Core API ──

export interface VerifiedActionConfig<T> {
  /** Human-readable action name e.g. "Create work item" */
  action: string;
  /** Component triggering the action */
  component: string;
  /** Entity type being acted on */
  entityType: string;
  /** Steps to execute in order. Each returns the result or throws. */
  steps: {
    /** Which logical step this is */
    step: VerifyStep;
    /** Execute the step. Receives result of previous step. */
    run: (prev: any) => Promise<any>;
    /** If true, step is optional and failure won't stop the chain */
    optional?: boolean;
  }[];
}

export interface VerifiedResult<T = any> {
  ok: boolean;
  data: T | null;
  failedStep?: VerifyStep;
  failReason?: string;
  actionId: string;
  durationMs: number;
}

/**
 * Execute an action through the verification engine.
 * Each step is tracked and timed. On failure the exact step is recorded.
 */
export async function verifyAction<T = any>(config: VerifiedActionConfig<T>): Promise<VerifiedResult<T>> {
  const actionId = genId();
  const startedAt = Date.now();

  const record: ActionRecord = {
    id: actionId,
    action: config.action,
    component: config.component,
    entityType: config.entityType,
    startedAt,
    status: 'running',
    steps: [],
  };

  pushAction(record);
  logData({
    type: 'action',
    source: 'verification',
    payload: { action: config.action, component: config.component, entityType: config.entityType, step: 'start' },
    status: 'success',
  });

  let lastResult: any = null;

  for (const stepDef of config.steps) {
    const stepStart = Date.now();
    try {
      lastResult = await stepDef.run(lastResult);

      const stepRecord: StepRecord = {
        step: stepDef.step,
        status: 'ok',
        ts: Date.now(),
        detail: stepDef.step === 'db_confirm' && lastResult?.id
          ? `Verified id=${lastResult.id}`
          : undefined,
      };
      record.steps.push(stepRecord);

      logData({
        type: 'action',
        source: 'verification',
        payload: { action: config.action, component: config.component, step: stepDef.step, durationMs: Date.now() - stepStart },
        status: 'success',
      });

      // Capture entity ID from first result that has one
      if (lastResult?.id && !record.entityId) {
        record.entityId = lastResult.id;
      }

    } catch (err: any) {
      const reason = err?.message || 'Unknown error';
      const stepRecord: StepRecord = {
        step: stepDef.step,
        status: 'failed',
        ts: Date.now(),
        detail: reason,
      };
      record.steps.push(stepRecord);

      if (stepDef.optional) {
        continue;
      }

      // Mark action as failed
      record.status = 'failed';
      record.failedStep = stepDef.step;
      record.failReason = reason;
      record.completedAt = Date.now();
      record.durationMs = Date.now() - startedAt;

      updateAction(actionId, record);
      logData({
        type: 'error',
        source: 'verification',
        payload: { action: config.action, component: config.component, step: stepDef.step, reason, durationMs: record.durationMs },
        status: 'failed',
      });

      // Record to Functional Failure Memory (fire-and-forget)
      recordFailure({
        action: config.action,
        component: config.component,
        entityType: config.entityType,
        failedStep: stepDef.step,
        failReason: reason,
        severity: 'high',
      }).catch(() => {});

      return {
        ok: false,
        data: null,
        failedStep: stepDef.step,
        failReason: reason,
        actionId,
        durationMs: record.durationMs,
      };
    }
  }

  // All steps passed
  record.status = 'ok';
  record.completedAt = Date.now();
  record.durationMs = Date.now() - startedAt;

  updateAction(actionId, record);
  logData({
    type: 'action',
    source: 'verification',
    payload: { action: config.action, component: config.component, step: 'complete', durationMs: record.durationMs, entityId: record.entityId },
    status: 'success',
  });

  return {
    ok: true,
    data: lastResult as T,
    actionId,
    durationMs: record.durationMs,
  };
}
