/**
 * ECOMMERCE RULE ENGINE
 *
 * Strict IF/THEN rule processor for ecommerce automation.
 * NO AI. NO fuzzy logic. NO probabilistic decisions.
 *
 * Pipeline:
 *   ecommerce_events  →  evaluateRules(event)  →  RuleAction[]
 *   RuleAction[]      →  resolveActions()      →  applied / overridden
 *
 * Each rule is a pure declarative record:
 *   { id, event_type, condition(payload) → boolean, action, priority }
 *
 * Same event + same rule set → same actions, every time.
 */
import type {
  EcommerceEvent,
  EcommerceEventType,
  EventPayloadMap,
} from "./ecommerceEvents";

// ─────────────────────────────────────────────────────────────────────────────
// Action types — every rule outputs one of these. Strictly typed.
// ─────────────────────────────────────────────────────────────────────────────
export type RuleActionType =
  | "apply_discount"
  | "change_price"
  | "trigger_campaign"
  | "mark_product_status"
  | "flag_for_review"
  | "no_op";

export type ProductStatus = "active" | "draft" | "archived" | "out_of_stock";

export interface MarkProductStatusAction {
  type: "mark_product_status";
  status: ProductStatus;
  reason: string;
}

export interface DiscountAction {
  type: "apply_discount";
  discount_pct: number;          // 0.0 – 1.0
  reason: string;
  duration_days: number;
}

export interface PriceChangeAction {
  type: "change_price";
  new_price_pct_of_current: number; // e.g. 0.9 = 90% of current
  reason: string;
}

export interface CampaignAction {
  type: "trigger_campaign";
  campaign_type:
    | "visibility_boost"
    | "clearance"
    | "conversion_opt"
    | "seasonal";
  duration_days: number;
  reason: string;
}

export interface FlagAction {
  type: "flag_for_review";
  reason: string;
  severity: "info" | "warning" | "critical";
}

export interface NoOpAction {
  type: "no_op";
  reason: string;
}

export type RuleAction =
  | DiscountAction
  | PriceChangeAction
  | CampaignAction
  | FlagAction
  | NoOpAction;

// ─────────────────────────────────────────────────────────────────────────────
// Priority tiers — lower number = higher priority. Matches priorityResolver.
// 1 = SAFETY, 2 = ACTIVE_CAMPAIGN, 3 = EVENT_DRIVEN, 4 = DEFAULT
// ─────────────────────────────────────────────────────────────────────────────
export const RULE_PRIORITY = {
  SAFETY: 1,
  ACTIVE_CAMPAIGN: 2,
  EVENT_DRIVEN: 3,
  DEFAULT: 4,
} as const;

export type RulePriority = (typeof RULE_PRIORITY)[keyof typeof RULE_PRIORITY];

