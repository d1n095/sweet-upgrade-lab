/**
 * ECOMMERCE ORCHESTRATOR
 *
 * Single entry point that wires every business module into one deterministic
 * pipeline. NO AI. NO hidden branches. Same product state → same output.
 *
 *   PRODUCT  →  EVENT  →  RULE ENGINE  →  PRICING  →  CAMPAIGN  →  STORE UPDATE
 *
 * Each stage is a pure transformation of the previous stage's output.
 * Every stage logs its result via `logChange()` so the full chain is auditable.
 *
 * Stages
 * ──────
 * 1. PRODUCT      ProductEvaluationInput[]                 (caller-supplied)
 * 2. EVENT        evaluateProductEvents → emitEvents       (ecommerceEvents.ts)
 * 3. RULE ENGINE  runRuleEngine → ResolvedRuleSet          (ruleEngine.ts)
 * 4. PRICING      runDiscountEngine → DiscountEngineReport (discountEngine.ts)
 * 5. CAMPAIGN     handleEventActivation → activated ids    (campaignScheduler.ts)
 * 6. STORE UPDATE persist final prices + processed flags   (this file)
 */
import { supabase } from "@/integrations/supabase/client";
import {
  evaluateProductEvents,
  emitEvents,
  markEventProcessed,
  type EcommerceEvent,
  type ProductEvaluationInput,
} from "./ecommerceEvents";
import {
  runRuleEngine,
  type ResolvedRuleSet,
  type RuleEvaluation,
} from "./ruleEngine";
import {
  runDiscountEngine,
  type DiscountEngineReport,
  type DiscountEventInput,
  type ProductPricingInput,
} from "./discountEngine";
import { handleEventActivation } from "./campaignScheduler";
import { logChange } from "@/utils/changeLogger";

// ─────────────────────────────────────────────────────────────────────────────
// Pipeline result — fully observable, every stage exposes its output.
// ─────────────────────────────────────────────────────────────────────────────
export interface PipelineRunResult {
  run_id: string;
  started_at: string;
  finished_at: string;
  stages: {
    product:   { count: number };
    event:     { generated: number; emitted: number; failed: number; events: EcommerceEvent[] };
    rule:      { evaluated: number; matched: number; applied: number; overridden: number; resolved: ResolvedRuleSet };
    pricing:   { active: number; suppressed: number; report: DiscountEngineReport };
    campaign:  { activated_ids: string[]; errors: string[] };
    store:     { price_updates: number; events_marked: number; errors: string[] };
  };
  errors: string[];
}

