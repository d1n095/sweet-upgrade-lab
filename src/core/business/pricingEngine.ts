/**
 * DETERMINISTIC PRICING ENGINE
 *
 * Pure function — same input → same output. No AI, no randomness, no time
 * lookups inside the calculator (caller passes evaluated_at).
 *
 * INPUTS  (per product)
 *   base_price       current list price
 *   cost_price       unit cost (margin floor reference)
 *   stock            on-hand units
 *   sales_velocity   units sold per day (recent window, caller-defined)
 *   product_age_days days since first listed
 *   sales_30d        units sold in the last 30 days (for the "sales = 0" rule)
 *
 * RULES (priority order — first match wins per direction)
 *   R1  product_age > 30d AND sales_30d = 0   → discount 10–20% (linear by age)
 *   R2  stock high AND demand low             → discount 15%
 *   R3  demand high                           → +5% price (capped)
 *
 * SAFETY
 *   - final_price is always clamped to ≥ cost_price * (1 + MIN_MARGIN_PCT)
 *   - discounts that would breach the floor are clamped (never silently dropped)
 *
 * OUTPUTS
 *   - calculateFinalPrice()  — pure calculator, returns PriceDecision
 *   - applyPriceDecision()   — writes to products.price; the existing
 *                              `log_product_price_change` trigger records the
 *                              full audit row in `price_history`
 *   - runPricingEngine()     — batch helper: calc + (optional) apply
 */
import { supabase } from "@/integrations/supabase/client";
import { logChange } from "@/utils/changeLogger";

// ─────────────────────────────────────────────────────────────────────────────
// Tunable thresholds — change these to change behavior. Never inject runtime.
// ─────────────────────────────────────────────────────────────────────────────
export const PRICING_THRESHOLDS = Object.freeze({
  STAGNATION_AGE_DAYS: 30,
  STAGNATION_MIN_DISCOUNT: 0.10,
  STAGNATION_MAX_DISCOUNT: 0.20,
  /** Age at which stagnation discount caps out at MAX. */
  STAGNATION_FULL_AGE_DAYS: 90,

  HIGH_STOCK_UNITS: 100,
  LOW_DEMAND_VELOCITY: 0.5, // units/day
  SLOW_MOVING_DISCOUNT: 0.15,

  HIGH_DEMAND_VELOCITY: 5, // units/day
  HIGH_DEMAND_INCREASE: 0.05,
  HIGH_DEMAND_MAX_INCREASE: 0.05, // hard cap on +%

  MIN_MARGIN_PCT: 0.15, // floor: price ≥ cost * 1.15
});

export type PricingRuleId =
  | "R1_stagnation"
  | "R2_high_stock_low_demand"
  | "R3_high_demand"
  | "NONE";

export interface PricingInput {
  readonly product_id: string;
  readonly base_price: number;
  readonly cost_price: number;
  readonly stock: number;
  readonly sales_velocity: number; // units/day
  readonly product_age_days: number;
  readonly sales_30d: number;
}

export interface PriceDecision {
  readonly product_id: string;
  readonly base_price: number;
  readonly final_price: number;
  readonly delta_pct: number; // +/- vs base_price
  readonly direction: "discount" | "increase" | "none";
  readonly rule_id: PricingRuleId;
  readonly reason: string;
  readonly margin_clamped: boolean;
  readonly evaluated_at: string;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const clamp = (n: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, n));

/**
 * Pure final-price calculator. Deterministic for fixed input.
 */
export function calculateFinalPrice(
  input: PricingInput,
  evaluated_at: string = new Date().toISOString(),
): PriceDecision {
  const t = PRICING_THRESHOLDS;
  const base = input.base_price;

  // SAFETY floor — final price can never go below this.
  const minPrice =
    input.cost_price > 0 ? input.cost_price * (1 + t.MIN_MARGIN_PCT) : 0;

  // ── R1: stagnation (age > 30d AND sales = 0) ──────────────────────────────
  if (
    input.product_age_days > t.STAGNATION_AGE_DAYS &&
    input.sales_30d === 0
  ) {
    const span = t.STAGNATION_FULL_AGE_DAYS - t.STAGNATION_AGE_DAYS;
    const progress = clamp(
      (input.product_age_days - t.STAGNATION_AGE_DAYS) / span,
      0,
      1,
    );
    const rawPct =
      t.STAGNATION_MIN_DISCOUNT +
      progress * (t.STAGNATION_MAX_DISCOUNT - t.STAGNATION_MIN_DISCOUNT);
    return finalizeDiscount(
      input,
      base,
      rawPct,
      "R1_stagnation",
      `age=${input.product_age_days}d sales_30d=0 → ${(rawPct * 100).toFixed(0)}% off`,
      minPrice,
      evaluated_at,
    );
  }

  // ── R2: high stock AND low demand ─────────────────────────────────────────
  if (
    input.stock > t.HIGH_STOCK_UNITS &&
    input.sales_velocity < t.LOW_DEMAND_VELOCITY
  ) {
    return finalizeDiscount(
      input,
      base,
      t.SLOW_MOVING_DISCOUNT,
      "R2_high_stock_low_demand",
      `stock=${input.stock} velocity=${input.sales_velocity}/d → 15% off`,
      minPrice,
      evaluated_at,
    );
  }

  // ── R3: high demand → small price increase ────────────────────────────────
  if (input.sales_velocity >= t.HIGH_DEMAND_VELOCITY) {
    const pct = clamp(t.HIGH_DEMAND_INCREASE, 0, t.HIGH_DEMAND_MAX_INCREASE);
    const candidate = round2(base * (1 + pct));
    return {
      product_id: input.product_id,
      base_price: round2(base),
      final_price: candidate,
      delta_pct: pct,
      direction: "increase",
      rule_id: "R3_high_demand",
      reason: `velocity=${input.sales_velocity}/d ≥ ${t.HIGH_DEMAND_VELOCITY} → +${(pct * 100).toFixed(0)}%`,
      margin_clamped: false,
      evaluated_at,
    };
  }

  // ── NONE: no rule matched ─────────────────────────────────────────────────
  return {
    product_id: input.product_id,
    base_price: round2(base),
    final_price: round2(base),
    delta_pct: 0,
    direction: "none",
    rule_id: "NONE",
    reason: "no rule matched",
    margin_clamped: false,
    evaluated_at,
  };
}

