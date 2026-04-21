/**
 * CAMPAIGN STATE MANAGER
 *
 * Thin, deterministic facade over the campaign tables. Centralises every
 * lifecycle transition so callers never write `status` directly.
 *
 *   draft → scheduled → active → (paused?) → ended | cancelled
 *
 * Rules enforced here (in addition to DB constraints):
 *   - end_at MUST be strictly after start_at
 *   - transitions follow the diagram above; illegal moves return an error
 *   - every transition writes a row to `campaign_activations` (via RPCs)
 *
 * Pairs with:
 *   - campaignScheduler.ts  → time-based + event-based activation
 *   - priorityResolver.ts   → campaigns override pricing at priority 2
 */
import { supabase } from "@/integrations/supabase/client";
import { logChange } from "@/utils/changeLogger";
import {
  activateCampaign,
  endCampaign,
  type Campaign,
  type CampaignStatus,
} from "./campaignScheduler";

// ─────────────────────────────────────────────────────────────────────────────
// Window validation
// ─────────────────────────────────────────────────────────────────────────────
export interface WindowValidation {
  ok: boolean;
  reason?: string;
  start_ms?: number;
  end_ms?: number;
}

export function validateCampaignWindow(
  start_at: string,
  end_at: string,
  now: Date = new Date(),
): WindowValidation {
  const s = Date.parse(start_at);
  const e = Date.parse(end_at);
  if (Number.isNaN(s)) return { ok: false, reason: "invalid start_at" };
  if (Number.isNaN(e)) return { ok: false, reason: "invalid end_at" };
  if (e <= s) return { ok: false, reason: "end_at must be after start_at" };
  if (e <= now.getTime()) return { ok: false, reason: "end_at is in the past" };
  return { ok: true, start_ms: s, end_ms: e };
}

// ─────────────────────────────────────────────────────────────────────────────
// State machine — allowed transitions
// ─────────────────────────────────────────────────────────────────────────────
const ALLOWED: Record<CampaignStatus, CampaignStatus[]> = {
  draft:      ["scheduled", "active", "cancelled"],
  scheduled:  ["active", "paused", "cancelled", "ended"],
  active:     ["paused", "ended", "cancelled"],
  paused:     ["active", "ended", "cancelled"],
  ended:      [],
  cancelled:  [],
};

