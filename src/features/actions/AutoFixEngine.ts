/**
 * AutoFixEngine — maps scan issues to fix types and local action descriptors.
 * Fully local. No external calls. No ai_* references.
 */

export type FixType =
  | 'remove_dead_code'
  | 'add_null_guard'
  | 'fix_route'
  | 'restore_handler'
  | 'fix_data_mapping'
  | 'add_loading_state'
  | 'fix_validation'
  | 'generic_fix';

export interface FixAction {
  fix_type: FixType;
  label: string;
  description: string;
  estimated_effort: 'low' | 'medium' | 'high';
}

// ── Category → FixType mapping ────────────────────────────────────────────────

const CATEGORY_FIX_MAP: Record<string, FixType> = {
  broken_flows: 'fix_route',
  fake_features: 'remove_dead_code',
  interaction_failures: 'restore_handler',
  data_issues: 'fix_data_mapping',
};

const TITLE_FIX_PATTERNS: Array<{ pattern: RegExp; fix: FixType }> = [
  { pattern: /null|undefined|missing/i, fix: 'add_null_guard' },
  { pattern: /route|navigation|redirect/i, fix: 'fix_route' },
  { pattern: /handler|click|event|button/i, fix: 'restore_handler' },
  { pattern: /data|mapping|field|column/i, fix: 'fix_data_mapping' },
  { pattern: /loading|spinner|skeleton/i, fix: 'add_loading_state' },
  { pattern: /validation|invalid|format/i, fix: 'fix_validation' },
  { pattern: /dead|unused|stub|placeholder/i, fix: 'remove_dead_code' },
];

const FIX_DESCRIPTIONS: Record<FixType, { label: string; description: string; effort: 'low' | 'medium' | 'high' }> = {
  remove_dead_code: {
    label: 'Ta bort dead code',
    description: 'Identifiera och ta bort oanvänd kod, stubbar eller platshållare.',
    effort: 'low',
  },
  add_null_guard: {
    label: 'Lägg till null-guard',
    description: 'Lägg till null/undefined-kontroller för att förhindra runtime-fel.',
    effort: 'low',
  },
  fix_route: {
    label: 'Fixa routing',
    description: 'Reparera trasig navigation eller felaktiga route-definitioner.',
    effort: 'medium',
  },
  restore_handler: {
    label: 'Återställ event-handler',
    description: 'Återkoppla eller återskapa saknade event-handlers och klick-funktioner.',
    effort: 'medium',
  },
  fix_data_mapping: {
    label: 'Fixa datamappning',
    description: 'Korrigera fältmappning, kolumnnamn eller datatransformering.',
    effort: 'medium',
  },
  add_loading_state: {
    label: 'Lägg till laddningstillstånd',
    description: 'Implementera loading-indikator eller skeleton för asynkron data.',
    effort: 'low',
  },
  fix_validation: {
    label: 'Fixa validering',
    description: 'Lägg till eller korrigera inmatningsvalidering och felmeddelanden.',
    effort: 'medium',
  },
  generic_fix: {
    label: 'Generell fix',
    description: 'Undersök och åtgärda problemet manuellt baserat på beskrivningen.',
    effort: 'high',
  },
};

// ── Public API ────────────────────────────────────────────────────────────────

export function resolveFixType(category: string, title: string): FixType {
  const byCategory = CATEGORY_FIX_MAP[category];
  if (byCategory) return byCategory;

  for (const { pattern, fix } of TITLE_FIX_PATTERNS) {
    if (pattern.test(title)) return fix;
  }

  return 'generic_fix';
}

export function buildFixAction(category: string, title: string): FixAction {
  const fix_type = resolveFixType(category, title);
  const meta = FIX_DESCRIPTIONS[fix_type];
  return {
    fix_type,
    label: meta.label,
    description: meta.description,
    estimated_effort: meta.effort,
  };
}

export function simulateFix(action: FixAction): Promise<{ success: boolean; message: string }> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({ success: true, message: `Simulering klar: ${action.label}` });
    }, 600);
  });
}
