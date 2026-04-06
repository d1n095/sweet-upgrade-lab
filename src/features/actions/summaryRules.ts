import type { SystemAction } from './AutoFixEngine';
import type { Priority, SummaryItem, ExplainBlock } from './summaryTypes';

// ── Keyword rules ─────────────────────────────────────────────────────────────

export const KEYWORD_RULES: Array<{
  test: RegExp;
  title: (a: SystemAction) => string;
  description: string;
  consequence: string;
  suggestedFix: string;
  category: SummaryItem['category'];
  priority: Priority;
}> = [
  {
    test: /checkout/i,
    title: () => 'Checkout is not working',
    description: 'Users cannot complete purchases.',
    consequence: 'Lost sales and poor customer experience.',
    suggestedFix: 'Inspect the checkout handler and ensure it processes orders correctly.',
    category: 'Feature broken',
    priority: 'critical',
  },
  {
    test: /payment|stripe/i,
    title: () => 'Payment processing has an issue',
    description: 'The payment flow may fail or behave unexpectedly.',
    consequence: 'Users cannot pay; transactions may fail silently.',
    suggestedFix: 'Verify payment integration settings and handler responses.',
    category: 'Feature broken',
    priority: 'critical',
  },
  {
    test: /auth|login|session/i,
    title: () => 'Login or session issue detected',
    description: 'Users may be unable to sign in or may lose their session.',
    consequence: 'Users get logged out or cannot access the app.',
    suggestedFix: 'Check authentication handlers and session token expiry.',
    category: 'Feature broken',
    priority: 'critical',
  },
  {
    test: /missing|not.?found|404/i,
    title: (a) => `"${a.component}" feature is missing`,
    description: 'A required component or page cannot be found.',
    consequence: 'Users see an error or blank page.',
    suggestedFix: 'Verify the route and component are registered correctly.',
    category: 'UI problem',
    priority: 'warning',
  },
  {
    test: /permission|access|role/i,
    title: () => 'Access permission problem',
    description: 'Certain users may see content they should not, or be blocked from things they need.',
    consequence: 'Security risk or broken user flows.',
    suggestedFix: 'Review role and permission configuration.',
    category: 'Config issue',
    priority: 'warning',
  },
  {
    test: /sync|mismatch|stale/i,
    title: (a) => `"${a.component}" data is out of sync`,
    description: 'The data shown does not match what is stored.',
    consequence: 'Users see outdated or incorrect information.',
    suggestedFix: 'Trigger a data refresh or fix the synchronisation logic.',
    category: 'Data issue',
    priority: 'warning',
  },
  {
    test: /null|undefined|crash|error/i,
    title: (a) => `"${a.component}" has an unexpected error`,
    description: 'The component is crashing or producing an error.',
    consequence: 'Part of the page may not render.',
    suggestedFix: 'Add error handling and check for null values.',
    category: 'UI problem',
    priority: 'warning',
  },
  {
    test: /config|setting/i,
    title: (a) => `"${a.component}" is misconfigured`,
    description: 'A setting or configuration value is incorrect.',
    consequence: 'Feature may behave unexpectedly.',
    suggestedFix: 'Review and correct the configuration for this component.',
    category: 'Config issue',
    priority: 'minor',
  },
  {
    test: /ui|display|render|style|layout/i,
    title: (a) => `"${a.component}" looks wrong`,
    description: 'The visual display of this section is incorrect.',
    consequence: 'Poor user experience; content may be hard to read.',
    suggestedFix: 'Inspect the layout and styling for this component.',
    category: 'UI problem',
    priority: 'minor',
  },
  {
    test: /db|database|query/i,
    title: (a) => `"${a.component}" has a database issue`,
    description: 'A database query or connection is not working as expected.',
    consequence: 'Data may not load or save correctly.',
    suggestedFix: 'Check database queries and connection settings.',
    category: 'Data issue',
    priority: 'warning',
  },
];

// ── Flow tag rules ────────────────────────────────────────────────────────────

export const FLOW_TAG_RULES: Array<{ test: RegExp; tag: string }> = [
  { test: /checkout/i,                  tag: 'Checkout Flow' },
  { test: /payment|stripe|order/i,      tag: 'Checkout Flow' },
  { test: /auth|login|session|signup/i, tag: 'User Login' },
  { test: /admin/i,                     tag: 'Admin Panel' },
  { test: /product|catalog|variant/i,   tag: 'Product Catalog' },
  { test: /cart/i,                      tag: 'Cart Flow' },
  { test: /permission|role|access/i,    tag: 'Access Control' },
  { test: /db|database|query|sync/i,    tag: 'Data Layer' },
  { test: /ui|render|layout|style/i,    tag: 'User Interface' },
];

