/**
 * ECOMMERCE EVENT SYSTEM
 *
 * Deterministic, rule-based event emitter for the ecommerce automation layer.
 * NO AI. NO heuristics. Every event is the output of a pure function from
 * inputs (product/sales/stock/traffic data) → boolean threshold decision.
 *
 * Pipeline:
 *   1. evaluateProductEvents(input)        → derives candidate events from state
 *   2. emitEvent(supabase, event)          → persists to public.ecommerce_events
 *   3. listRecentEvents(supabase, opts)    → reads back the log
 *   4. markEventProcessed(supabase, id)    → automation rule confirms it acted
 *
 * Storage: public.ecommerce_events (append-only, RLS-protected).
 */
import { supabase } from "@/integrations/supabase/client";

// ─────────────────────────────────────────────────────────────────────────────
// Event types — must match the Postgres enum `ecommerce_event_type`
// ─────────────────────────────────────────────────────────────────────────────
export type EcommerceEventType =
  | "product_view"
  | "product_no_sales"
  | "low_stock"
  | "high_stock"
  | "price_drop_needed"
  | "campaign_trigger";

export type EcommerceEventSeverity = "info" | "warning" | "critical";

/** Event payloads — strict, per-event-type shapes. */
export type EventPayloadMap = {
  product_view: {
    session_id?: string;
    referrer?: string;
    view_count_24h?: number;
  };
  product_no_sales: {
    days_since_last_sale: number;
    threshold_days: number;
    units_sold_30d: number;
  };
  low_stock: {
    stock: number;
    threshold: number;
    reserved: number;
  };
  high_stock: {
    stock: number;
    threshold: number;
    units_sold_30d: number;
    days_of_inventory: number;
  };
  price_drop_needed: {
    current_price: number;
    cost_price: number | null;
    margin_ratio: number | null;
    suggested_min_discount_pct: number;
    suggested_max_discount_pct: number;
    reason: "stagnation" | "high_stock" | "competitor_pressure";
  };
  campaign_trigger: {
    campaign_type:
      | "visibility_boost"
      | "clearance"
      | "conversion_opt"
      | "seasonal";
    trigger_reason: string;
  };
};

