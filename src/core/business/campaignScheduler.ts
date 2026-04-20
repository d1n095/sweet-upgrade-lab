/**
 * CAMPAIGN MANAGEMENT SYSTEM
 *
 * Deterministic scheduler + activator for ecommerce campaigns.
 * NO AI. NO heuristics. Activation = pure date/event check.
 *
 * Pipeline:
 *   1. createCampaign(input)              → row in `campaigns` (draft|scheduled)
 *   2. runScheduler()                     → activate due / expire past-end
 *   3. handleEventActivation(event)       → match `trigger_event_type` → activate
 *   4. getActiveCampaigns(at?)            → current overrides for pricing layer
 *   5. getCampaignImpact(id)              → activation log + window
 *
 * Storage: public.campaigns + public.campaign_activations (RLS-protected).
 * Server helpers: get_active_campaigns(), activate_campaign(), end_campaign(),
 *                 run_campaign_scheduler() (all SECURITY DEFINER).
 */
import { supabase } from "@/integrations/supabase/client";
import type {
  EcommerceEvent,
  EcommerceEventType,
} from "./ecommerceEvents";

// ─────────────────────────────────────────────────────────────────────────────
// Types — must mirror Postgres enums
// ─────────────────────────────────────────────────────────────────────────────
export type CampaignType =
  | "seasonal"
  | "clearance"
  | "product_launch"
  | "visibility_boost"
  | "conversion_opt";

export type CampaignStatus =
  | "draft"
  | "scheduled"
  | "active"
  | "paused"
  | "ended"
  | "cancelled";

export type CampaignActivationAction =
  | "activated"
  | "deactivated"
  | "paused"
  | "resumed"
  | "ended"
  | "expired";

/** Priority tiers — must match RULE_PRIORITY in ruleEngine.ts. */
export const CAMPAIGN_PRIORITY = {
  SAFETY: 1,
  ACTIVE_CAMPAIGN: 2,
  EVENT_DRIVEN: 3,
  DEFAULT: 4,
} as const;

