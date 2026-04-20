/**
 * EVENT-DRIVEN DISCOUNT ENGINE
 *
 * Pure, deterministic pricing adjustments based on system events.
 * No randomness — same input → same output.
 *
 * Rules:
 *   product_stagnation          → 10–20%   (priority 2)
 *   high_demand                 → 0–5%     (priority 4)
 *   seasonal_event_active       → campaign (priority 1)
 *   competitor_pressure_detected→ match_price - margin_buffer (priority 3)
 *
 * Constraints:
 *   - resulting price must respect min_margin_pct
 *   - per product, only the highest-priority discount applies (lowest number = highest priority)
 */

export type DiscountEventType =
  | "product_stagnation"
  | "high_demand"
  | "seasonal_event_active"
  | "competitor_pressure_detected";

export interface ProductPricingInput {
  readonly product_id: string;
  readonly base_price: number;
  readonly cost_price: number;
  readonly min_margin_pct: number; // 0..1, e.g. 0.15 = 15%
}

export interface DiscountEventInput {
  readonly product_id: string;
  readonly event_type: DiscountEventType;
  /** stagnation_days for product_stagnation */
  readonly stagnation_days?: number;
  /** demand_index ∈ [0,1] for high_demand */
  readonly demand_index?: number;
  /** campaign_pct ∈ [0,1] for seasonal_event_active */
  readonly campaign_pct?: number;
  readonly campaign_label?: string;
  /** competitor_price for competitor_pressure_detected */
  readonly competitor_price?: number;
  /** margin_buffer absolute currency for competitor flow */
  readonly margin_buffer?: number;
}

export interface DiscountEngineInput {
  readonly products: ReadonlyArray<ProductPricingInput>;
  readonly events: ReadonlyArray<DiscountEventInput>;
}

export interface ActiveDiscount {
  readonly product_id: string;
  readonly event_type: DiscountEventType;
  readonly priority: number;
  readonly base_price: number;
  readonly final_price: number;
  readonly discount_pct: number;
  readonly discount_amount: number;
  readonly reason: string;
  readonly capped_by_margin: boolean;
}

export interface SuppressedDiscount {
  readonly product_id: string;
  readonly event_type: DiscountEventType;
  readonly suppressed_reason: string;
}

export interface DiscountEngineReport {
  readonly active_discounts: ReadonlyArray<ActiveDiscount>;
  readonly suppressed_discounts: ReadonlyArray<SuppressedDiscount>;
  readonly affected_products: ReadonlyArray<string>;
  readonly summary: {
    readonly products_evaluated: number;
    readonly events_evaluated: number;
    readonly active_count: number;
    readonly suppressed_count: number;
  };
}

const PRIORITY: Record<DiscountEventType, number> = {
  seasonal_event_active: 1,
  product_stagnation: 2,
  competitor_pressure_detected: 3,
  high_demand: 4,
};

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const round2 = (n: number) => Math.round(n * 100) / 100;

interface Candidate {
  readonly event: DiscountEventInput;
  readonly product: ProductPricingInput;
  readonly raw_pct: number;
  readonly reason: string;
}

function computeRawPct(event: DiscountEventInput): { pct: number; reason: string } | null {
  switch (event.event_type) {
    case "product_stagnation": {
      const days = event.stagnation_days ?? 0;
      // 0 days → 0%, ≥60 days → 20%, linear, floor 10% if any stagnation flagged
      if (days <= 0) return null;
      const linear = clamp(days / 60, 0, 1) * 0.2;
      const pct = clamp(Math.max(0.1, linear), 0.1, 0.2);
      return { pct, reason: `Stagnation ${days}d → ${(pct * 100).toFixed(0)}% off` };
    }
    case "high_demand": {
      const idx = clamp(event.demand_index ?? 1, 0, 1);
      // demand 1.0 → 0%, demand 0.0 → 5%
      const pct = clamp((1 - idx) * 0.05, 0, 0.05);
      if (pct === 0) return null;
      return { pct, reason: `High demand (idx ${idx.toFixed(2)}) → ${(pct * 100).toFixed(1)}% off` };
    }
    case "seasonal_event_active": {
      const pct = clamp(event.campaign_pct ?? 0, 0, 0.5);
      if (pct === 0) return null;
      const label = event.campaign_label ?? "campaign";
      return { pct, reason: `Seasonal ${label} → ${(pct * 100).toFixed(0)}% off` };
    }
    case "competitor_pressure_detected": {
      // handled separately because it depends on product price
      return { pct: 0, reason: "competitor" };
    }
  }
}