function finalizeDiscount(
  input: PricingInput,
  base: number,
  rawPct: number,
  rule_id: PricingRuleId,
  reasonPrefix: string,
  minPrice: number,
  evaluated_at: string,
): PriceDecision {
  const candidate = base * (1 - rawPct);
  let final = candidate;
  let clamped = false;
  let reason = reasonPrefix;
  if (minPrice > 0 && final < minPrice) {
    final = minPrice;
    clamped = true;
    reason = `${reasonPrefix} (clamped by margin floor ${round2(minPrice)})`;
  }
  final = round2(final);
  const effectivePct = base > 0 ? (base - final) / base : 0;
  return {
    product_id: input.product_id,
    base_price: round2(base),
    final_price: final,
    delta_pct: -round4(effectivePct),
    direction: "discount",
    rule_id,
    reason,
    margin_clamped: clamped,
    evaluated_at,
  };
}

const round4 = (n: number) => Math.round(n * 10_000) / 10_000;

// ─────────────────────────────────────────────────────────────────────────────
// PERSISTENCE — `products.price` is the only column we touch. The DB trigger
// `log_product_price_change` automatically writes the audit row to
// `price_history` (old_price, new_price, source, changed_by). We additionally
// write a `change_log` entry so the app-side audit timeline shows the rule.
// ─────────────────────────────────────────────────────────────────────────────
export interface ApplyResult {
  product_id: string;
  applied: boolean;
  reason: string;
  old_price?: number;
  new_price?: number;
  error?: string;
}

export async function applyPriceDecision(
  decision: PriceDecision,
): Promise<ApplyResult> {
  if (decision.direction === "none" || decision.final_price === decision.base_price) {
    return {
      product_id: decision.product_id,
      applied: false,
      reason: "no price change",
    };
  }

  const { error } = await (supabase as any)
    .from("products")
    .update({ price: decision.final_price, updated_at: new Date().toISOString() })
    .eq("id", decision.product_id);

  if (error) {
    return {
      product_id: decision.product_id,
      applied: false,
      reason: "update failed",
      error: error.message,
    };
  }

  await logChange({
    change_type: "pricing_engine",
    description: `pricingEngine ${decision.rule_id}: ${decision.product_id} ${decision.base_price} → ${decision.final_price}`,
    source: "automation",
    affected_components: ["pricingEngine", "products", "price_history"],
    metadata: {
      product_id: decision.product_id,
      rule_id: decision.rule_id,
      direction: decision.direction,
      base_price: decision.base_price,
      final_price: decision.final_price,
      delta_pct: decision.delta_pct,
      margin_clamped: decision.margin_clamped,
      reason: decision.reason,
      evaluated_at: decision.evaluated_at,
    },
  });

  return {
    product_id: decision.product_id,
    applied: true,
    reason: decision.reason,
    old_price: decision.base_price,
    new_price: decision.final_price,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// BATCH RUNNER
// ─────────────────────────────────────────────────────────────────────────────
export interface PricingEngineReport {
  evaluated_at: string;
  decisions: PriceDecision[];
  applied: ApplyResult[];
  summary: {
    total: number;
    discounts: number;
    increases: number;
    no_change: number;
    margin_clamps: number;
    persisted: number;
    failed: number;
  };
}

export interface PricingEngineOptions {
  /** When false, calculates only — never writes to DB. Default false (preview). */
  apply?: boolean;
}

export async function runPricingEngine(
  inputs: ReadonlyArray<PricingInput>,
  opts: PricingEngineOptions = {},
): Promise<PricingEngineReport> {
  const evaluated_at = new Date().toISOString();
  const decisions = inputs.map((i) => calculateFinalPrice(i, evaluated_at));

  const applied: ApplyResult[] = [];
  if (opts.apply) {
    for (const d of decisions) {
      applied.push(await applyPriceDecision(d));
    }
  }

  const summary = {
    total: decisions.length,
    discounts: decisions.filter((d) => d.direction === "discount").length,
    increases: decisions.filter((d) => d.direction === "increase").length,
    no_change: decisions.filter((d) => d.direction === "none").length,
    margin_clamps: decisions.filter((d) => d.margin_clamped).length,
    persisted: applied.filter((a) => a.applied).length,
    failed: applied.filter((a) => !!a.error).length,
  };

  await logChange({
    change_type: "pricing_engine_run",
    description: `pricingEngine batch: ${summary.total} evaluated, ${summary.discounts} discounts, ${summary.increases} increases, ${summary.persisted} persisted (apply=${!!opts.apply})`,
    source: "automation",
    affected_components: ["pricingEngine"],
    metadata: { evaluated_at, summary, apply: !!opts.apply },
  });

  return { evaluated_at, decisions, applied, summary };
}