export interface Campaign {
  id: string;
  name: string;
  description: string | null;
  campaign_type: CampaignType;
  status: CampaignStatus;
  priority: number;
  start_at: string;
  end_at: string;
  discount_pct: number;
  override_pricing: boolean;
  trigger_event_type: EcommerceEventType | null;
  trigger_event_id: string | null;
  target_product_ids: string[];
  target_variant_ids: string[];
  target_category_ids: string[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CampaignActivation {
  id: string;
  campaign_id: string;
  action: CampaignActivationAction;
  reason: string;
  triggered_by_event_id: string | null;
  triggered_by_user: string | null;
  created_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Create / update
// ─────────────────────────────────────────────────────────────────────────────
export interface CreateCampaignInput {
  name: string;
  description?: string;
  campaign_type: CampaignType;
  start_at: string;          // ISO timestamp
  end_at: string;            // ISO timestamp (must be > start_at)
  discount_pct?: number;     // 0..1
  override_pricing?: boolean;
  priority?: number;         // defaults to ACTIVE_CAMPAIGN (2)
  trigger_event_type?: EcommerceEventType;
  target_product_ids?: string[];
  target_variant_ids?: string[];
  target_category_ids?: string[];
  /** If true, insert with status='scheduled' so the scheduler will auto-activate. */
  schedule_now?: boolean;
}

export async function createCampaign(
  input: CreateCampaignInput
): Promise<{ campaign: Campaign | null; error: string | null }> {
  if (new Date(input.end_at) <= new Date(input.start_at)) {
    return { campaign: null, error: "end_at must be after start_at" };
  }

  const status: CampaignStatus = input.schedule_now ? "scheduled" : "draft";

  const { data, error } = await (supabase as any)
    .from("campaigns")
    .insert({
      name: input.name,
      description: input.description ?? null,
      campaign_type: input.campaign_type,
      status,
      priority: input.priority ?? CAMPAIGN_PRIORITY.ACTIVE_CAMPAIGN,
      start_at: input.start_at,
      end_at: input.end_at,
      discount_pct: input.discount_pct ?? 0,
      override_pricing: input.override_pricing ?? true,
      trigger_event_type: input.trigger_event_type ?? null,
      target_product_ids: input.target_product_ids ?? [],
      target_variant_ids: input.target_variant_ids ?? [],
      target_category_ids: input.target_category_ids ?? [],
    })
    .select()
    .single();

  if (error) {
    console.error("[campaignScheduler] createCampaign failed", error);
    return { campaign: null, error: error.message };
  }
  return { campaign: data as Campaign, error: null };
}

// ─────────────────────────────────────────────────────────────────────────────
// Scheduler — calls server-side run_campaign_scheduler()
// Auto-activates due `scheduled` campaigns and expires past-end ones.
// ─────────────────────────────────────────────────────────────────────────────
export async function runScheduler(): Promise<{
  activated: number;
  expired: number;
  ran_at: string;
  error: string | null;
}> {
  const { data, error } = await (supabase as any).rpc("run_campaign_scheduler");
  if (error) {
    console.error("[campaignScheduler] runScheduler failed", error);
    return { activated: 0, expired: 0, ran_at: new Date().toISOString(), error: error.message };
  }
  return {
    activated: (data?.activated as number) ?? 0,
    expired: (data?.expired as number) ?? 0,
    ran_at: (data?.ran_at as string) ?? new Date().toISOString(),
    error: null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Activator — manual or event-driven
// ─────────────────────────────────────────────────────────────────────────────
export async function activateCampaign(
  campaignId: string,
  reason: string = "manual",
  eventId?: string
): Promise<{ campaign: Campaign | null; error: string | null }> {
  const { data, error } = await (supabase as any).rpc("activate_campaign", {
    p_campaign_id: campaignId,
    p_reason: reason,
    p_event_id: eventId ?? null,
  });
  if (error) {
    console.error("[campaignScheduler] activateCampaign failed", error);
    return { campaign: null, error: error.message };
  }
  return { campaign: (data as Campaign) ?? null, error: null };
}

export async function endCampaign(
  campaignId: string,
  reason: string = "manual"
): Promise<{ campaign: Campaign | null; error: string | null }> {
  const { data, error } = await (supabase as any).rpc("end_campaign", {
    p_campaign_id: campaignId,
    p_reason: reason,
  });
  if (error) {
    console.error("[campaignScheduler] endCampaign failed", error);
    return { campaign: null, error: error.message };
  }
  return { campaign: (data as Campaign) ?? null, error: null };
}

/**
 * Event-driven activation.
 * Finds all draft/scheduled campaigns whose `trigger_event_type` matches the
 * incoming event AND whose date window contains "now", then activates them.
 * Pure: same event + same campaign set → same activations.
 */
export async function handleEventActivation(
  event: EcommerceEvent
): Promise<{ activated_ids: string[]; error: string | null }> {
  const nowIso = new Date().toISOString();

  const { data: candidates, error: qErr } = await (supabase as any)
    .from("campaigns")
    .select("id")
    .eq("trigger_event_type", event.event_type)
    .in("status", ["draft", "scheduled"])
    .lte("start_at", nowIso)
    .gt("end_at", nowIso);

  if (qErr) {
    console.error("[campaignScheduler] handleEventActivation query failed", qErr);
    return { activated_ids: [], error: qErr.message };
  }

  const activated: string[] = [];
  for (const c of (candidates ?? []) as { id: string }[]) {
    const { error } = await activateCampaign(
      c.id,
      `event:${event.event_type}`,
      event.id
    );
    if (!error) activated.push(c.id);
  }
  return { activated_ids: activated, error: null };
}

// ─────────────────────────────────────────────────────────────────────────────
// Status / lookup
// ─────────────────────────────────────────────────────────────────────────────
export async function getActiveCampaigns(
  at: Date = new Date()
): Promise<Campaign[]> {
  const { data, error } = await (supabase as any).rpc("get_active_campaigns", {
    p_at: at.toISOString(),
  });
  if (error) {
    console.error("[campaignScheduler] getActiveCampaigns failed", error);
    return [];
  }
  return (data ?? []) as Campaign[];
}

export async function listCampaigns(opts: {
  status?: CampaignStatus;
  campaign_type?: CampaignType;
  limit?: number;
} = {}): Promise<Campaign[]> {
  let q = (supabase as any)
    .from("campaigns")
    .select("*")
    .order("start_at", { ascending: false })
    .limit(opts.limit ?? 200);

  if (opts.status) q = q.eq("status", opts.status);
  if (opts.campaign_type) q = q.eq("campaign_type", opts.campaign_type);

  const { data, error } = await q;
  if (error) {
    console.error("[campaignScheduler] listCampaigns failed", error);
    return [];
  }
  return (data ?? []) as Campaign[];
}

export async function getCampaignImpact(
  campaignId: string
): Promise<{
  campaign: Campaign | null;
  activations: CampaignActivation[];
  active_seconds: number;
}> {
  const [{ data: c, error: cErr }, { data: a, error: aErr }] = await Promise.all([
    (supabase as any).from("campaigns").select("*").eq("id", campaignId).maybeSingle(),
    (supabase as any)
      .from("campaign_activations")
      .select("*")
      .eq("campaign_id", campaignId)
      .order("created_at", { ascending: true }),
  ]);

  if (cErr) console.error("[campaignScheduler] getCampaignImpact campaign", cErr);
  if (aErr) console.error("[campaignScheduler] getCampaignImpact activations", aErr);

  // Deterministic active-seconds calc: pair activations with deactivations.
  const log = (a ?? []) as CampaignActivation[];
  let active_seconds = 0;
  let openStart: number | null = null;
  for (const row of log) {
    const t = new Date(row.created_at).getTime();
    if (row.action === "activated" || row.action === "resumed") {
      if (openStart === null) openStart = t;
    } else if (
      row.action === "ended" ||
      row.action === "expired" ||
      row.action === "deactivated" ||
      row.action === "paused"
    ) {
      if (openStart !== null) {
        active_seconds += Math.floor((t - openStart) / 1000);
        openStart = null;
      }
    }
  }
  // If still active, count up to now
  if (openStart !== null && c && (c as Campaign).status === "active") {
    active_seconds += Math.floor((Date.now() - openStart) / 1000);
  }

  return {
    campaign: (c as Campaign) ?? null,
    activations: log,
    active_seconds,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Pricing-override resolver — pure, deterministic.
// Given active campaigns + a product context, returns the winning campaign
// (highest priority = lowest number, then earliest start_at).
// ─────────────────────────────────────────────────────────────────────────────
export interface PricingContext {
  product_id: string;
  variant_id?: string | null;
  category_ids?: string[];
}

export function resolveCampaignOverride(
  activeCampaigns: Campaign[],
  ctx: PricingContext
): Campaign | null {
  const matches = activeCampaigns.filter((c) => {
    if (!c.override_pricing) return false;
    const noTargets =
      c.target_product_ids.length === 0 &&
      c.target_variant_ids.length === 0 &&
      c.target_category_ids.length === 0;
    if (noTargets) return true; // global campaign
    if (c.target_product_ids.includes(ctx.product_id)) return true;
    if (ctx.variant_id && c.target_variant_ids.includes(ctx.variant_id)) return true;
    if (ctx.category_ids?.some((id) => c.target_category_ids.includes(id))) return true;
    return false;
  });

  if (matches.length === 0) return null;

  matches.sort((a, b) =>
    a.priority !== b.priority
      ? a.priority - b.priority
      : new Date(a.start_at).getTime() - new Date(b.start_at).getTime()
  );
  return matches[0];
}
