/**
 * AutomationEngine
 *
 * Pure logic layer — NO React, NO side effects, NO backend calls.
 *
 * Inputs:  SystemAction[] + FixResult[]  (from AutoFixEngine)
 * Outputs: AutomationTask[]
 *
 * Responsibilities:
 *  1. Map actions → automation tasks with type, priority, risk
 *  2. Detect value impact (revenue / ux / stability)
 *  3. Score and sort tasks by priority
 *  4. Enforce automation rules (only low-risk, non-critical, ui/config tasks are auto-eligible)
 */

import type { SystemAction, FixResult, FixType } from '../actions/AutoFixEngine';
import { mapActionToFix } from '../actions/AutoFixEngine';
import type { RiskLevel } from '../actions/ExecutionEngine';
import { simulateExecution } from '../actions/ExecutionEngine';

// ── Automation task types ──────────────────────────────────────────────────────

export type AutoTaskType = 'auto_fix' | 'auto_optimize' | 'suggestion';
export type AutoExecutionMode = 'manual' | 'scheduled' | 'auto';
export type ValueType = 'revenue' | 'ux' | 'stability';
export type ImpactLevel = 'low' | 'medium' | 'high';
export type TaskStatus = 'pending' | 'running' | 'done' | 'failed' | 'skipped';

export interface ValueImpact {
  impact: ImpactLevel;
  value_type: ValueType;
  description: string;
}

export interface AutomationTask {
  id: string;
  action_id: string;
  type: AutoTaskType;
  priority: AutoExecutionMode;
  priority_score: number;
  risk_level: RiskLevel;
  execution_mode: AutoExecutionMode;
  fix_type: FixType;
  value_impact: ValueImpact;
  action: SystemAction;
  status: TaskStatus;
  created_at: number;
  executed_at?: number;
  result_message?: string;
}

// ── Value detection ────────────────────────────────────────────────────────────

/**
 * Detect value impact based on action and entity type heuristics.
 *
 * broken_flows    → revenue loss
 * missing UI      → conversion / UX drop
 * data issues     → trust / stability
 */
function detectValueImpact(action: SystemAction): ValueImpact {
  const haystack = [action.action, action.component, action.entityType, action.fix_hint ?? '']
    .join(' ')
    .toLowerCase();

  // Revenue impact
  if (
    haystack.includes('checkout') ||
    haystack.includes('payment') ||
    haystack.includes('order') ||
    haystack.includes('broken_flow') ||
    haystack.includes('broken flow') ||
    haystack.includes('cart')
  ) {
    return {
      impact: 'high',
      value_type: 'revenue',
      description: 'Broken flow may cause revenue loss',
    };
  }

  // UX / conversion impact
  if (
    haystack.includes('button') ||
    haystack.includes('form') ||
    haystack.includes('modal') ||
    haystack.includes('ui') ||
    haystack.includes('missing') ||
    haystack.includes('display') ||
    haystack.includes('conversion')
  ) {
    return {
      impact: 'medium',
      value_type: 'ux',
      description: 'Missing or broken UI may reduce conversions',
    };
  }

  // Data / stability impact
  if (
    haystack.includes('data') ||
    haystack.includes('sync') ||
    haystack.includes('trust') ||
    haystack.includes('integrity') ||
    haystack.includes('mismatch') ||
    haystack.includes('stale')
  ) {
    return {
      impact: 'medium',
      value_type: 'stability',
      description: 'Data issues may cause trust or stability problems',
    };
  }

  // Default: low stability
  return {
    impact: 'low',
    value_type: 'stability',
    description: 'Minor improvement to system stability',
  };
}

// ── Priority scoring ───────────────────────────────────────────────────────────

const SEVERITY_SCORE: Record<string, number> = {
  critical: 40,
  high: 30,
  medium: 20,
  low: 10,
};

const IMPACT_SCORE: Record<ImpactLevel, number> = {
  high: 30,
  medium: 20,
  low: 10,
};

const RISK_PENALTY: Record<RiskLevel, number> = {
  low: 0,
  medium: -5,
  high: -20,
};

/**
 * Compute a numeric priority score.
 * Higher = should be addressed first.
 */