export function canTransition(from: CampaignStatus, to: CampaignStatus): boolean {
  return ALLOWED[from]?.includes(to) ?? false;
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal: read current campaign row
// ─────────────────────────────────────────────────────────────────────────────
async function getCampaign(id: string): Promise<Campaign | null> {
  const { data, error } = await (supabase as any)
    .from("campaigns")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("[campaignStateManager] read failed", error);
    return null;
  }
  return (data as Campaign) ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Direct status writers — only used for transitions the existing RPCs don't
// already cover (pause / resume / cancel). Activation + end go through the
// SECURITY DEFINER RPCs to keep the activation log consistent.
// ─────────────────────────────────────────────────────────────────────────────
async function setStatus(
  id: string,
  newStatus: CampaignStatus,
  reason: string,
  action: "paused" | "resumed" | "deactivated",
): Promise<{ campaign: Campaign | null; error: string | null }> {
  const { data, error } = await (supabase as any)
    .from("campaigns")
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) return { campaign: null, error: error.message };

  // Mirror activation log (RPCs do this automatically; we do it here for parity).
  await (supabase as any).from("campaign_activations").insert({
    campaign_id: id,
    action,
    reason,
  });

  return { campaign: data as Campaign, error: null };
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────
export interface TransitionResult {
  campaign: Campaign | null;
  error: string | null;
}

export async function pauseCampaign(
  id: string,
  reason: string = "manual",
): Promise<TransitionResult> {
  const c = await getCampaign(id);
  if (!c) return { campaign: null, error: "campaign not found" };
  if (!canTransition(c.status, "paused")) {
    return { campaign: c, error: `cannot pause from ${c.status}` };
  }
  const res = await setStatus(id, "paused", reason, "paused");
  if (!res.error) {
    await logChange({
      change_type: "campaign_state",
      description: `Campaign ${id} paused (${reason})`,
      source: "automation",
      affected_components: ["campaignStateManager", "campaigns"],
      metadata: { campaign_id: id, from: c.status, to: "paused", reason },
    });
  }
  return res;
}

export async function resumeCampaign(
  id: string,
  reason: string = "manual",
): Promise<TransitionResult> {
  const c = await getCampaign(id);
  if (!c) return { campaign: null, error: "campaign not found" };
  if (!canTransition(c.status, "active")) {
    return { campaign: c, error: `cannot resume from ${c.status}` };
  }
  // Re-validate window before resuming (campaign may have expired).
  const w = validateCampaignWindow(c.start_at, c.end_at);
  if (!w.ok) return { campaign: c, error: `cannot resume: ${w.reason}` };
  const res = await setStatus(id, "active", reason, "resumed");
  if (!res.error) {
    await logChange({
      change_type: "campaign_state",
      description: `Campaign ${id} resumed (${reason})`,
      source: "automation",
      affected_components: ["campaignStateManager", "campaigns"],
      metadata: { campaign_id: id, from: c.status, to: "active", reason },
    });
  }
  return res;
}

export async function cancelCampaign(
  id: string,
  reason: string = "manual",
): Promise<TransitionResult> {
  const c = await getCampaign(id);
  if (!c) return { campaign: null, error: "campaign not found" };
  if (!canTransition(c.status, "cancelled")) {
    return { campaign: c, error: `cannot cancel from ${c.status}` };
  }
  const res = await setStatus(id, "cancelled", reason, "deactivated");
  if (!res.error) {
    await logChange({
      change_type: "campaign_state",
      description: `Campaign ${id} cancelled (${reason})`,
      source: "automation",
      affected_components: ["campaignStateManager", "campaigns"],
      metadata: { campaign_id: id, from: c.status, to: "cancelled", reason },
    });
  }
  return res;
}

/**
 * Force-end an active/paused campaign. Goes through the existing
 * `end_campaign` RPC so the activation log entry uses the canonical action.
 */
export async function forceEndCampaign(
  id: string,
  reason: string = "manual",
): Promise<TransitionResult> {
  const c = await getCampaign(id);
  if (!c) return { campaign: null, error: "campaign not found" };
  if (!canTransition(c.status, "ended")) {
    return { campaign: c, error: `cannot end from ${c.status}` };
  }
  const res = await endCampaign(id, reason);
  if (!res.error) {
    await logChange({
      change_type: "campaign_state",
      description: `Campaign ${id} ended (${reason})`,
      source: "automation",
      affected_components: ["campaignStateManager", "campaigns"],
      metadata: { campaign_id: id, from: c.status, to: "ended", reason },
    });
  }
  return res;
}

/**
 * Re-activate a draft / scheduled / paused campaign. Goes through the
 * existing `activate_campaign` RPC.
 */
export async function startCampaign(
  id: string,
  reason: string = "manual",
): Promise<TransitionResult> {
  const c = await getCampaign(id);
  if (!c) return { campaign: null, error: "campaign not found" };
  if (!canTransition(c.status, "active")) {
    return { campaign: c, error: `cannot start from ${c.status}` };
  }
  const w = validateCampaignWindow(c.start_at, c.end_at);
  if (!w.ok) return { campaign: c, error: `cannot start: ${w.reason}` };
  const res = await activateCampaign(id, reason);
  if (!res.error) {
    await logChange({
      change_type: "campaign_state",
      description: `Campaign ${id} activated (${reason})`,
      source: "automation",
      affected_components: ["campaignStateManager", "campaigns"],
      metadata: { campaign_id: id, from: c.status, to: "active", reason },
    });
  }
  return res;
}

// ─────────────────────────────────────────────────────────────────────────────
// Read helpers
// ─────────────────────────────────────────────────────────────────────────────
export interface CampaignState {
  campaign: Campaign;
  is_in_window: boolean;
  is_active: boolean;
  remaining_seconds: number | null; // null when ended/cancelled
  next_legal_transitions: CampaignStatus[];
}

export async function getCampaignState(
  id: string,
  now: Date = new Date(),
): Promise<{ state: CampaignState | null; error: string | null }> {
  const c = await getCampaign(id);
  if (!c) return { state: null, error: "campaign not found" };
  const nowMs = now.getTime();
  const startMs = Date.parse(c.start_at);
  const endMs = Date.parse(c.end_at);
  const inWindow = nowMs >= startMs && nowMs < endMs;
  const isActive = c.status === "active" && inWindow;
  const remaining =
    c.status === "ended" || c.status === "cancelled"
      ? null
      : Math.max(0, Math.floor((endMs - nowMs) / 1000));
  return {
    state: {
      campaign: c,
      is_in_window: inWindow,
      is_active: isActive,
      remaining_seconds: remaining,
      next_legal_transitions: ALLOWED[c.status] ?? [],
    },
    error: null,
  };
}