export interface EcommerceEvent<T extends EcommerceEventType = EcommerceEventType> {
  id?: string;
  event_type: T;
  product_id?: string | null;
  variant_id?: string | null;
  severity: EcommerceEventSeverity;
  source: string;
  payload: EventPayloadMap[T];
  emitted_at?: string;
  processed_at?: string | null;
  processed_by_rule?: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Rule thresholds — single source of truth, deterministic constants.
// Adjust these to change behavior; never inject runtime/AI-derived values.
// ─────────────────────────────────────────────────────────────────────────────
export const EVENT_THRESHOLDS = {
  no_sales_days: 30,
  low_stock_units: 5,
  high_stock_units: 100,
  high_stock_days_of_inventory: 90,
  price_drop_min_pct: 0.1,   // 10%
  price_drop_max_pct: 0.2,   // 20%
  min_margin_ratio: 1.2,     // safety floor: price ≥ cost × 1.2
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Input shape for the deterministic evaluator
// ─────────────────────────────────────────────────────────────────────────────
export interface ProductEvaluationInput {
  product_id: string;
  variant_id?: string | null;
  current_price: number;
  cost_price: number | null;
  stock: number;
  reserved_stock: number;
  units_sold_30d: number;
  days_since_last_sale: number;
  product_age_days: number;
  competitor_price?: number | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Pure event evaluator — deterministic, no side effects.
// Same input ALWAYS produces the same set of events.
// ─────────────────────────────────────────────────────────────────────────────
export function evaluateProductEvents(
  input: ProductEvaluationInput
): EcommerceEvent[] {
  const events: EcommerceEvent[] = [];
  const base = {
    product_id: input.product_id,
    variant_id: input.variant_id ?? null,
    source: "rule_evaluator",
  };

  // 1. product_no_sales — stagnation detection
  if (
    input.product_age_days >= EVENT_THRESHOLDS.no_sales_days &&
    input.units_sold_30d === 0
  ) {
    events.push({
      ...base,
      event_type: "product_no_sales",
      severity: "warning",
      payload: {
        days_since_last_sale: input.days_since_last_sale,
        threshold_days: EVENT_THRESHOLDS.no_sales_days,
        units_sold_30d: input.units_sold_30d,
      },
    });
  }

  // 2. low_stock — restock signal
  const availableStock = input.stock - input.reserved_stock;
  if (availableStock <= EVENT_THRESHOLDS.low_stock_units && availableStock >= 0) {
    events.push({
      ...base,
      event_type: "low_stock",
      severity: availableStock === 0 ? "critical" : "warning",
      payload: {
        stock: input.stock,
        threshold: EVENT_THRESHOLDS.low_stock_units,
        reserved: input.reserved_stock,
      },
    });
  }

  // 3. high_stock — overstock detection
  const dailyVelocity = input.units_sold_30d / 30;
  const daysOfInventory = dailyVelocity > 0
    ? Math.round(availableStock / dailyVelocity)
    : Infinity;

  if (
    availableStock >= EVENT_THRESHOLDS.high_stock_units &&
    daysOfInventory >= EVENT_THRESHOLDS.high_stock_days_of_inventory
  ) {
    events.push({
      ...base,
      event_type: "high_stock",
      severity: "info",
      payload: {
        stock: input.stock,
        threshold: EVENT_THRESHOLDS.high_stock_units,
        units_sold_30d: input.units_sold_30d,
        days_of_inventory: daysOfInventory === Infinity ? 9999 : daysOfInventory,
      },
    });
  }

  // 4. price_drop_needed — pricing pressure
  const marginRatio = input.cost_price && input.cost_price > 0
    ? input.current_price / input.cost_price
    : null;
  const marginAllowsDrop = marginRatio === null
    ? true // unknown cost → allow (safety enforced elsewhere by priorityResolver)
    : marginRatio > EVENT_THRESHOLDS.min_margin_ratio;

  let dropReason: "stagnation" | "high_stock" | "competitor_pressure" | null = null;
  if (input.product_age_days >= EVENT_THRESHOLDS.no_sales_days && input.units_sold_30d === 0) {
    dropReason = "stagnation";
  } else if (
    availableStock >= EVENT_THRESHOLDS.high_stock_units &&
    daysOfInventory >= EVENT_THRESHOLDS.high_stock_days_of_inventory
  ) {
    dropReason = "high_stock";
  } else if (
    input.competitor_price != null &&
    input.competitor_price > 0 &&
    input.current_price > input.competitor_price * 1.05
  ) {
    dropReason = "competitor_pressure";
  }

  if (dropReason && marginAllowsDrop) {
    events.push({
      ...base,
      event_type: "price_drop_needed",
      severity: "info",
      payload: {
        current_price: input.current_price,
        cost_price: input.cost_price,
        margin_ratio: marginRatio,
        suggested_min_discount_pct: EVENT_THRESHOLDS.price_drop_min_pct,
        suggested_max_discount_pct: EVENT_THRESHOLDS.price_drop_max_pct,
        reason: dropReason,
      },
    });
  }

  // 5. campaign_trigger — derived from above events (deterministic chain)
  if (dropReason === "stagnation") {
    events.push({
      ...base,
      event_type: "campaign_trigger",
      severity: "info",
      payload: {
        campaign_type: "visibility_boost",
        trigger_reason: "product_no_sales",
      },
    });
  } else if (dropReason === "high_stock") {
    events.push({
      ...base,
      event_type: "campaign_trigger",
      severity: "info",
      payload: {
        campaign_type: "clearance",
        trigger_reason: "high_stock",
      },
    });
  }

  return events;
}

// ─────────────────────────────────────────────────────────────────────────────
// Persistence — wraps the SECURITY DEFINER RPC `emit_ecommerce_event`
// ─────────────────────────────────────────────────────────────────────────────
export async function emitEvent<T extends EcommerceEventType>(
  event: EcommerceEvent<T>
): Promise<{ id: string | null; error: string | null }> {
  const { data, error } = await (supabase as any).rpc("emit_ecommerce_event", {
    p_event_type: event.event_type,
    p_product_id: event.product_id ?? null,
    p_variant_id: event.variant_id ?? null,
    p_severity: event.severity,
    p_source: event.source,
    p_payload: event.payload as any,
  });

  if (error) {
    console.error("[ecommerceEvents] emit failed", error);
    return { id: null, error: error.message };
  }
  return { id: (data as string) ?? null, error: null };
}

/** Emit a batch of evaluated events. Returns count of successful inserts. */
export async function emitEvents(
  events: EcommerceEvent[]
): Promise<{ emitted: number; failed: number }> {
  let emitted = 0;
  let failed = 0;
  for (const e of events) {
    const { error } = await emitEvent(e);
    if (error) failed += 1;
    else emitted += 1;
  }
  return { emitted, failed };
}

// ─────────────────────────────────────────────────────────────────────────────
// Reading the log
// ─────────────────────────────────────────────────────────────────────────────
export interface ListEventOptions {
  event_type?: EcommerceEventType;
  product_id?: string;
  unprocessed_only?: boolean;
  limit?: number;
}

export async function listRecentEvents(opts: ListEventOptions = {}) {
  let q = (supabase as any)
    .from("ecommerce_events")
    .select("*")
    .order("emitted_at", { ascending: false })
    .limit(opts.limit ?? 100);

  if (opts.event_type) q = q.eq("event_type", opts.event_type);
  if (opts.product_id) q = q.eq("product_id", opts.product_id);
  if (opts.unprocessed_only) q = q.is("processed_at", null);

  const { data, error } = await q;
  if (error) {
    console.error("[ecommerceEvents] listRecentEvents failed", error);
    return [];
  }
  return (data ?? []) as EcommerceEvent[];
}

export async function markEventProcessed(
  eventId: string,
  ruleName: string
): Promise<boolean> {
  const { error } = await (supabase as any)
    .from("ecommerce_events")
    .update({
      processed_at: new Date().toISOString(),
      processed_by_rule: ruleName,
    })
    .eq("id", eventId);

  if (error) {
    console.error("[ecommerceEvents] markEventProcessed failed", error);
    return false;
  }
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// One-shot helper: evaluate + emit for a list of products
// ─────────────────────────────────────────────────────────────────────────────
export async function runEventEvaluation(
  inputs: ProductEvaluationInput[]
): Promise<{
  evaluated: number;
  events_generated: number;
  events_emitted: number;
  events_failed: number;
}> {
  const allEvents = inputs.flatMap(evaluateProductEvents);
  const { emitted, failed } = await emitEvents(allEvents);
  return {
    evaluated: inputs.length,
    events_generated: allEvents.length,
    events_emitted: emitted,
    events_failed: failed,
  };
}
