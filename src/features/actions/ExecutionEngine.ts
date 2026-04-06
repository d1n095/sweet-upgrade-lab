/**
 * ExecutionEngine
 *
 * Safe execution layer for the AutoFix system.
 *
 * Rules enforced:
 *  - NO backend calls (no supabase, no safeInvoke, no fetch)
 *  - NO schema / edge-function / core-system changes
 *  - ALL execution is simulated and fully reversible
 *  - High-risk actions are blocked at the engine level
 *  - Every execution snapshot is stored for rollback
 */

import type { SystemAction, FixType } from './AutoFixEngine';
import { mapActionToFix } from './AutoFixEngine';

// ── Allowed & blocked fix types ────────────────────────────────────────────────

const ALLOWED_FIX_TYPES: FixType[] = ['ui_fix', 'config_fix', 'data_fix'];

/** Keywords that indicate a blocked (destructive / core) operation. */
const BLOCKED_KEYWORDS = [
  'schema',
  'migration',
  'drop',
  'truncate',
  'delete_all',
  'edge_function',
  'run-full-scan',
  'supabase',
  'core_system',
  'pipeline',
  'unifiedpipeline',
  'scanengine',
  'safeinvoke',
];

// ── Dry-run types ──────────────────────────────────────────────────────────────

export type RiskLevel = 'low' | 'medium' | 'high';

export interface DryRunResult {
  action_id: string;
  impact: string;
  files_affected: string[];
  risk: RiskLevel;
  blocked: boolean;
  block_reason?: string;
}

// ── Execution types ────────────────────────────────────────────────────────────

export interface ChangeRecord {
  field: string;
  before: unknown;
  after: unknown;
}

export interface ExecutionResult {
  action_id: string;
  success: boolean;
  changes_applied: ChangeRecord[];
  rollback_available: boolean;
  message: string;
  error?: string;
}

// ── Rollback snapshot ──────────────────────────────────────────────────────────

export interface RollbackSnapshot {
  action_id: string;
  before_state: ChangeRecord[];
  after_state: ChangeRecord[];
  timestamp: number;
  action: SystemAction;
}

export interface RollbackResult {
  action_id: string;
  success: boolean;
  message: string;
  error?: string;
}

// ── In-memory rollback store ───────────────────────────────────────────────────

const _rollbackStore = new Map<string, RollbackSnapshot>();

export function getRollbackSnapshot(action_id: string): RollbackSnapshot | undefined {
  return _rollbackStore.get(action_id);
}

