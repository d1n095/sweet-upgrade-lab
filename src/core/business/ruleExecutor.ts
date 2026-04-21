/**
 * RULE EXECUTOR
 *
 * Deterministic side-effect layer for the rule engine.
 *
 *   evaluateRules() → RuleEvaluation[]      (pure, no I/O)
 *   resolveRuleConflicts() → ResolvedRuleSet (pure, no I/O)
 *   executeActions() → ExecutionReport      (writes to DB, audit-logged)
 *
 * Each action type maps to ONE deterministic handler. No fallbacks, no AI,
 * no implicit retries. Failures are recorded and returned — never swallowed.
 *
 * Conflict resolution MUST happen before execution. This module assumes the
 * input has already been resolved (i.e. one winner per product+action key).
 */
import { supabase } from "@/integrations/supabase/client";
import { logChange } from "@/utils/changeLogger";
import type {
  RuleEvaluation,
  RuleAction,
  DiscountAction,
  PriceChangeAction,
  CampaignAction,
  MarkProductStatusAction,
  FlagAction,
} from "./ruleEngine";

export type ExecutionStatus = "applied" | "skipped" | "failed";

export interface ExecutionResult {
  rule_id: string;
  product_id: string | null;
  action_type: RuleAction["type"];
  status: ExecutionStatus;
  detail: string;
  executed_at: string;
}

export interface ExecutionReport {
  total: number;
  applied: number;
  skipped: number;
  failed: number;
  results: ExecutionResult[];
}

export interface ExecutorOptions {
  /** When false, runs in preview mode — no DB writes, every action becomes "skipped". */
  apply?: boolean;
  /** Source label for change_log entries. Default: "rule_executor". */
  source?: string;
}

const now = () => new Date().toISOString();

// ─────────────────────────────────────────────────────────────────────────────
// Action handlers — each is a small, single-purpose, deterministic function.
// ─────────────────────────────────────────────────────────────────────────────
async function execApplyDiscount(
  ev: RuleEvaluation,
  action: DiscountAction,
  apply: boolean,
): Promise<ExecutionResult> {
  const base = {
    rule_id: ev.rule_id,
    product_id: ev.product_id ?? null,
    action_type: action.type as RuleAction["type"],
    executed_at: now(),
  };
  if (!ev.product_id) {
    return { ...base, status: "skipped", detail: "no product_id" };
  }
  if (!apply) {
    return {
      ...base,
      status: "skipped",
      detail: `preview: ${(action.discount_pct * 100).toFixed(0)}% / ${action.duration_days}d`,
    };
  }
  // Read base price, then write sale_price = price * (1 - pct).
  const { data: prod, error: readErr } = await (supabase as any)
    .from("products")
    .select("price")
    .eq("id", ev.product_id)
    .maybeSingle();
  if (readErr || !prod) {
    return { ...base, status: "failed", detail: readErr?.message ?? "product not found" };
  }
  const newSale = Math.round(prod.price * (1 - action.discount_pct) * 100) / 100;
  const { error } = await (supabase as any)
    .from("products")
    .update({ sale_price: newSale, updated_at: now() })
    .eq("id", ev.product_id);
  if (error) return { ...base, status: "failed", detail: error.message };
  return {
    ...base,
    status: "applied",
    detail: `sale_price=${newSale} (${(action.discount_pct * 100).toFixed(0)}% off)`,
  };
}

async function execChangePrice(
  ev: RuleEvaluation,
  action: PriceChangeAction,
  apply: boolean,
): Promise<ExecutionResult> {
  const base = {
    rule_id: ev.rule_id,
    product_id: ev.product_id ?? null,
    action_type: action.type as RuleAction["type"],
    executed_at: now(),
  };
  if (!ev.product_id) {
    return { ...base, status: "skipped", detail: "no product_id" };
  }
  if (!apply) {
    return {
      ...base,
      status: "skipped",
      detail: `preview: price *= ${action.new_price_pct_of_current}`,
    };
  }
  const { data: prod, error: readErr } = await (supabase as any)
    .from("products")
    .select("price")
    .eq("id", ev.product_id)
    .maybeSingle();
  if (readErr || !prod) {
    return { ...base, status: "failed", detail: readErr?.message ?? "product not found" };
  }
  const newPrice = Math.round(prod.price * action.new_price_pct_of_current * 100) / 100;
  const { error } = await (supabase as any)
    .from("products")
    .update({ price: newPrice, updated_at: now() })
    .eq("id", ev.product_id);
  if (error) return { ...base, status: "failed", detail: error.message };
  return { ...base, status: "applied", detail: `price=${newPrice}` };
}

