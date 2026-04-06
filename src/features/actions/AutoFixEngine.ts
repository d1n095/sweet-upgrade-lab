/**
 * AutoFixEngine
 *
 * Level 3 system: Action → Fix execution (semi-automation)
 *
 * Input:  SystemAction (from SystemActionEngine)
 * Output: FixResult
 *
 * SAFE: Does NOT call scan system.
 *       Only uses safeInvoke("apply-fix") if available, or generates a fix prompt.
 */
import { safeInvoke } from '@/lib/safeInvoke';

// ── Types ──────────────────────────────────────────────────────────────────────

export type FixType = 'ui_fix' | 'data_fix' | 'config_fix';
export type ExecutionMode = 'manual' | 'semi_auto';

/** Represents an action originating from the SystemActionEngine. */
export interface SystemAction {
  id: string;
  action: string;
  component: string;
  entityType: string;
  entityId?: string;
  /** Whether the system considers this action auto-fixable. */
  auto_fixable?: boolean;
  /** Optional human-readable hint about the expected fix. */
  fix_hint?: string;
}

/** Maps an action to its fix category and execution mode. */
export interface FixMapping {
  type: FixType;
  execution: ExecutionMode;
}

/** Result returned by executeAutoFix or simulateFix. */
export interface FixResult {
  action_id: string;
  success: boolean;
  /** True when this result came from a simulation (no real changes made). */
  simulated: boolean;
  fix_type: FixType;
  execution_mode: ExecutionMode;
  message: string;
  /** Generated when apply-fix is unavailable or in manual mode. */
  fix_prompt?: string;
  error?: string;
}

// ── Fix type mapping ───────────────────────────────────────────────────────────

/**
 * Derive fix type and execution mode from the action's content.
 * Uses component/action name heuristics for categorisation.
 */
export function mapActionToFix(action: SystemAction): FixMapping {
  const comp = action.component.toLowerCase();
  const act = action.action.toLowerCase();
  const execution: ExecutionMode = action.auto_fixable ? 'semi_auto' : 'manual';

  if (
    comp.includes('config') ||
    act.includes('config') ||
    act.includes('permission') ||
    act.includes('access')
  ) {
    return { type: 'config_fix', execution };
  }

  if (
    comp.includes('data') ||
    act.includes('data') ||
    act.includes('sync') ||
    act.includes('db')
  ) {
    return { type: 'data_fix', execution };
  }

  return { type: 'ui_fix', execution };
}

// ── Fix prompt generator ───────────────────────────────────────────────────────

/** Produce a human-readable fix prompt for manual or fallback execution. */
export function generateFixPrompt(action: SystemAction, mapping: FixMapping): string {
  return [
    'Fix request:',
    `  Action:    ${action.action}`,
    `  Component: ${action.component}`,
    `  Entity:    ${action.entityType}${action.entityId ? ` / ${action.entityId}` : ''}`,
    `  Fix type:  ${mapping.type}`,
    `  Mode:      ${mapping.execution}`,
    action.fix_hint ? `  Hint:      ${action.fix_hint}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

// ── Core engine ────────────────────────────────────────────────────────────────

/**
 * Execute a real fix via safeInvoke("apply-fix").
 *
 * Safety guards:
 *  - Blocks when action.id is missing.
 *  - Blocks when confirmed is false (requires explicit user confirmation).
 *  - Falls back to fix-prompt generation when apply-fix is unavailable.
 *  - Handles all errors safely and returns a structured FixResult.
 */
export async function executeAutoFix(
  action: SystemAction,
  confirmed: boolean,
): Promise<FixResult> {
  if (!action.id) {
    return {
      action_id: '',
      success: false,
      simulated: false,
      fix_type: 'ui_fix',
      execution_mode: 'manual',
      message: 'Blocked: action.id is missing',
      error: 'NO_ACTION_ID',
    };
  }

  if (!confirmed) {
    return {
      action_id: action.id,
      success: false,
      simulated: false,
      fix_type: 'ui_fix',
      execution_mode: 'manual',
      message: 'Blocked: confirmation required before execution',
      error: 'NOT_CONFIRMED',
    };
  }

  const mapping = mapActionToFix(action);

  if (mapping.execution === 'semi_auto') {
    try {
      const { error } = await safeInvoke('apply-fix', {
        body: {
          action_id: action.id,
          action: action.action,
          component: action.component,
          entity_type: action.entityType,
          entity_id: action.entityId,
          fix_type: mapping.type,
        },
        isAdmin: true,
      });

      if (error) {
        const fixPrompt = generateFixPrompt(action, mapping);
        return {
          action_id: action.id,
          success: false,
          simulated: false,
          fix_type: mapping.type,
          execution_mode: mapping.execution,
          message: 'apply-fix returned an error — fix prompt generated',
          fix_prompt: fixPrompt,
          error: error?.error ?? String(error),
        };
      }

      return {
        action_id: action.id,
        success: true,
        simulated: false,
        fix_type: mapping.type,
        execution_mode: mapping.execution,
        message: 'Fix applied via apply-fix',
      };
    } catch (err: any) {
      const fixPrompt = generateFixPrompt(action, mapping);
      return {
        action_id: action.id,
        success: false,
        simulated: false,
        fix_type: mapping.type,
        execution_mode: mapping.execution,
        message: 'apply-fix unavailable — fix prompt generated',
        fix_prompt: fixPrompt,
        error: err?.message ?? 'Unknown error',
      };
    }
  }

  // Manual mode: generate a fix prompt instead of calling an edge function.
  const fixPrompt = generateFixPrompt(action, mapping);
  return {
    action_id: action.id,
    success: true,
    simulated: false,
    fix_type: mapping.type,
    execution_mode: 'manual',
    message: 'Fix prompt generated for manual execution',
    fix_prompt: fixPrompt,
  };
}

/**
 * Simulate a fix — returns the expected outcome without making real changes.
 * Safe to call at any time; requires no confirmation.
 */
export function simulateFix(action: SystemAction): FixResult {
  const mapping = mapActionToFix(action);
  const fixPrompt = generateFixPrompt(action, mapping);

  return {
    action_id: action.id || '(no-id)',
    success: true,
    simulated: true,
    fix_type: mapping.type,
    execution_mode: mapping.execution,
    message: `[SIMULATION] Fix would be applied as ${mapping.type} (${mapping.execution})`,
    fix_prompt: fixPrompt,
  };
}
