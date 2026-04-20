/**
 * AUTO CAMPAIGN TRIGGER
 *
 * Deterministic engine that starts marketing campaigns based on product/sales signals.
 * Pure function — same input → same output.
 *
 * Triggers:
 *   product_age > threshold AND sales = 0    → "visibility_boost"   (priority 2)
 *   stock_high AND demand_low                → "clearance"          (priority 3)
 *   traffic_spike_detected                   → "conversion_opt"     (priority 1)
 *
 * Rules:
 *   - every campaign has start_at / end_at
 *   - per product scope, only highest-priority campaign applies (lowest number wins)
 *   - conflicting discount rules are suppressed (logged)
 */

export type AutoCampaignType = "visibility_boost" | "clearance" | "conversion_opt";

export interface ProductSignal {
  readonly product_id: string;
  readonly title?: string;
  readonly age_days: number;
  readonly sales_last_30d: number;
  readonly stock_level: number;
  readonly stock_high_threshold: number;
  readonly demand_index: number; // 0..1
  readonly traffic_index: number; // 0..1
  readonly base_price: number;
}

export interface AutoTriggerInput {
  readonly now: string;
  readonly products: ReadonlyArray<ProductSignal>;
  readonly thresholds?: {
    readonly stagnation_age_days?: number; // default 45
    readonly low_demand_max?: number; // default 0.3
    readonly traffic_spike_min?: number; // default 0.75
  };
  /** existing manual discount rules to detect conflicts */
  readonly existing_discount_product_ids?: ReadonlyArray<string>;
}

export interface ActiveCampaign {
  readonly id: string;
  readonly type: AutoCampaignType;
  readonly priority: number;
  readonly product_id: string;
  readonly product_title?: string;
  readonly discount_pct: number;
  readonly start_at: string;
  readonly end_at: string;
  readonly reason: string;
}

export interface TriggeredCampaignLog {
  readonly id: string;
  readonly type: AutoCampaignType;
  readonly product_id: string;
  readonly status: "applied" | "suppressed";
  readonly suppressed_by?: string;
  readonly conflict?: "lower_priority" | "manual_discount_active";
}

export interface CampaignImpact {
  readonly campaign_id: string;
  readonly product_id: string;
  readonly type: AutoCampaignType;
  readonly expected_uplift_pct: number;
  readonly expected_revenue_delta: number;
  readonly confidence: number; // 0..1
}

export interface AutoTriggerReport {
  readonly evaluated_at: string;
  readonly active_campaigns: ReadonlyArray<ActiveCampaign>;
  readonly triggered_campaigns: ReadonlyArray<TriggeredCampaignLog>;
  readonly campaign_impact: ReadonlyArray<CampaignImpact>;
  readonly summary: {
    readonly products_evaluated: number;
    readonly active_count: number;
    readonly suppressed_count: number;
    readonly total_expected_revenue_delta: number;
  };
}

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

const PRIORITY: Record<AutoCampaignType, number> = {
  conversion_opt: 1,
  visibility_boost: 2,
  clearance: 3,
};

const DURATION_DAYS: Record<AutoCampaignType, number> = {
  conversion_opt: 3,
  visibility_boost: 14,
  clearance: 21,
};

const DISCOUNT_PCT: Record<AutoCampaignType, number> = {
  conversion_opt: 0.05,
  visibility_boost: 0.1,
  clearance: 0.25,
};

const UPLIFT_PCT: Record<AutoCampaignType, number> = {
  conversion_opt: 0.15,
  visibility_boost: 0.2,
  clearance: 0.35,
};

const CONFIDENCE: Record<AutoCampaignType, number> = {
  conversion_opt: 0.75,
  visibility_boost: 0.55,
  clearance: 0.65,
};

const round2 = (n: number) => Math.round(n * 100) / 100;

interface Candidate {
  readonly type: AutoCampaignType;
  readonly product: ProductSignal;
  readonly reason: string;
}

function evaluateProduct(
  p: ProductSignal,
  th: Required<NonNullable<AutoTriggerInput["thresholds"]>>,
): Candidate[] {
  const out: Candidate[] = [];

  if (p.age_days > th.stagnation_age_days && p.sales_last_30d === 0) {
    out.push({
      type: "visibility_boost",
      product: p,
      reason: `age ${p.age_days}d > ${th.stagnation_age_days}d, sales=0`,
    });
  }
  if (p.stock_level >= p.stock_high_threshold && p.demand_index <= th.low_demand_max) {
    out.push({
      type: "clearance",
      product: p,
      reason: `stock ${p.stock_level} ≥ ${p.stock_high_threshold}, demand ${p.demand_index.toFixed(2)} ≤ ${th.low_demand_max}`,
    });
  }
  if (p.traffic_index >= th.traffic_spike_min) {
    out.push({
      type: "conversion_opt",
      product: p,
      reason: `traffic ${p.traffic_index.toFixed(2)} ≥ ${th.traffic_spike_min}`,
    });
  }

  return out;
}

