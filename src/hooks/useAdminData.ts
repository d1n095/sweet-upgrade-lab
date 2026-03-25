/**
 * Central Admin Data Layer — Single Source of Truth
 * 
 * ALL admin pages MUST use these hooks for data access.
 * This ensures consistent filtering (deleted_at, payment_status, etc.)
 * across the entire admin system.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// ── CONSTANTS: Canonical filter values ──

/** Orders with these statuses are considered "active" (not terminal) */
export const ACTIVE_ORDER_STATUSES = ['pending', 'confirmed', 'processing', 'shipped'] as const;

/** Work items with these statuses are considered "active" */
export const ACTIVE_WORK_ITEM_STATUSES = ['open', 'claimed', 'in_progress', 'escalated'] as const;

/** Only orders with payment_status = 'paid' count toward revenue */
export const PAID_STATUS = 'paid' as const;

// ── HELPERS ──

const todayStart = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
};

const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
};

const monthStart = () => {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
};

// ── CORE QUERIES ──

/**
 * Fetch all non-deleted orders. This is THE canonical order query.
 * Every admin page showing order data must use this.
 */
export const useAdminOrders = (options?: { enabled?: boolean }) =>
  useQuery({
    queryKey: ['admin-orders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('id, order_email, order_number, total_amount, status, payment_status, fulfillment_status, created_at, deleted_at, tracking_number, payment_intent_id, refund_amount, refund_status, currency, shipped_at, packed_at, delivered_at, packed_by, shipped_by')
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    staleTime: 30_000,
    enabled: options?.enabled ?? true,
  });

/**
 * Derived revenue metrics from orders — guaranteed consistent calculation.
 */
export function useAdminRevenue() {
  const { data: orders, ...rest } = useAdminOrders();

  const metrics = orders ? computeRevenueMetrics(orders) : null;

  return { ...rest, data: orders, metrics };
}

export function computeRevenueMetrics(orders: any[]) {
  const paidOrders = orders.filter(o => o.payment_status === PAID_STATUS);
  const grossRevenue = paidOrders.reduce((s, o) => s + (o.total_amount || 0), 0);
  const totalRefunds = paidOrders.reduce((s, o) => s + (o.refund_amount || 0), 0);
  const netRevenue = grossRevenue - totalRefunds;
  const aov = paidOrders.length > 0 ? grossRevenue / paidOrders.length : 0;

  const today = todayStart();
  const todayPaid = paidOrders.filter(o => o.created_at >= today);
  const revenueToday = todayPaid.reduce((s, o) => s + (o.total_amount || 0), 0);

  const month = monthStart();
  const monthPaid = paidOrders.filter(o => o.created_at >= month);
  const revenueThisMonth = monthPaid.reduce((s, o) => s + (o.total_amount || 0), 0);

  return {
    grossRevenue,
    totalRefunds,
    netRevenue,
    aov,
    revenueToday,
    revenueThisMonth,
    totalOrders: orders.length,
    paidCount: paidOrders.length,
    pendingCount: orders.filter(o => o.status === 'pending').length,
    failedCount: orders.filter(o => o.payment_status === 'failed').length,
    todayOrderCount: orders.filter(o => o.created_at >= today).length,
    ordersToPackCount: paidOrders.filter(o => ['pending', 'unfulfilled'].includes(o.fulfillment_status)).length,
  };
}

/**
 * Active work items — canonical query for Workbench / overview.
 */
export const useAdminWorkItems = (options?: { enabled?: boolean }) =>
  useQuery({
    queryKey: ['admin-work-items'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('work_items' as any)
        .select('id, title, description, status, priority, item_type, source_type, source_id, related_order_id, assigned_to, claimed_by, claimed_at, created_at, due_at, ai_detected, ai_review_status, ai_confidence, completed_at')
        .in('status', [...ACTIVE_WORK_ITEM_STATUSES])
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data || []) as any[];
    },
    staleTime: 15_000,
    enabled: options?.enabled ?? true,
  });

/**
 * Bug reports — canonical query.
 */
export const useAdminBugs = (options?: { enabled?: boolean }) =>
  useQuery({
    queryKey: ['admin-bugs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bug_reports')
        .select('id, description, status, page_url, ai_severity, ai_category, ai_summary, created_at, user_id, resolved_at')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return data || [];
    },
    staleTime: 30_000,
    enabled: options?.enabled ?? true,
  });

/**
 * Products — canonical query.
 */
export const useAdminProducts = (options?: { enabled?: boolean }) =>
  useQuery({
    queryKey: ['admin-products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id, title_sv, title_en, handle, price, compare_at_price, stock, reserved_stock, allow_overselling, is_visible, badge, category, currency, created_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    staleTime: 60_000,
    enabled: options?.enabled ?? true,
  });

/**
 * Compute product health metrics.
 */
export function computeProductMetrics(products: any[]) {
  const lowStock = products.filter(p => !p.allow_overselling && p.stock <= 5 && p.stock >= 0);
  const outOfStock = products.filter(p => !p.allow_overselling && p.stock <= 0);
  const visible = products.filter(p => p.is_visible);

  return {
    total: products.length,
    visible: visible.length,
    lowStock: lowStock.length,
    outOfStock: outOfStock.length,
    lowStockItems: lowStock.slice(0, 10),
  };
}

/**
 * Analytics funnel events — canonical query for conversion metrics.
 */
export const useAdminAnalytics = (days = 30, options?: { enabled?: boolean }) =>
  useQuery({
    queryKey: ['admin-analytics', days],
    queryFn: async () => {
      const since = daysAgo(days);
      const { data, error } = await supabase
        .from('analytics_events')
        .select('event_type, created_at')
        .in('event_type', ['product_view', 'add_to_cart', 'checkout_start', 'checkout_complete', 'checkout_abandon'])
        .gte('created_at', since);
      if (error) throw error;
      return data || [];
    },
    staleTime: 60_000,
    enabled: options?.enabled ?? true,
  });

export function computeFunnelMetrics(events: any[]) {
  const views = events.filter(e => e.event_type === 'product_view').length;
  const carts = events.filter(e => e.event_type === 'add_to_cart').length;
  const checkoutStarts = events.filter(e => e.event_type === 'checkout_start').length;
  const purchases = events.filter(e => e.event_type === 'checkout_complete').length;
  const abandons = events.filter(e => e.event_type === 'checkout_abandon').length;

  return {
    views,
    carts,
    checkoutStarts,
    purchases,
    abandons,
    conversionRate: views > 0 ? Math.round((purchases / views) * 100) : 0,
    cartToCheckout: carts > 0 ? Math.round((checkoutStarts / carts) * 100) : 0,
    checkoutToOrder: checkoutStarts > 0 ? Math.round((purchases / checkoutStarts) * 100) : 0,
  };
}
