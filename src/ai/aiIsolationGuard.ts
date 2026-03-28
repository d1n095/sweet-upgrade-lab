/**
 * AI Isolation Guard
 *
 * Central enforcement layer for AI isolation.
 *
 * Usage:
 *   import { assertAiAllowed, recordAiViolation } from '@/ai/aiIsolationGuard';
 *   assertAiAllowed('myFile.ts', 'myFunction');  // throws / logs if AI is disabled
 *
 * Any attempted AI call while AI_ENABLED = false is logged as a CRITICAL violation
 * with the label "AI ISOLATION BREACH".
 */

import { SYSTEM_FLAGS } from '@/config/systemFlags';

export interface AiViolation {
  id: string;
  timestamp: string;
  file: string;
  fn: string;
  stack: string;
  message: string;
}

// In-memory violation log (also surfaced in the Debug dashboard)
const _violations: AiViolation[] = [];

export function getAiViolations(): Readonly<AiViolation[]> {
  return _violations;
}

export function clearAiViolations(): void {
  _violations.length = 0;
}

/**
 * Record a violation and log a CRITICAL console error.
 * Safe to call even in non-browser environments.
 */
export function recordAiViolation(file: string, fn: string, extra?: string): AiViolation {
  const stack = new Error().stack ?? '(no stack)';
  const message = `AI ISOLATION BREACH — AI_ENABLED=false but AI was called from [${file}::${fn}]${extra ? ` — ${extra}` : ''}`;

  const violation: AiViolation = {
    id: typeof crypto !== 'undefined' ? crypto.randomUUID() : `v-${Date.now()}`,
    timestamp: new Date().toISOString(),
    file,
    fn,
    stack,
    message,
  };

  _violations.push(violation);

  // Always emit a critical log regardless of debug mode
  console.error(`[CRITICAL] ${message}`, { file, fn, stack });

  return violation;
}

/**
 * Assert that AI is currently allowed.
 * Throws an error (and records a violation) if AI_ENABLED = false.
 * Returns silently if AI is allowed.
 */
export function assertAiAllowed(file: string, fn: string, extra?: string): void {
  if (!SYSTEM_FLAGS.AI_ENABLED) {
    recordAiViolation(file, fn, extra);
    throw new Error(`AI DISABLED — ${file}::${fn} blocked by SYSTEM_FLAGS.AI_ENABLED=false`);
  }
}

/**
 * Same as assertAiAllowed but for automation/background triggers.
 */
export function assertAiAutomationAllowed(file: string, fn: string): void {
  if (!SYSTEM_FLAGS.AI_ENABLED || !SYSTEM_FLAGS.AI_ALLOWED_IN_AUTOMATION) {
    recordAiViolation(file, fn, 'automation trigger');
    throw new Error(`AI AUTOMATION DISABLED — ${file}::${fn} blocked by SYSTEM_FLAGS`);
  }
}

/**
 * Same as assertAiAllowed but for scanner/debug triggers.
 */
export function assertAiScannerAllowed(file: string, fn: string): void {
  if (!SYSTEM_FLAGS.AI_ENABLED || !SYSTEM_FLAGS.AI_ALLOWED_IN_SCANNER) {
    recordAiViolation(file, fn, 'scanner trigger');
    throw new Error(`AI SCANNER DISABLED — ${file}::${fn} blocked by SYSTEM_FLAGS`);
  }
}

/**
 * Returns an isolation verification report suitable for display in the Debug dashboard.
 */
export function getIsolationReport(): {
  ai_calls_detected: number;
  isolation_status: 'SUCCESS' | 'FAILED';
  ai_enabled: boolean;
  ai_allowed_in_scanner: boolean;
  ai_allowed_in_automation: boolean;
  violations: AiViolation[];
} {
  return {
    ai_calls_detected: _violations.length,
    isolation_status: _violations.length === 0 ? 'SUCCESS' : 'FAILED',
    ai_enabled: SYSTEM_FLAGS.AI_ENABLED,
    ai_allowed_in_scanner: SYSTEM_FLAGS.AI_ALLOWED_IN_SCANNER,
    ai_allowed_in_automation: SYSTEM_FLAGS.AI_ALLOWED_IN_AUTOMATION,
    violations: [..._violations],
  };
}

// ── GLOBAL AI USAGE BLOCKER ──────────────────────────────────────────
/**
 * Checks a code string for any forbidden AI library references.
 * Returns true (blocked) if any forbidden keyword is found.
 * Throws an error if blocking is enforced.
 *
 * Usage:
 *   if (blockAIUsage(codeString)) throw new Error("AI USAGE NOT ALLOWED");
 */
export function blockAIUsage(code: string): boolean {
  const forbidden = ["openai", "anthropic", "gpt", "claude", "lovable_key", "LOVABLE_API_KEY", "ai.gateway.lovable"];
  const lower = code.toLowerCase();
  const detected = forbidden.filter((word) => lower.includes(word.toLowerCase()));

  if (detected.length > 0) {
    const message = `AI USAGE NOT ALLOWED — detected forbidden keywords: ${detected.join(", ")}`;
    recordAiViolation("blockAIUsage", "global-guard", message);
    console.error(`[GLOBAL AI BLOCK] ${message}`);
    return true;
  }

  return false;
}
// ─────────────────────────────────────────────────────────────────────
