/**
 * AFFILIATE PAYOUT CALCULATOR
 *
 * Deterministic rollup of pending commissions → payout amount.
 * NO AI. Fixed-percentage commission, fixed minimum payout threshold.
 *
 *   pending_orders (status='pending') → sum(commission_amount)
 *   if sum >= affiliate.min_payout_amount → eligible
 *   on payout: mark orders as 'paid', insert affiliate_payouts row
 *
 * Pairs with:
 *   - affiliateTracking.ts → click + conversion tracking
 *   - AdminPayoutManager.tsx → admin UI for approving payouts
 */
import { supabase } from "@/integrations/supabase/client";
import { logChange } from "@/utils/changeLogger";

const DEFAULT_MIN_PAYOUT = 500; // SEK

export interface PayoutSummary {
  affiliate_id: string;
  pending_amount: number;
  pending_order_count: number;
  min_payout_amount: number;
  eligible: boolean;
  shortfall: number; // 0 if eligible
}

export interface PayoutRequestResult {
  payout_id: string | null;
  amount: number;
  orders_marked: number;
  error: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Calculate pending payout summary (read-only)
// ─────────────────────────────────────────────────────────────────────────────
export async function getPayoutSummary(
  affiliateId: string,
): Promise<PayoutSummary | null> {
  const [{ data: aff }, { data: orders }] = await Promise.all([
    (supabase as any)
      .from("affiliates")
      .select("id, min_payout_amount")
      .eq("id", affiliateId)
      .maybeSingle(),
    (supabase as any)
      .from("affiliate_orders")
      .select("commission_amount")
      .eq("affiliate_id", affiliateId)
      .eq("status", "pending"),
  ]);

  if (!aff) return null;

  const pending_amount = (orders ?? []).reduce(
    (sum: number, o: any) => sum + Number(o.commission_amount || 0),
    0,
  );
  const min = Number(aff.min_payout_amount ?? DEFAULT_MIN_PAYOUT);
  const eligible = pending_amount >= min;

  return {
    affiliate_id: affiliateId,
    pending_amount: Math.round(pending_amount * 100) / 100,
    pending_order_count: (orders ?? []).length,
    min_payout_amount: min,
    eligible,
    shortfall: eligible ? 0 : Math.round((min - pending_amount) * 100) / 100,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Process payout — mark pending orders as paid, create payout record
// ─────────────────────────────────────────────────────────────────────────────
export async function processPayout(
  affiliateId: string,
  payoutMethod: "swish" | "bank" | "manual" = "manual",
  notes: string = "",
): Promise<PayoutRequestResult> {
  const summary = await getPayoutSummary(affiliateId);
  if (!summary) {
    return { payout_id: null, amount: 0, orders_marked: 0, error: "affiliate not found" };
  }
  if (!summary.eligible) {
    return {
      payout_id: null,
      amount: 0,
      orders_marked: 0,
      error: `below minimum: ${summary.pending_amount} < ${summary.min_payout_amount}`,
    };
  }

  // 1. Insert payout row
  const { data: payout, error: payoutErr } = await (supabase as any)
    .from("affiliate_payouts")
    .insert({
      affiliate_id: affiliateId,
      amount: summary.pending_amount,
      payout_method: payoutMethod,
      status: "completed",
      completed_at: new Date().toISOString(),
      notes,
    })
    .select()
    .single();

  if (payoutErr) {
    return { payout_id: null, amount: 0, orders_marked: 0, error: payoutErr.message };
  }

  // 2. Mark pending orders as paid
  const { count, error: updErr } = await (supabase as any)
    .from("affiliate_orders")
    .update({ status: "paid", paid_at: new Date().toISOString() }, { count: "exact" })
    .eq("affiliate_id", affiliateId)
    .eq("status", "pending");

  if (updErr) {
    return { payout_id: payout.id, amount: summary.pending_amount, orders_marked: 0, error: updErr.message };
  }

  // 3. Roll affiliate totals
  await (supabase as any).rpc("increment_affiliate_paid", {
    p_affiliate_id: affiliateId,
    p_amount: summary.pending_amount,
  }).catch(() => {
    // Fallback: direct update if RPC doesn't exist
    return (supabase as any)
      .from("affiliates")
      .update({
        pending_earnings: 0,
        paid_earnings: (supabase as any).rpc("increment", { x: summary.pending_amount }),
      })
      .eq("id", affiliateId);
  });

  // 4. Audit log
  await logChange({
    change_type: "affiliate_payout",
    description: `Payout ${summary.pending_amount} SEK to affiliate ${affiliateId}`,
    source: "automation",
    affected_components: ["affiliatePayouts", "affiliate_payouts", "affiliate_orders"],
    metadata: {
      affiliate_id: affiliateId,
      amount: summary.pending_amount,
      orders_marked: count ?? 0,
      method: payoutMethod,
    },
  });

  return {
    payout_id: payout.id,
    amount: summary.pending_amount,
    orders_marked: count ?? 0,
    error: null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Batch eligibility check — returns all affiliates ready for payout
// ─────────────────────────────────────────────────────────────────────────────
export async function listEligibleAffiliates(): Promise<PayoutSummary[]> {
  const { data: affiliates } = await (supabase as any)
    .from("affiliates")
    .select("id")
    .eq("is_active", true);

  if (!affiliates) return [];

  const summaries = await Promise.all(
    affiliates.map((a: any) => getPayoutSummary(a.id)),
  );
  return summaries.filter((s): s is PayoutSummary => s !== null && s.eligible);
}