// ─────────────────────────────────────────────────────────────────────────────
// Rule definition — pure data + a pure boolean condition function.
// ─────────────────────────────────────────────────────────────────────────────
export interface Rule<T extends EcommerceEventType = EcommerceEventType> {
  id: string;
  description: string;
  event_type: T;
  priority: RulePriority;
  /** Pure predicate. Must NOT read external state, time, or randomness. */
  condition: (payload: EventPayloadMap[T]) => boolean;
  /** Pure action factory from payload. Deterministic. */
  action: (payload: EventPayloadMap[T]) => RuleAction;
  enabled?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Rule outcomes
// ─────────────────────────────────────────────────────────────────────────────
export interface RuleEvaluation {
  rule_id: string;
  event_id?: string;
  event_type: EcommerceEventType;
  product_id?: string | null;
  matched: boolean;
  action: RuleAction;
  priority: RulePriority;
  evaluated_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Default rule set — strict IF/THEN, static thresholds only.
// To change behavior: edit these constants. Never inject runtime values.
// ─────────────────────────────────────────────────────────────────────────────
/** Helper: preserve per-rule generic typing inside the array. */
function defineRule<T extends EcommerceEventType>(rule: Rule<T>): Rule {
  return rule as unknown as Rule;
}

export const DEFAULT_RULES: Rule[] = [
  // ── R1: stagnation → 10% discount, 14-day window ─────────────────────────
  defineRule<"product_no_sales">({
    id: "R1_no_sales_discount_10",
    description: "IF product_no_sales > 30 days → apply 10% discount for 14 days",
    event_type: "product_no_sales",
    priority: RULE_PRIORITY.EVENT_DRIVEN,
    condition: (p) => p.days_since_last_sale > 30 && p.units_sold_30d === 0,
    action: () => ({
      type: "apply_discount",
      discount_pct: 0.1,
      reason: "product_no_sales>30d",
      duration_days: 14,
    }),
    enabled: true,
  }),

  // ── R2: high stock + low velocity → clearance 20% ────────────────────────
  defineRule<"high_stock">({
    id: "R2_high_stock_clearance_20",
    description: "IF stock_units > 100 AND days_of_inventory ≥ 90 → 20% clearance for 21 days",
    event_type: "high_stock",
    priority: RULE_PRIORITY.EVENT_DRIVEN,
    condition: (p) => p.stock > 100 && p.days_of_inventory >= 90,
    action: () => ({
      type: "apply_discount",
      discount_pct: 0.2,
      reason: "high_stock+slow_velocity",
      duration_days: 21,
    }),
    enabled: true,
  }),

  // ── R3: high stock + low velocity → clearance campaign ───────────────────
  defineRule<"high_stock">({
    id: "R3_high_stock_clearance_campaign",
    description: "IF stock_units > 100 AND days_of_inventory ≥ 90 → clearance campaign 21d",
    event_type: "high_stock",
    priority: RULE_PRIORITY.EVENT_DRIVEN,
    condition: (p) => p.stock > 100 && p.days_of_inventory >= 90,
    action: () => ({
      type: "trigger_campaign",
      campaign_type: "clearance",
      duration_days: 21,
      reason: "high_stock+slow_velocity",
    }),
    enabled: true,
  }),

  // ── R4: low stock (>0) → flag warning ────────────────────────────────────
  defineRule<"low_stock">({
    id: "R4_low_stock_flag_warning",
    description: "IF stock ≤ 5 AND stock > 0 → flag warning",
    event_type: "low_stock",
    priority: RULE_PRIORITY.EVENT_DRIVEN,
    condition: (p) => p.stock - p.reserved <= 5 && p.stock - p.reserved > 0,
    action: (p) => ({
      type: "flag_for_review",
      reason: `low_stock:${p.stock - p.reserved}_units_left`,
      severity: "warning",
    }),
    enabled: true,
  }),

  // ── R5: out of stock → flag critical (SAFETY tier) ───────────────────────
  defineRule<"low_stock">({
    id: "R5_oos_flag_critical",
    description: "IF stock - reserved = 0 → flag critical (block sales)",
    event_type: "low_stock",
    priority: RULE_PRIORITY.SAFETY,
    condition: (p) => p.stock - p.reserved <= 0,
    action: () => ({
      type: "flag_for_review",
      reason: "out_of_stock",
      severity: "critical",
    }),
    enabled: true,
  }),

  // ── R6: price_drop_needed → 10–20% discount based on reason ─────────────
  defineRule<"price_drop_needed">({
    id: "R6_price_drop_discount",
    description: "IF price_drop_needed AND margin allows → 10–20% discount",
    event_type: "price_drop_needed",
    priority: RULE_PRIORITY.EVENT_DRIVEN,
    condition: (p) =>
      p.margin_ratio === null || p.margin_ratio > 1.2, // SAFETY: protect margin
    action: (p) => ({
      type: "apply_discount",
      discount_pct: p.reason === "high_stock"
        ? p.suggested_max_discount_pct
        : p.suggested_min_discount_pct,
      reason: `price_drop:${p.reason}`,
      duration_days: 14,
    }),
    enabled: true,
  }),

  // ── R7: campaign_trigger event → trigger campaign ───────────────────────
  defineRule<"campaign_trigger">({
    id: "R7_campaign_trigger_dispatch",
    description: "IF campaign_trigger event → start matching campaign 14d",
    event_type: "campaign_trigger",
    priority: RULE_PRIORITY.ACTIVE_CAMPAIGN,
    condition: () => true, // event-only, no extra condition
    action: (p) => ({
      type: "trigger_campaign",
      campaign_type: p.campaign_type,
      duration_days: 14,
      reason: p.trigger_reason,
    }),
    enabled: true,
  }),

  // ── R8: cart_abandonment (high value) → conversion campaign 7d ───────────
  defineRule<"cart_abandonment">({
    id: "R8_cart_abandonment_conversion_campaign",
    description: "IF cart_abandonment AND cart_value ≥ 500 SEK → conversion_opt campaign 7d",
    event_type: "cart_abandonment",
    priority: RULE_PRIORITY.EVENT_DRIVEN,
    condition: (p) => p.cart_value >= 500 && p.items_count > 0,
    action: (p) => ({
      type: "trigger_campaign",
      campaign_type: "conversion_opt",
      duration_days: 7,
      reason: `cart_abandonment:${p.abandoned_at_step}:${p.cart_value}sek`,
    }),
    enabled: true,
  }),

  // ── R9: cart_abandonment (low value) → flag for review ───────────────────
  defineRule<"cart_abandonment">({
    id: "R9_cart_abandonment_flag",
    description: "IF cart_abandonment AND cart_value < 500 SEK → flag info",
    event_type: "cart_abandonment",
    priority: RULE_PRIORITY.DEFAULT,
    condition: (p) => p.cart_value < 500 && p.items_count > 0,
    action: (p) => ({
      type: "flag_for_review",
      reason: `cart_abandonment:${p.abandoned_at_step}:${p.cart_value}sek`,
      severity: "info",
    }),
    enabled: true,
  }),
];

// ─────────────────────────────────────────────────────────────────────────────
// Pure rule evaluator — given an event + rule set, return matched evaluations.
// ─────────────────────────────────────────────────────────────────────────────
export function evaluateRules(
  event: EcommerceEvent,
  rules: Rule[] = DEFAULT_RULES
): RuleEvaluation[] {
  const now = new Date().toISOString();
  const out: RuleEvaluation[] = [];

  for (const rule of rules) {
    if (rule.enabled === false) continue;
    if (rule.event_type !== event.event_type) continue;

    let matched = false;
    try {
      // Cast: rule.event_type === event.event_type guarantees payload shape.
      matched = (rule.condition as (p: unknown) => boolean)(event.payload);
    } catch (err) {
      console.error(`[ruleEngine] condition threw for ${rule.id}`, err);
      matched = false;
    }

    if (!matched) continue;

    let action: RuleAction;
    try {
      action = (rule.action as (p: unknown) => RuleAction)(event.payload);
    } catch (err) {
      console.error(`[ruleEngine] action threw for ${rule.id}`, err);
      action = { type: "no_op", reason: `error:${rule.id}` };
    }

    out.push({
      rule_id: rule.id,
      event_id: event.id,
      event_type: event.event_type,
      product_id: event.product_id ?? null,
      matched: true,
      action,
      priority: rule.priority,
      evaluated_at: now,
    });
  }

  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Batch processor — evaluate many events against the rule set
// ─────────────────────────────────────────────────────────────────────────────
export function processEvents(
  events: EcommerceEvent[],
  rules: Rule[] = DEFAULT_RULES
): RuleEvaluation[] {
  return events.flatMap((e) => evaluateRules(e, rules));
}

// ─────────────────────────────────────────────────────────────────────────────
// Conflict resolution — group by (product_id, action.type), highest priority wins.
// Returns { applied, overridden } so callers can log overrides.
// ─────────────────────────────────────────────────────────────────────────────
export interface ResolvedRuleSet {
  applied: RuleEvaluation[];
  overridden: Array<RuleEvaluation & { overridden_by: string }>;
}

export function resolveRuleConflicts(
  evaluations: RuleEvaluation[]
): ResolvedRuleSet {
  const applied: RuleEvaluation[] = [];
  const overridden: ResolvedRuleSet["overridden"] = [];

  // Bucket by (product_id || "_global_") + action.type
  const buckets = new Map<string, RuleEvaluation[]>();
  for (const ev of evaluations) {
    const key = `${ev.product_id ?? "_global_"}::${ev.action.type}`;
    const list = buckets.get(key) ?? [];
    list.push(ev);
    buckets.set(key, list);
  }

  for (const list of buckets.values()) {
    // Lower priority number wins; tie → first by rule_id (deterministic)
    list.sort((a, b) =>
      a.priority !== b.priority
        ? a.priority - b.priority
        : a.rule_id.localeCompare(b.rule_id)
    );
    const [winner, ...losers] = list;
    applied.push(winner);
    for (const l of losers) {
      overridden.push({ ...l, overridden_by: winner.rule_id });
    }
  }

  return { applied, overridden };
}

// ─────────────────────────────────────────────────────────────────────────────
// One-shot helper: events → evaluate → resolve
// ─────────────────────────────────────────────────────────────────────────────
export function runRuleEngine(
  events: EcommerceEvent[],
  rules: Rule[] = DEFAULT_RULES
): ResolvedRuleSet & { evaluated: number; matched: number } {
  const evaluations = processEvents(events, rules);
  const resolved = resolveRuleConflicts(evaluations);
  return {
    ...resolved,
    evaluated: events.length,
    matched: evaluations.length,
  };
}