function computePriorityScore(
  action: SystemAction,
  valueImpact: ValueImpact,
  risk: RiskLevel,
): number {
  const severity = SEVERITY_SCORE[action.entityType?.toLowerCase() ?? ''] ?? 10;
  const impact = IMPACT_SCORE[valueImpact.impact];
  const penalty = RISK_PENALTY[risk];
  // frequency heuristic: auto_fixable actions are assumed more frequent
  const frequency = action.auto_fixable ? 5 : 0;

  return severity + impact + frequency + penalty;
}

// ── Automation eligibility rules ───────────────────────────────────────────────

/**
 * Determine automation execution mode.
 *
 * AUTO  = risk:low AND (ui_fix OR config_fix) AND NOT critical severity
 * SCHEDULED = risk:medium OR data_fix
 * MANUAL = everything else (high risk, critical, blocked)
 */
function deriveExecutionMode(
  action: SystemAction,
  fixType: FixType,
  risk: RiskLevel,
): AutoExecutionMode {
  const isCritical =
    action.entityType?.toLowerCase() === 'critical' ||
    action.action?.toLowerCase().includes('critical');

  if (isCritical || risk === 'high') return 'manual';
  if (risk === 'low' && (fixType === 'ui_fix' || fixType === 'config_fix')) return 'auto';
  if (risk === 'medium' || fixType === 'data_fix') return 'scheduled';

  return 'manual';
}

function deriveTaskType(
  execMode: AutoExecutionMode,
  valueImpact: ValueImpact,
): AutoTaskType {
  if (execMode === 'auto') return 'auto_fix';
  if (valueImpact.impact === 'high') return 'auto_optimize';
  return 'suggestion';
}

// ── ID generator ───────────────────────────────────────────────────────────────

let _taskCounter = 0;
function mkTaskId(action_id: string): string {
  return `at-${++_taskCounter}-${action_id.slice(0, 8)}-${Date.now()}`;
}

// ── Core API ───────────────────────────────────────────────────────────────────

/**
 * Build automation tasks from a list of actions.
 * Accepts an optional array of FixResult objects for enrichment (unused fields
 * kept for future use).
 *
 * Pure function — no network calls, no side effects, no React.
 */
export function buildAutomationTasks(
  actions: SystemAction[],
  _fixResults: FixResult[] = [],
): AutomationTask[] {
  const tasks: AutomationTask[] = [];

  for (const action of actions) {
    try {
      const mapping = mapActionToFix(action);
      const dryRun = simulateExecution(action);

      // Skip blocked actions — they cannot be automated
      if (dryRun.blocked) continue;

      const risk = dryRun.risk;
      const valueImpact = detectValueImpact(action);
      const priorityScore = computePriorityScore(action, valueImpact, risk);
      const execMode = deriveExecutionMode(action, mapping.type, risk);
      const taskType = deriveTaskType(execMode, valueImpact);

      tasks.push({
        id: mkTaskId(action.id || 'x'),
        action_id: action.id,
        type: taskType,
        priority: execMode,
        priority_score: priorityScore,
        risk_level: risk,
        execution_mode: execMode,
        fix_type: mapping.type,
        value_impact: valueImpact,
        action,
        status: 'pending',
        created_at: Date.now(),
      });
    } catch {
      // Skip any action that throws — never propagate errors
    }
  }

  // Sort: highest priority_score first
  tasks.sort((a, b) => b.priority_score - a.priority_score);

  return tasks;
}

/**
 * Filter tasks that are eligible for automatic execution.
 * Only tasks with execution_mode="auto" qualify.
 */
export function getEligibleAutoTasks(tasks: AutomationTask[]): AutomationTask[] {
  return tasks.filter((t) => t.execution_mode === 'auto' && t.status === 'pending');
}

/**
 * Mark a task as running / done / failed.
 * Returns a new task object (immutable update).
 */
export function updateTaskStatus(
  task: AutomationTask,
  status: TaskStatus,
  message?: string,
): AutomationTask {
  return {
    ...task,
    status,
    executed_at: status !== 'pending' ? Date.now() : task.executed_at,
    result_message: message ?? task.result_message,
  };
}
