/**
 * PRIORITY RESOLVER
 *
 * Resolves conflicts between safety rules, active campaigns, event-driven
 * discounts, and default pricing. Pure function — same input → same output.
 *
 * PRIORITY ORDER (lowest number = highest authority):
 *   1. SAFETY_RULE      — margin protection, never overridable
 *   2. ACTIVE_CAMPAIGN  — scheduled marketing campaign with start/end window
 *   3. EVENT_DISCOUNT   — event-driven dynamic discount
 *   4. DEFAULT_PRICING  — base price fallback
 *
 * Rule:
 *   For each product scope, only the highest-priority rule applies.
 *   All lower-priority rules are recorded as `overridden_rules` with the
 *   winning rule id and the reason.
 *
 *   SAFETY_RULE additionally clamps any winning discount that would breach
 *   the margin floor — it never gets "overridden", it modifies the winner.
 */

export type RuleKind =
  | "SAFETY_RULE"
  | "ACTIVE_CAMPAIGN"
  | "EVENT_DISCOUNT"
  | "DEFAULT_PRICING";

export const RULE_PRIORITY: Readonly<Record<RuleKind, number>> = Object.freeze({
  SAFETY_RULE: 1,
  ACTIVE_CAMPAIGN: 2,
  EVENT_DISCOUNT: 3,
  DEFAULT_PRICING: 4,
});

export interface PriorityRule {
  readonly id: string;
  readonly kind: RuleKind;
  readonly product_id: string;
  /** Discount fraction 0..1 — ignored for SAFETY_RULE and DEFAULT_PRICING. */
  readonly discount_pct?: number;
  /** Required for SAFETY_RULE: minimum margin (price/cost) ratio – e.g. 1.15. */
  readonly min_margin_ratio?: number;
  /** Required for DEFAULT_PRICING: base price. */
  readonly base_price?: number;
  /** Required for SAFETY_RULE clamping: cost basis. */
  readonly cost_price?: number;
  readonly source: string;
  readonly reason?: string;
}

export interface PriorityResolverInput {
  readonly evaluated_at: string;
  readonly rules: ReadonlyArray<PriorityRule>;
}

export interface ResolvedAction {
  readonly product_id: string;
  readonly winning_rule_id: string;
  readonly winning_kind: RuleKind;
  readonly applied_discount_pct: number;
  readonly base_price: number;
  readonly final_price: number;
  /** True if SAFETY_RULE clamped the winning discount. */
  readonly margin_clamped: boolean;
  readonly clamp_reason?: string;
  readonly source: string;
}

export interface OverriddenRule {
  readonly product_id: string;
  readonly rule_id: string;
  readonly kind: RuleKind;
  readonly overridden_by_rule_id: string;
  readonly overridden_by_kind: RuleKind;
  readonly reason: string;
}

