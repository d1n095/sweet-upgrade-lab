// ── SCAN RESULT TYPE ─────────────────────────────────────────────────────
// Single source of truth for all scanner return values.
// All scanners in SCAN_REGISTRY MUST conform to this schema.
// Prohibited: ai_summary, ai_suggestions, randomness, external API calls.
export type ScanResult = {
  issues: any[];
  meta?: Record<string, any>;
  stats?: Record<string, any>;
};