export function runAutoCampaignTrigger(input: AutoTriggerInput): AutoTriggerReport {
  const now = Date.parse(input.now);
  if (Number.isNaN(now)) throw new Error(`invalid now: ${input.now}`);

  const th = {
    stagnation_age_days: input.thresholds?.stagnation_age_days ?? 45,
    low_demand_max: input.thresholds?.low_demand_max ?? 0.3,
    traffic_spike_min: input.thresholds?.traffic_spike_min ?? 0.75,
  };
  const blockedByManual = new Set(input.existing_discount_product_ids ?? []);

  const active: ActiveCampaign[] = [];
  const triggered: TriggeredCampaignLog[] = [];
  const impacts: CampaignImpact[] = [];

  for (const product of input.products) {
    const cands = evaluateProduct(product, th);
    if (cands.length === 0) continue;

    // Sort by priority asc; deterministic
    const sorted = [...cands].sort(
      (a, b) => PRIORITY[a.type] - PRIORITY[b.type] || a.type.localeCompare(b.type),
    );
    const winner = sorted[0];
    const winnerId = `auto_${winner.type}_${product.product_id}`;

    if (blockedByManual.has(product.product_id)) {
      triggered.push({
        id: winnerId,
        type: winner.type,
        product_id: product.product_id,
        status: "suppressed",
        conflict: "manual_discount_active",
      });
      // suppress all candidates for this product
      for (let i = 1; i < sorted.length; i++) {
        triggered.push({
          id: `auto_${sorted[i].type}_${product.product_id}`,
          type: sorted[i].type,
          product_id: product.product_id,
          status: "suppressed",
          conflict: "manual_discount_active",
        });
      }
      continue;
    }

    const startMs = now;
    const endMs = now + DURATION_DAYS[winner.type] * DAY_MS;
    const discountPct = DISCOUNT_PCT[winner.type];

    active.push({
      id: winnerId,
      type: winner.type,
      priority: PRIORITY[winner.type],
      product_id: product.product_id,
      product_title: product.title,
      discount_pct: discountPct,
      start_at: new Date(startMs).toISOString(),
      end_at: new Date(endMs).toISOString(),
      reason: winner.reason,
    });
    triggered.push({
      id: winnerId,
      type: winner.type,
      product_id: product.product_id,
      status: "applied",
    });

    const expectedSalesBaseline = Math.max(product.sales_last_30d, 1);
    const upliftPct = UPLIFT_PCT[winner.type];
    const finalPrice = product.base_price * (1 - discountPct);
    const expectedRevenueDelta = round2(
      expectedSalesBaseline * upliftPct * finalPrice - expectedSalesBaseline * discountPct * product.base_price,
    );
    impacts.push({
      campaign_id: winnerId,
      product_id: product.product_id,
      type: winner.type,
      expected_uplift_pct: upliftPct,
      expected_revenue_delta: expectedRevenueDelta,
      confidence: CONFIDENCE[winner.type],
    });

    // Suppress lower-priority candidates with reason
    for (let i = 1; i < sorted.length; i++) {
      const lower = sorted[i];
      triggered.push({
        id: `auto_${lower.type}_${product.product_id}`,
        type: lower.type,
        product_id: product.product_id,
        status: "suppressed",
        suppressed_by: winnerId,
        conflict: "lower_priority",
      });
    }
  }

  // Deterministic ordering
  active.sort((a, b) => a.priority - b.priority || a.product_id.localeCompare(b.product_id));
  triggered.sort((a, b) =>
    a.product_id === b.product_id
      ? PRIORITY[a.type] - PRIORITY[b.type]
      : a.product_id.localeCompare(b.product_id),
  );
  impacts.sort((a, b) => b.expected_revenue_delta - a.expected_revenue_delta);

  const totalDelta = round2(impacts.reduce((sum, i) => sum + i.expected_revenue_delta, 0));

  return Object.freeze({
    evaluated_at: input.now,
    active_campaigns: Object.freeze(active),
    triggered_campaigns: Object.freeze(triggered),
    campaign_impact: Object.freeze(impacts),
    summary: Object.freeze({
      products_evaluated: input.products.length,
      active_count: active.length,
      suppressed_count: triggered.filter((t) => t.status === "suppressed").length,
      total_expected_revenue_delta: totalDelta,
    }),
  });
}

// silence unused warning if HOUR_MS becomes unused later
void HOUR_MS;