function buildCandidate(
  event: DiscountEventInput,
  product: ProductPricingInput,
): Candidate | null {
  if (event.event_type === "competitor_pressure_detected") {
    const comp = event.competitor_price;
    const buf = event.margin_buffer ?? 0;
    if (comp == null || comp <= 0) return null;
    const target = comp - buf;
    if (target >= product.base_price) return null;
    const pct = clamp((product.base_price - target) / product.base_price, 0, 1);
    return {
      event,
      product,
      raw_pct: pct,
      reason: `Competitor ${comp.toFixed(2)} − buffer ${buf.toFixed(2)} → match ${target.toFixed(2)}`,
    };
  }

  const raw = computeRawPct(event);
  if (!raw) return null;
  return { event, product, raw_pct: raw.pct, reason: raw.reason };
}

function applyMarginCap(
  product: ProductPricingInput,
  rawPct: number,
): { final_price: number; final_pct: number; capped: boolean } {
  const minAllowed = product.cost_price * (1 + product.min_margin_pct);
  const desired = product.base_price * (1 - rawPct);
  if (desired >= minAllowed) {
    return { final_price: round2(desired), final_pct: rawPct, capped: false };
  }
  if (minAllowed >= product.base_price) {
    // can't discount at all
    return { final_price: round2(product.base_price), final_pct: 0, capped: true };
  }
  const cappedPct = (product.base_price - minAllowed) / product.base_price;
  return { final_price: round2(minAllowed), final_pct: cappedPct, capped: true };
}

export function runDiscountEngine(input: DiscountEngineInput): DiscountEngineReport {
  const productMap = new Map<string, ProductPricingInput>();
  for (const p of input.products) productMap.set(p.product_id, p);

  // Group candidates per product
  const perProduct = new Map<string, Candidate[]>();
  const suppressed: SuppressedDiscount[] = [];

  for (const ev of input.events) {
    const product = productMap.get(ev.product_id);
    if (!product) {
      suppressed.push({
        product_id: ev.product_id,
        event_type: ev.event_type,
        suppressed_reason: "unknown product",
      });
      continue;
    }
    const cand = buildCandidate(ev, product);
    if (!cand) {
      suppressed.push({
        product_id: ev.product_id,
        event_type: ev.event_type,
        suppressed_reason: "event produced 0% discount",
      });
      continue;
    }
    const list = perProduct.get(ev.product_id) ?? [];
    list.push(cand);
    perProduct.set(ev.product_id, list);
  }

  const active: ActiveDiscount[] = [];
  for (const [productId, candidates] of perProduct) {
    // Sort by priority asc; tiebreak by larger raw_pct
    const sorted = [...candidates].sort((a, b) => {
      const pa = PRIORITY[a.event.event_type];
      const pb = PRIORITY[b.event.event_type];
      if (pa !== pb) return pa - pb;
      return b.raw_pct - a.raw_pct;
    });
    const winner = sorted[0];
    for (let i = 1; i < sorted.length; i++) {
      suppressed.push({
        product_id: productId,
        event_type: sorted[i].event.event_type,
        suppressed_reason: `lower priority than ${winner.event.event_type}`,
      });
    }
    const { final_price, final_pct, capped } = applyMarginCap(winner.product, winner.raw_pct);
    if (final_pct === 0) {
      suppressed.push({
        product_id: productId,
        event_type: winner.event.event_type,
        suppressed_reason: "margin floor blocks discount",
      });
      continue;
    }
    active.push({
      product_id: productId,
      event_type: winner.event.event_type,
      priority: PRIORITY[winner.event.event_type],
      base_price: round2(winner.product.base_price),
      final_price,
      discount_pct: round2(final_pct * 100) / 100,
      discount_amount: round2(winner.product.base_price - final_price),
      reason: capped ? `${winner.reason} (capped by min margin)` : winner.reason,
      capped_by_margin: capped,
    });
  }

  // Deterministic ordering
  active.sort((a, b) =>
    a.product_id === b.product_id ? a.priority - b.priority : a.product_id.localeCompare(b.product_id),
  );
  suppressed.sort((a, b) =>
    a.product_id === b.product_id
      ? a.event_type.localeCompare(b.event_type)
      : a.product_id.localeCompare(b.product_id),
  );

  const affected = Array.from(new Set(active.map((a) => a.product_id))).sort();

  return Object.freeze({
    active_discounts: Object.freeze(active),
    suppressed_discounts: Object.freeze(suppressed),
    affected_products: Object.freeze(affected),
    summary: Object.freeze({
      products_evaluated: input.products.length,
      events_evaluated: input.events.length,
      active_count: active.length,
      suppressed_count: suppressed.length,
    }),
  });
}