export interface PriorityResolverReport {
  readonly evaluated_at: string;
  readonly resolved_actions: ReadonlyArray<ResolvedAction>;
  readonly overridden_rules: ReadonlyArray<OverriddenRule>;
  readonly summary: {
    readonly products_evaluated: number;
    readonly resolved_count: number;
    readonly overridden_count: number;
    readonly margin_clamps: number;
  };
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const round4 = (n: number) => Math.round(n * 10_000) / 10_000;

/**
 * Group rules by product_id deterministically.
 */
function groupByProduct(
  rules: ReadonlyArray<PriorityRule>,
): Map<string, PriorityRule[]> {
  const map = new Map<string, PriorityRule[]>();
  for (const r of rules) {
    const arr = map.get(r.product_id) ?? [];
    arr.push(r);
    map.set(r.product_id, arr);
  }
  return map;
}

/**
 * Resolve one product's rules.
 *
 * Algorithm:
 *   1. Pull SAFETY_RULE (if any) — used as floor, never participates in winner pick.
 *   2. From remaining rules, choose the lowest-priority-number (i.e. highest authority).
 *      Tie-break: rule.id ascending → deterministic.
 *   3. If safety rule exists and the winning discount would breach the
 *      margin floor, clamp the discount and flag `margin_clamped=true`.
 *   4. Every non-winning, non-safety rule is added to `overridden_rules`.
 *   5. The safety rule itself is never overridden, never returned as winner.
 *      If it's the ONLY rule for a product (no pricing rule provided), the
 *      product is skipped — there is nothing to price.
 */
function resolveProduct(
  product_id: string,
  rules: PriorityRule[],
): { action: ResolvedAction | null; overrides: OverriddenRule[] } {
  const safety = rules.find((r) => r.kind === "SAFETY_RULE") ?? null;
  const pricing = rules.filter((r) => r.kind !== "SAFETY_RULE");
  const overrides: OverriddenRule[] = [];

  if (pricing.length === 0) {
    return { action: null, overrides };
  }

  const sorted = [...pricing].sort((a, b) => {
    const pa = RULE_PRIORITY[a.kind];
    const pb = RULE_PRIORITY[b.kind];
    return pa !== pb ? pa - pb : a.id.localeCompare(b.id);
  });

  const winner = sorted[0];

  // Determine base price — required to compute final price.
  const defaultRule = rules.find((r) => r.kind === "DEFAULT_PRICING");
  const basePrice = defaultRule?.base_price ?? winner.base_price;
  if (typeof basePrice !== "number" || basePrice <= 0) {
    // No usable base price → skip product, log all rules as overridden by absence.
    return { action: null, overrides };
  }

  let appliedDiscount = winner.discount_pct ?? 0;
  if (appliedDiscount < 0) appliedDiscount = 0;
  if (appliedDiscount > 1) appliedDiscount = 1;

  let marginClamped = false;
  let clampReason: string | undefined;

  if (safety) {
    const minMargin = safety.min_margin_ratio ?? 1;
    const cost = safety.cost_price;
    if (typeof cost === "number" && cost > 0) {
      const minPrice = cost * minMargin;
      const candidatePrice = basePrice * (1 - appliedDiscount);
      if (candidatePrice < minPrice) {
        // Clamp discount so price = minPrice.
        const maxDiscount = Math.max(0, 1 - minPrice / basePrice);
        clampReason = `margin floor: cost ${cost} × ${minMargin} = ${round2(minPrice)} > candidate ${round2(candidatePrice)}`;
        appliedDiscount = round4(maxDiscount);
        marginClamped = true;
      }
    }
  }

  const finalPrice = round2(basePrice * (1 - appliedDiscount));

  const action: ResolvedAction = {
    product_id,
    winning_rule_id: winner.id,
    winning_kind: winner.kind,
    applied_discount_pct: round4(appliedDiscount),
    base_price: round2(basePrice),
    final_price: finalPrice,
    margin_clamped: marginClamped,
    clamp_reason: clampReason,
    source: winner.source,
  };

  for (let i = 1; i < sorted.length; i++) {
    const loser = sorted[i];
    overrides.push({
      product_id,
      rule_id: loser.id,
      kind: loser.kind,
      overridden_by_rule_id: winner.id,
      overridden_by_kind: winner.kind,
      reason: `priority ${RULE_PRIORITY[loser.kind]} < winner ${RULE_PRIORITY[winner.kind]} (${winner.kind})`,
    });
  }

  return { action, overrides };
}

export function resolvePriorities(
  input: PriorityResolverInput,
): PriorityResolverReport {
  const grouped = groupByProduct(input.rules);
  const actions: ResolvedAction[] = [];
  const overrides: OverriddenRule[] = [];

  // Deterministic product iteration order
  const productIds = Array.from(grouped.keys()).sort();
  for (const pid of productIds) {
    const { action, overrides: ov } = resolveProduct(pid, grouped.get(pid)!);
    if (action) actions.push(action);
    overrides.push(...ov);
  }

  const marginClamps = actions.filter((a) => a.margin_clamped).length;

  return Object.freeze({
    evaluated_at: input.evaluated_at,
    resolved_actions: Object.freeze(actions),
    overridden_rules: Object.freeze(overrides),
    summary: Object.freeze({
      products_evaluated: productIds.length,
      resolved_count: actions.length,
      overridden_count: overrides.length,
      margin_clamps: marginClamps,
    }),
  });
}