// ── Explain block derivation ──────────────────────────────────────────────────

const SCAN_STEP_BY_CATEGORY: Record<SummaryItem['category'], string> = {
  'UI problem':     'UI structure scanner',
  'Data issue':     'Data integrity scanner',
  'Feature broken': 'User flow scanner',
  'Config issue':   'Configuration scanner',
};

const WHY_BY_CATEGORY: Record<SummaryItem['category'], string> = {
  'UI problem':     'A component or layout rule is missing or producing the wrong output. This usually happens when code changes break visual contracts.',
  'Data issue':     'The data pipeline has a gap — either a value was not saved correctly, or the read-back is returning stale or mismatched data.',
  'Feature broken': 'The user-facing flow reaches a point where a required handler or integration is absent or returns an unexpected response.',
  'Config issue':   'A configuration value is set incorrectly or missing. The system falls back to a default that does not match the intended behaviour.',
};

function deriveExplain(action: SystemAction, category: SummaryItem['category']): ExplainBlock {
  return {
    why: WHY_BY_CATEGORY[category],
    scanStep: SCAN_STEP_BY_CATEGORY[category],
    affectedPart: action.component || action.entityType || 'Unknown component',
  };
}

// ── Impact score calculation ──────────────────────────────────────────────────

const SEVERITY_WEIGHT: Record<Priority, number> = {
  critical: 50,
  warning:  25,
  minor:    10,
};

const FLOW_IMPORTANCE: Record<string, number> = {
  'Checkout Flow':   30,
  'User Login':      25,
  'Access Control':  20,
  'Admin Panel':     15,
  'Cart Flow':       15,
  'Product Catalog': 10,
  'Data Layer':      10,
  'User Interface':   5,
  'General':          5,
};

function calcImpactScore(priority: Priority, flowTags: string[], autoFixable: boolean): number {
  const severityW  = SEVERITY_WEIGHT[priority];
  const flowW      = Math.max(...flowTags.map((t) => FLOW_IMPORTANCE[t] ?? 5));
  // Not auto-fixable means harder to recover from, so it has higher urgency.
  const fixPenalty = autoFixable ? 0 : 10;
  return Math.min(100, severityW + flowW + fixPenalty);
}

// ── Hint derivation ───────────────────────────────────────────────────────────

function deriveFlowTags(action: SystemAction): string[] {
  const haystack = `${action.action} ${action.component} ${action.entityType}`;
  const tags = new Set<string>();
  for (const rule of FLOW_TAG_RULES) {
    if (rule.test.test(haystack)) tags.add(rule.tag);
  }
  return tags.size > 0 ? [...tags] : ['General'];
}

function deriveHint(action: SystemAction): Omit<SummaryItem, 'id' | '_raw' | 'impactScore' | 'flowTags' | 'explain'> {
  const haystack = `${action.action} ${action.component} ${action.entityType} ${action.fix_hint ?? ''}`;

  for (const rule of KEYWORD_RULES) {
    if (rule.test.test(haystack)) {
      return {
        title: rule.title(action),
        description: rule.description,
        consequence: rule.consequence,
        suggestedFix: action.fix_hint ?? rule.suggestedFix,
        category: rule.category,
        priority: rule.priority,
      };
    }
  }

  const readable = action.action
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase();

  return {
    title: `Issue in "${action.component}"`,
    description: `A problem was detected: ${readable}.`,
    consequence: 'This may affect part of the application.',
    suggestedFix: action.fix_hint ?? 'Review and fix the reported action.',
    category: 'Feature broken',
    priority: action.auto_fixable ? 'minor' : 'warning',
  };
}

// ── Public helpers ────────────────────────────────────────────────────────────

export function toSummaryItem(action: SystemAction): SummaryItem {
  const hint        = deriveHint(action);
  const flowTags    = deriveFlowTags(action);
  const explain     = deriveExplain(action, hint.category);
  const impactScore = calcImpactScore(hint.priority, flowTags, action.auto_fixable ?? false);
  return {
    id: action.id,
    ...hint,
    impactScore,
    flowTags,
    explain,
    _raw: action,
  };
}

export function calcScore(items: SummaryItem[]): number {
  const deduction = items.reduce((acc, item) => {
    if (item.priority === 'critical') return acc + 20;
    if (item.priority === 'warning')  return acc + 8;
    return acc + 2;
  }, 0);
  return Math.max(0, 100 - deduction);
}
