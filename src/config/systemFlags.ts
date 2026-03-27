/**
 * SYSTEM FLAGS — Global feature kill switches.
 *
 * AI is OFF by default. The entire scanner, debug, test-runner and CI
 * pipeline MUST run without triggering any AI endpoint, credit, or model.
 *
 * To enable AI for a specific context, flip the relevant flag at runtime
 * via the Admin › AI Center UI (manual, opt-in only).
 */

export const SYSTEM_FLAGS = {
  /** Master AI gate. When false ALL AI calls are blocked. */
  AI_ENABLED: false,

  /** Allow AI calls from the scanner/debug pipeline. Never enable in CI. */
  AI_ALLOWED_IN_SCANNER: false,

  /** Allow AI auto-assignment / orchestration / auto-close routines. */
  AI_ALLOWED_IN_AUTOMATION: false,
} as const;

export type SystemFlags = typeof SYSTEM_FLAGS;