export interface PipelineOptions {
  /** Override DiscountEvent inputs derived from rule evaluations (advanced/testing). */
  discount_event_overrides?: DiscountEventInput[];
  /** Persist price changes to `products`/`product_variants`. Default false (preview mode). */
  apply_price_updates?: boolean;
  /** Mark source events as processed once the chain succeeds. Default true. */
  mark_events_processed?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage 4 helper — translate matched rule actions into discount engine inputs.
// Pure mapping, no side effects.
// ─────────────────────────────────────────────────────────────────────────────
function ruleEvaluationsToDiscountEvents(
  evaluations: RuleEvaluation[],
): DiscountEventInput[] {
  const out: DiscountEventInput[] = [];
  for (const e of evaluations) {
    if (!e.product_id) continue;
    if (e.action.type === "apply_discount") {
      // Map rule reason → discount engine event_type (deterministic lookup).
      const reason = e.action.reason;
      if (reason.startsWith("product_no_sales")) {
        out.push({
          product_id: e.product_id,
          event_type: "product_stagnation",
          stagnation_days: 30,
        });
      } else if (reason.startsWith("high_stock")) {
        out.push({
          product_id: e.product_id,
          event_type: "seasonal_event_active",
          campaign_pct: e.action.discount_pct,
          campaign_label: "clearance",
        });
      } else if (reason.startsWith("price_drop")) {
        out.push({
          product_id: e.product_id,
          event_type: "seasonal_event_active",
          campaign_pct: e.action.discount_pct,
          campaign_label: "price_drop",
        });
      }
    }
  }
  return out;
}

function inputsToPricingInputs(
  inputs: ProductEvaluationInput[],
): ProductPricingInput[] {
  return inputs.map((i) => ({
    product_id: i.product_id,
    base_price: i.current_price,
    cost_price: i.cost_price ?? 0,
    min_margin_pct: 0.15, // SAFETY floor; matches discountEngine convention
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PIPELINE
// ─────────────────────────────────────────────────────────────────────────────
export async function runPipeline(
  inputs: ProductEvaluationInput[],
  opts: PipelineOptions = {},
): Promise<PipelineRunResult> {
  const run_id = `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const started_at = new Date().toISOString();
  const errors: string[] = [];

  // ── Stage 1: PRODUCT (input) ───────────────────────────────────────────────
  await logChange({
    change_type: "pipeline_stage",
    description: `[${run_id}] PRODUCT stage: ${inputs.length} products received`,
    source: "automation",
    affected_components: ["ecommerceOrchestrator", "PRODUCT"],
    metadata: { run_id, stage: "product", count: inputs.length },
  });

  // ── Stage 2: EVENT (evaluate + emit) ───────────────────────────────────────
  const events = inputs.flatMap(evaluateProductEvents);
  const { emitted, failed } = await emitEvents(events);
  await logChange({
    change_type: "pipeline_stage",
    description: `[${run_id}] EVENT stage: ${events.length} generated, ${emitted} emitted, ${failed} failed`,
    source: "automation",
    affected_components: ["ecommerceEvents", "EVENT"],
    metadata: { run_id, stage: "event", generated: events.length, emitted, failed },
  });

  // ── Stage 3: RULE ENGINE (evaluate + resolve conflicts) ───────────────────
  const ruleResult = runRuleEngine(events);
  await logChange({
    change_type: "pipeline_stage",
    description: `[${run_id}] RULE stage: ${ruleResult.matched} matched, ${ruleResult.applied.length} applied, ${ruleResult.overridden.length} overridden`,
    source: "automation",
    affected_components: ["ruleEngine", "RULE"],
    metadata: {
      run_id,
      stage: "rule",
      matched: ruleResult.matched,
      applied: ruleResult.applied.length,
      overridden: ruleResult.overridden.length,
      applied_rules: ruleResult.applied.map((a) => a.rule_id),
    },
  });

  // ── Stage 4: PRICING (deterministic discount calc with margin floor) ─────
  const discountEvents =
    opts.discount_event_overrides ??
    ruleEvaluationsToDiscountEvents(ruleResult.applied);
  const pricingReport = runDiscountEngine({
    products: inputsToPricingInputs(inputs),
    events: discountEvents,
  });
  await logChange({
    change_type: "pipeline_stage",
    description: `[${run_id}] PRICING stage: ${pricingReport.summary.active_count} active, ${pricingReport.summary.suppressed_count} suppressed`,
    source: "automation",
    affected_components: ["discountEngine", "PRICING"],
    metadata: {
      run_id,
      stage: "pricing",
      active: pricingReport.summary.active_count,
      suppressed: pricingReport.summary.suppressed_count,
      affected_products: pricingReport.affected_products,
    },
  });

  // ── Stage 5: CAMPAIGN (event-driven activation) ───────────────────────────
  const campaignActivated: string[] = [];
  const campaignErrors: string[] = [];
  for (const e of events) {
    if (e.event_type !== "campaign_trigger" && e.event_type !== "high_stock") continue;
    const { activated_ids, error } = await handleEventActivation(e);
    if (error) campaignErrors.push(error);
    else campaignActivated.push(...activated_ids);
  }
  await logChange({
    change_type: "pipeline_stage",
    description: `[${run_id}] CAMPAIGN stage: ${campaignActivated.length} activated`,
    source: "automation",
    affected_components: ["campaignScheduler", "CAMPAIGN"],
    metadata: {
      run_id,
      stage: "campaign",
      activated_ids: campaignActivated,
      errors: campaignErrors,
    },
  });

  // ── Stage 6: STORE UPDATE (write final prices + mark events processed) ───
  let priceUpdates = 0;
  let eventsMarked = 0;
  const storeErrors: string[] = [];

  if (opts.apply_price_updates) {
    for (const d of pricingReport.active_discounts) {
      const { error } = await (supabase as any)
        .from("products")
        .update({
          sale_price: d.final_price,
          updated_at: new Date().toISOString(),
        })
        .eq("id", d.product_id);
      if (error) storeErrors.push(`price ${d.product_id}: ${error.message}`);
      else priceUpdates += 1;
    }
  }

  if (opts.mark_events_processed !== false) {
    for (const ev of events) {
      if (!ev.id) continue;
      const ok = await markEventProcessed(ev.id, "ecommerceOrchestrator");
      if (ok) eventsMarked += 1;
    }
  }

  await logChange({
    change_type: "pipeline_stage",
    description: `[${run_id}] STORE stage: ${priceUpdates} price updates, ${eventsMarked} events marked processed`,
    source: "automation",
    affected_components: ["products", "ecommerce_events", "STORE_UPDATE"],
    metadata: {
      run_id,
      stage: "store_update",
      price_updates: priceUpdates,
      events_marked: eventsMarked,
      apply_price_updates: opts.apply_price_updates === true,
      errors: storeErrors,
    },
  });

  errors.push(...campaignErrors, ...storeErrors);
  const finished_at = new Date().toISOString();

  // ── Final summary log ─────────────────────────────────────────────────────
  await logChange({
    change_type: "pipeline_run",
    description: `[${run_id}] Pipeline complete (${errors.length} errors) — products:${inputs.length} events:${events.length} rules:${ruleResult.applied.length} prices:${pricingReport.summary.active_count} campaigns:${campaignActivated.length}`,
    source: "automation",
    affected_components: ["ecommerceOrchestrator"],
    metadata: { run_id, started_at, finished_at, error_count: errors.length },
  });

  return {
    run_id,
    started_at,
    finished_at,
    stages: {
      product: { count: inputs.length },
      event: { generated: events.length, emitted, failed, events },
      rule: {
        evaluated: ruleResult.evaluated,
        matched: ruleResult.matched,
        applied: ruleResult.applied.length,
        overridden: ruleResult.overridden.length,
        resolved: ruleResult,
      },
      pricing: {
        active: pricingReport.summary.active_count,
        suppressed: pricingReport.summary.suppressed_count,
        report: pricingReport,
      },
      campaign: { activated_ids: campaignActivated, errors: campaignErrors },
      store: { price_updates: priceUpdates, events_marked: eventsMarked, errors: storeErrors },
    },
    errors,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Dry-run helper — runs every stage but never writes prices.
// Useful for admin previews (/admin/control).
// ─────────────────────────────────────────────────────────────────────────────
export function runPipelineDryRun(inputs: ProductEvaluationInput[]) {
  return runPipeline(inputs, {
    apply_price_updates: false,
    mark_events_processed: false,
  });
}