export function clearRollbackStore(): void {
  _rollbackStore.clear();
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function isBlocked(action: SystemAction): { blocked: true; reason: string } | { blocked: false } {
  const haystack = [
    action.action,
    action.component,
    action.entityType,
    action.fix_hint ?? '',
  ]
    .join(' ')
    .toLowerCase();

  for (const kw of BLOCKED_KEYWORDS) {
    if (haystack.includes(kw)) {
      return { blocked: true, reason: `Blocked keyword detected: "${kw}"` };
    }
  }

  return { blocked: false };
}

function deriveRisk(action: SystemAction): RiskLevel {
  const mapping = mapActionToFix(action);

  if (mapping.type === 'data_fix') return 'medium';
  if (mapping.type === 'config_fix') return 'low';

  const act = action.action.toLowerCase();
  if (
    act.includes('delete') ||
    act.includes('remove') ||
    act.includes('reset') ||
    act.includes('wipe')
  ) {
    return 'high';
  }

  return 'low';
}

function buildFilesAffected(action: SystemAction): string[] {
  const mapping = mapActionToFix(action);
  const files: string[] = [];

  if (mapping.type === 'ui_fix') {
    files.push(`src/components/${action.component}.tsx`);
  } else if (mapping.type === 'data_fix') {
    files.push(`[DB record] ${action.entityType}${action.entityId ? `/${action.entityId}` : ''}`);
  } else if (mapping.type === 'config_fix') {
    files.push(`[Config] ${action.component}`);
  }

  return files;
}

function buildSimulatedChanges(action: SystemAction): ChangeRecord[] {
  const mapping = mapActionToFix(action);

  if (mapping.type === 'ui_fix') {
    return [
      {
        field: `${action.component}.className`,
        before: '(current value)',
        after: `(patched by: ${action.action})`,
      },
    ];
  }

  if (mapping.type === 'data_fix') {
    return [
      {
        field: `${action.entityType}${action.entityId ? `.${action.entityId}` : ''}.status`,
        before: '(current value)',
        after: `(patched by: ${action.action})`,
      },
    ];
  }

  if (mapping.type === 'config_fix') {
    return [
      {
        field: `${action.component}.config`,
        before: '(current value)',
        after: `(toggled by: ${action.action})`,
      },
    ];
  }

  return [];
}

// ── Core API ───────────────────────────────────────────────────────────────────

/**
 * Dry-run simulation.
 * Returns impact, affected files, and risk level.
 * Never makes real changes.
 */
export function simulateExecution(action: SystemAction): DryRunResult {
  try {
    const blockCheck = isBlocked(action);

    if (blockCheck.blocked) {
      return {
        action_id: action.id || '(no-id)',
        impact: 'Blocked — operation not permitted',
        files_affected: [],
        risk: 'high',
        blocked: true,
        block_reason: blockCheck.reason,
      };
    }

    const mapping = mapActionToFix(action);

    if (!ALLOWED_FIX_TYPES.includes(mapping.type)) {
      return {
        action_id: action.id || '(no-id)',
        impact: `Fix type "${mapping.type}" is not in the allowed list`,
        files_affected: [],
        risk: 'high',
        blocked: true,
        block_reason: `Fix type not allowed: ${mapping.type}`,
      };
    }

    const risk = deriveRisk(action);
    const files_affected = buildFilesAffected(action);

    const impactLines: string[] = [
      `Apply "${action.action}" to ${action.component}`,
      `Fix type: ${mapping.type}`,
      `Execution mode: ${mapping.execution}`,
    ];
    if (action.fix_hint) impactLines.push(`Hint: ${action.fix_hint}`);
    if (risk === 'medium') impactLines.push('Note: data patch — no deletes, no destructive ops');

    return {
      action_id: action.id || '(no-id)',
      impact: impactLines.join('\n'),
      files_affected,
      risk,
      blocked: false,
    };
  } catch (err: unknown) {
    return {
      action_id: action.id || '(no-id)',
      impact: 'Simulation failed unexpectedly',
      files_affected: [],
      risk: 'high',
      blocked: true,
      block_reason: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Execute a fix.
 *
 * Safety gates:
 *  1. Must pass dry-run (not blocked, not high-risk)
 *  2. Must have explicit confirmation flag
 *  3. Stores a rollback snapshot before "applying"
 *
 * Execution is simulated — no real changes are written.
 * All changes are recorded as ChangeRecord[] for auditability and rollback.
 */
export function executeAction(
  action: SystemAction,
  confirmed: boolean,
): ExecutionResult {
  try {
    if (!confirmed) {
      return {
        action_id: action.id || '(no-id)',
        success: false,
        changes_applied: [],
        rollback_available: false,
        message: 'Blocked: user confirmation required',
        error: 'NOT_CONFIRMED',
      };
    }

    const dryRun = simulateExecution(action);

    if (dryRun.blocked) {
      return {
        action_id: action.id || '(no-id)',
        success: false,
        changes_applied: [],
        rollback_available: false,
        message: `Blocked: ${dryRun.block_reason ?? 'operation not permitted'}`,
        error: 'BLOCKED',
      };
    }

    if (dryRun.risk === 'high') {
      return {
        action_id: action.id || '(no-id)',
        success: false,
        changes_applied: [],
        rollback_available: false,
        message: 'Blocked: high-risk actions require manual intervention',
        error: 'HIGH_RISK',
      };
    }

    const changes = buildSimulatedChanges(action);
    const snapshot: RollbackSnapshot = {
      action_id: action.id,
      before_state: changes.map((c) => ({ ...c, after: c.before })),
      after_state: changes,
      timestamp: Date.now(),
      action,
    };

    _rollbackStore.set(action.id, snapshot);

    return {
      action_id: action.id,
      success: true,
      changes_applied: changes,
      rollback_available: true,
      message: `Fix applied (simulated): ${action.action} on ${action.component}`,
    };
  } catch (err: unknown) {
    return {
      action_id: action.id || '(no-id)',
      success: false,
      changes_applied: [],
      rollback_available: false,
      message: 'Unexpected error during execution',
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Roll back a previously executed fix.
 * Restores before_state from the in-memory snapshot and removes the entry.
 */
export function rollbackExecution(action_id: string): RollbackResult {
  try {
    const snapshot = _rollbackStore.get(action_id);

    if (!snapshot) {
      return {
        action_id,
        success: false,
        message: 'No rollback snapshot found for this action',
        error: 'NO_SNAPSHOT',
      };
    }

    _rollbackStore.delete(action_id);

    return {
      action_id,
      success: true,
      message: `Rolled back: ${snapshot.action.action} on ${snapshot.action.component}`,
    };
  } catch (err: unknown) {
    return {
      action_id,
      success: false,
      message: 'Unexpected error during rollback',
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}
