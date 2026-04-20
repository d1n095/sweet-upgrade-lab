/**
 * AFFILIATE TRACKING SYSTEM
 *
 * Deterministic referral link tracking + commission calculation.
 * NO AI. NO heuristics. Pure math.
 *
 * Pipeline:
 *   1. buildReferralLink(code, path?)         → shareable URL
 *   2. trackClick(code, ctx)                  → server records click → click_id
 *   3. markConverted(sessionId, affId, order) → links click → order
 *   4. calculateCommission(affId, total)      → { commission, percent, discount }
 *   5. getPerformance(affId, from, to)        → clicks/conversions/revenue stats
 *
 * Storage: public.affiliate_clicks + existing public.affiliates / affiliate_orders.
 * RPCs: track_affiliate_click(), mark_affiliate_click_converted(),
 *       calculate_affiliate_commission(), get_affiliate_performance().
 */
import { supabase } from "@/integrations/supabase/client";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
const SESSION_KEY = "affiliate_session_id";
const CLICK_CODE_KEY = "affiliate_ref_code";
const CLICK_AFF_KEY = "affiliate_ref_id";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
export interface TrackClickContext {
  landing_path?: string;
  referrer?: string;
  user_agent?: string;
  session_id?: string;
}

export interface CommissionResult {
  commission: number;
  customer_discount: number;
  percent: number;
  order_total: number;
  valid: boolean;
}

export interface AffiliatePerformance {
  affiliate_id: string;
  period_from: string;
  period_to: string;
  clicks: number;
  conversions: number;
  conversion_rate: number;
  orders: number;
  revenue: number;
  commission_total: number;
  commission_pending: number;
  commission_paid: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Referral link builder
// ─────────────────────────────────────────────────────────────────────────────
export function buildReferralLink(
  code: string,
  path: string = "/",
  origin: string = typeof window !== "undefined" ? window.location.origin : ""
): string {
  const cleanCode = code.trim().toUpperCase();
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(cleanPath, origin || "https://example.com");
  url.searchParams.set("ref", cleanCode);
  return url.toString();
}

// ─────────────────────────────────────────────────────────────────────────────
// Session id (browser-stable, anonymous)
// ─────────────────────────────────────────────────────────────────────────────
function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return "";
  let sid = localStorage.getItem(SESSION_KEY);
  if (!sid) {
    sid = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(SESSION_KEY, sid);
  }
  return sid;
}

// ─────────────────────────────────────────────────────────────────────────────
// Track click — call when a visitor lands with ?ref=CODE
// ─────────────────────────────────────────────────────────────────────────────
export async function trackClick(
  code: string,
  ctx: TrackClickContext = {}
): Promise<{ click_id: string | null; error: string | null }> {
  if (!code) return { click_id: null, error: "missing code" };

  const session_id = ctx.session_id ?? getOrCreateSessionId();
  const landing_path =
    ctx.landing_path ??
    (typeof window !== "undefined" ? window.location.pathname + window.location.search : "");
  const referrer =
    ctx.referrer ?? (typeof document !== "undefined" ? document.referrer : "");
  const user_agent =
    ctx.user_agent ?? (typeof navigator !== "undefined" ? navigator.userAgent : "");

  const { data, error } = await (supabase as any).rpc("track_affiliate_click", {
    p_code: code,
    p_landing_path: landing_path,
    p_referrer: referrer,
    p_ip_hash: null, // server-side only; browser cannot see real IP
    p_user_agent: user_agent,
    p_session_id: session_id,
  });

  if (error) {
    console.error("[affiliateTracking] trackClick failed", error);
    return { click_id: null, error: error.message };
  }

  // Persist code so checkout can attach it to the order
  if (data && typeof window !== "undefined") {
    localStorage.setItem(CLICK_CODE_KEY, code.toUpperCase());
  }

  return { click_id: (data as string) ?? null, error: null };
}

/**
 * Convenience: read `?ref=` from current URL and track if present.
 * Returns the click id (or null if no ref / invalid).
 */
export async function trackClickFromUrl(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const code = params.get("ref");
  if (!code) return null;
  const { click_id } = await trackClick(code);
  return click_id;
}

// ─────────────────────────────────────────────────────────────────────────────
// Mark conversion — call from checkout success handler
// ─────────────────────────────────────────────────────────────────────────────
export async function markConverted(
  affiliateId: string,
  orderId: string,
  sessionId?: string
): Promise<{ updated: number; error: string | null }> {
  const sid = sessionId ?? (typeof window !== "undefined" ? localStorage.getItem(SESSION_KEY) ?? "" : "");
  if (!sid) return { updated: 0, error: "no session id" };

  const { data, error } = await (supabase as any).rpc("mark_affiliate_click_converted", {
    p_session_id: sid,
    p_affiliate_id: affiliateId,
    p_order_id: orderId,
  });

  if (error) {
    console.error("[affiliateTracking] markConverted failed", error);
    return { updated: 0, error: error.message };
  }
  return { updated: (data as number) ?? 0, error: null };
}

// ─────────────────────────────────────────────────────────────────────────────
// Commission calculator — pure deterministic math
// Uses server-side stored commission_percent for the affiliate.
// ─────────────────────────────────────────────────────────────────────────────
export async function calculateCommission(
  affiliateId: string,
  orderTotal: number
): Promise<CommissionResult> {
  const { data, error } = await (supabase as any).rpc("calculate_affiliate_commission", {
    p_affiliate_id: affiliateId,
    p_order_total: orderTotal,
  });

  if (error || !data) {
    console.error("[affiliateTracking] calculateCommission failed", error);
    return { commission: 0, customer_discount: 0, percent: 0, order_total: orderTotal, valid: false };
  }
  return data as CommissionResult;
}

/**
 * Local pure variant — no DB call. Use when you already know the percent.
 * Useful for cart preview before order creation.
 */
export function calculateCommissionLocal(
  orderTotal: number,
  commissionPercent: number,
  customerDiscount: number = 10
): CommissionResult {
  if (orderTotal < 0 || commissionPercent < 0) {
    return { commission: 0, customer_discount: 0, percent: 0, order_total: orderTotal, valid: false };
  }
  const commission = Math.round(orderTotal * commissionPercent) / 100;
  return {
    commission,
    customer_discount: customerDiscount,
    percent: commissionPercent,
    order_total: orderTotal,
    valid: true,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Performance stats
// ─────────────────────────────────────────────────────────────────────────────
export async function getPerformance(
  affiliateId: string,
  from: Date = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
  to: Date = new Date()
): Promise<AffiliatePerformance | null> {
  const { data, error } = await (supabase as any).rpc("get_affiliate_performance", {
    p_affiliate_id: affiliateId,
    p_from: from.toISOString(),
    p_to: to.toISOString(),
  });

  if (error) {
    console.error("[affiliateTracking] getPerformance failed", error);
    return null;
  }
  return (data as AffiliatePerformance) ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Storage helpers (for cart/checkout integration)
// ─────────────────────────────────────────────────────────────────────────────
export function getStoredReferralCode(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(CLICK_CODE_KEY);
}

export function clearStoredReferral(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(CLICK_CODE_KEY);
  localStorage.removeItem(CLICK_AFF_KEY);
}

export function setStoredAffiliateId(affiliateId: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(CLICK_AFF_KEY, affiliateId);
}

export function getStoredAffiliateId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(CLICK_AFF_KEY);
}
