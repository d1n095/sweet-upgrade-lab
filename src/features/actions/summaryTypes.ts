import type { SystemAction } from './AutoFixEngine';

export type Priority = 'critical' | 'warning' | 'minor';

/** Explanation shown when the user taps "Explain" on a card. */
export interface ExplainBlock {
  /** Why the issue happens in plain language */
  why: string;
  /** Which scan step / scanner detected it */
  scanStep: string;
  /** Which part of the system is affected */
  affectedPart: string;
}

export interface SummaryItem {
  id: string;
  /** Human-readable title */
  title: string;
  /** Short plain-language explanation */
  description: string;
  /** What happens if left unfixed */
  consequence: string;
  /** Suggested fix in plain language */
  suggestedFix: string;
  /** Simple category label */
  category: 'UI problem' | 'Data issue' | 'Feature broken' | 'Config issue';
  priority: Priority;
  /**
   * Composite impact score (0–100).
   * Higher = more urgent to fix.
   * Factors: severity weight + flow importance + fixability penalty.
   */
  impactScore: number;
  /** User-facing flow tags, e.g. "Checkout Flow", "User Login" */
  flowTags: string[];
  /** Deep-dive explanation shown on demand */
  explain: ExplainBlock;
  /** Original technical data, shown only on expand */
  _raw: SystemAction;
}
