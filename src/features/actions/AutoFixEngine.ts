/**
 * AutoFixEngine
 *
 * Pure logic layer — NO React, NO side effects, NO backend calls.
 *
 * Input:  SystemAction (from SystemActionEngine / unified_result)
 * Output: FixResult
 */

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

/** Result returned by generateFixResult. */
export interface FixResult {
  action_id: string;
  success: boolean;
  /** Always true — this engine only simulates; no real changes are made. */
  simulated: boolean;
  fix_type: FixType;
  execution_mode: ExecutionMode;
  message: string;
  fix_prompt: string;
}

// ── Pure helpers ───────────────────────────────────────────────────────────────

/**
 * Derive fix type and execution mode from the action's content.
 * Uses component/action name heuristics for classification.
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

/** Produce a human-readable fix prompt. */
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

// ── Core pure function ─────────────────────────────────────────────────────────

/**
 * Generate a fix result for a given action.
 *
 * Pure function — no network calls, no side effects, no React.
 * Always returns a simulated result with a generated fix prompt.
 */
export function generateFixResult(action: SystemAction): FixResult {
  const mapping = mapActionToFix(action);
  const fix_prompt = generateFixPrompt(action, mapping);

  return {
    action_id: action.id || '(no-id)',
    success: true,
    simulated: true,
    fix_type: mapping.type,
    execution_mode: mapping.execution,
    message: `Fix would be applied as ${mapping.type} (${mapping.execution})`,
    fix_prompt,
  };
}