async function execTriggerCampaign(
  ev: RuleEvaluation,
  action: CampaignAction,
  apply: boolean,
  source: string,
): Promise<ExecutionResult> {
  const base = {
    rule_id: ev.rule_id,
    product_id: ev.product_id ?? null,
    action_type: action.type as RuleAction["type"],
    executed_at: now(),
  };
  if (!apply) {
    return {
      ...base,
      status: "skipped",
      detail: `preview: campaign=${action.campaign_type} ${action.duration_days}d`,
    };
  }
  // Emit a campaign_trigger event. campaignScheduler picks it up downstream.
  const { data, error } = await (supabase as any).rpc("emit_ecommerce_event", {
    p_event_type: "campaign_trigger",
    p_product_id: ev.product_id ?? null,
    p_severity: "info",
    p_source: source,
    p_payload: {
      campaign_type: action.campaign_type,
      duration_days: action.duration_days,
      trigger_reason: action.reason,
      from_rule: ev.rule_id,
    },
  });
  if (error) return { ...base, status: "failed", detail: error.message };
  return {
    ...base,
    status: "applied",
    detail: `event=${data} campaign=${action.campaign_type}`,
  };
}

async function execMarkProductStatus(
  ev: RuleEvaluation,
  action: MarkProductStatusAction,
  apply: boolean,
): Promise<ExecutionResult> {
  const base = {
    rule_id: ev.rule_id,
    product_id: ev.product_id ?? null,
    action_type: action.type as RuleAction["type"],
    executed_at: now(),
  };
  if (!ev.product_id) {
    return { ...base, status: "skipped", detail: "no product_id" };
  }
  if (!apply) {
    return { ...base, status: "skipped", detail: `preview: status=${action.status}` };
  }
  const { error } = await (supabase as any)
    .from("products")
    .update({ status: action.status, updated_at: now() })
    .eq("id", ev.product_id);
  if (error) return { ...base, status: "failed", detail: error.message };
  return { ...base, status: "applied", detail: `status=${action.status}` };
}

function execFlag(ev: RuleEvaluation, action: FlagAction): ExecutionResult {
  return {
    rule_id: ev.rule_id,
    product_id: ev.product_id ?? null,
    action_type: action.type as RuleAction["type"],
    status: "applied",
    detail: `flag:${action.severity}:${action.reason}`,
    executed_at: now(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Public executor — iterates resolved evaluations and dispatches per type.
// ─────────────────────────────────────────────────────────────────────────────
export async function executeActions(
  applied: RuleEvaluation[],
  opts: ExecutorOptions = {},
): Promise<ExecutionReport> {
  const apply = opts.apply !== false; // default: apply
  const source = opts.source ?? "rule_executor";
  const results: ExecutionResult[] = [];

  for (const ev of applied) {
    let res: ExecutionResult;
    switch (ev.action.type) {
      case "apply_discount":
        res = await execApplyDiscount(ev, ev.action, apply);
        break;
      case "change_price":
        res = await execChangePrice(ev, ev.action, apply);
        break;
      case "trigger_campaign":
        res = await execTriggerCampaign(ev, ev.action, apply, source);
        break;
      case "mark_product_status":
        res = await execMarkProductStatus(ev, ev.action, apply);
        break;
      case "flag_for_review":
        res = execFlag(ev, ev.action);
        break;
      case "no_op":
        res = {
          rule_id: ev.rule_id,
          product_id: ev.product_id ?? null,
          action_type: "no_op",
          status: "skipped",
          detail: ev.action.reason,
          executed_at: now(),
        };
        break;
    }
    results.push(res);
  }

  const report: ExecutionReport = {
    total: results.length,
    applied: results.filter((r) => r.status === "applied").length,
    skipped: results.filter((r) => r.status === "skipped").length,
    failed: results.filter((r) => r.status === "failed").length,
    results,
  };

  await logChange({
    change_type: "rule_execution",
    description: `Rule executor: ${report.applied} applied, ${report.skipped} skipped, ${report.failed} failed (apply=${apply})`,
    source: "automation",
    affected_components: ["ruleExecutor"],
    metadata: {
      apply_mode: apply,
      source,
      total: report.total,
      applied: report.applied,
      skipped: report.skipped,
      failed: report.failed,
      results: report.results,
    },
  });

  return report;
}
