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
        .select('id, order_email, order_number, total_amount, status, payment_status, fulfillment_status, created_at, deleted_at, tracking_number, payment_intent_id, refund_amount, refund_status, currency, shipped_at, packed_at, delivered_at, packed_by, shipped_by, delivery_method, shipping_method, payment_method, notes, items, shipping_address')
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    staleTime: 5_000,
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
    todayOrderCount: todayPaid.length,
    ordersToPackCount: paidOrders.filter(o => ['pending', 'unfulfilled'].includes(o.fulfillment_status)).length,
    ordersToShipCount: paidOrders.filter(o => o.fulfillment_status === 'ready_to_ship').length,
    shippedCount: paidOrders.filter(o => o.fulfillment_status === 'shipped').length,
  };
}

/**
 * Ops-specific computed metrics from orders.
 */
export function computeOpsMetrics(orders: any[]) {
  const paid = orders.filter(o => o.payment_status === PAID_STATUS);
  return {
    all: orders.length,
    toPack: paid.filter(o => ['pending', 'unfulfilled'].includes(o.fulfillment_status)).length,
    toShip: paid.filter(o => o.fulfillment_status === 'ready_to_ship').length,
    shipped: paid.filter(o => o.fulfillment_status === 'shipped').length,
    delivered: paid.filter(o => o.fulfillment_status === 'delivered').length,
  };
}

/**
 * Active work items — canonical query for Workbench / overview.
 */
export const useAdminWorkItems = (options?: { enabled?: boolean }) =>
  useQuery({
    queryKey: ['admin-work-items'],
    queryFn: async () => {
      // NOTE: Removed cleanup_orphan_work_items from here — running it before every fetch
      // was deleting newly created items due to race conditions. Cleanup should only run
      // on explicit user action or scheduled automation, not on every query.

      const { data, error } = await supabase
        .from('work_items' as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      console.log('[useAdminWorkItems] DB ITEMS:', (data || []).length, 'items fetched');
      return (data || []) as any[];
    },
    staleTime: 5_000,
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
    staleTime: 10_000,
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
        .select('id, title_sv, title_en, handle, price, original_price, stock, reserved_stock, allow_overselling, is_visible, badge, category, currency, created_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    staleTime: 10_000,
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
    staleTime: 15_000,
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

// ── EXTENDED QUERIES ──

/**
 * Reviews — canonical query.
 */
export const useAdminReviews = (options?: { enabled?: boolean }) =>
  useQuery({
    queryKey: ['admin-reviews'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reviews')
        .select('id, user_id, shopify_product_id, shopify_product_handle, product_title, rating, comment, is_verified_purchase, is_approved, admin_response, created_at')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return data || [];
    },
    staleTime: 10_000,
    enabled: options?.enabled ?? true,
  });

export function computeReviewMetrics(reviews: any[]) {
  const approved = reviews.filter(r => r.is_approved);
  const pending = reviews.filter(r => !r.is_approved);
  const avgRating = reviews.length > 0
    ? reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviews.length
    : 0;
  return {
    total: reviews.length,
    approved: approved.length,
    pending: pending.length,
    averageRating: Math.round(avgRating * 10) / 10,
    verified: reviews.filter(r => r.is_verified_purchase).length,
  };
}

/**
 * Donations — canonical query.
 */
export const useAdminDonations = (options?: { enabled?: boolean }) =>
  useQuery({
    queryKey: ['admin-donations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('donations')
        .select('id, amount, source, purpose, user_id, anonymous_id, is_anonymous, created_at, order_id')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return data || [];
    },
    staleTime: 15_000,
    enabled: options?.enabled ?? true,
  });

export function computeDonationMetrics(donations: any[]) {
  const total = donations.reduce((s, d) => s + (d.amount || 0), 0);
  const month = monthStart();
  const thisMonth = donations.filter(d => d.created_at >= month);
  const monthTotal = thisMonth.reduce((s, d) => s + (d.amount || 0), 0);
  return {
    totalAmount: total,
    monthAmount: monthTotal,
    count: donations.length,
    monthCount: thisMonth.length,
  };
}

/**
 * Incidents — canonical query.
 */
export const useAdminIncidents = (options?: { enabled?: boolean }) =>
  useQuery({
    queryKey: ['admin-incidents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('order_incidents')
        .select('id, order_id, title, description, type, priority, status, sla_status, sla_deadline, assigned_to, reported_by, created_at, resolved_at, escalated_at, resolution')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return data || [];
    },
    staleTime: 10_000,
    enabled: options?.enabled ?? true,
  });

export function computeIncidentMetrics(incidents: any[]) {
  const open = incidents.filter(i => !['resolved', 'closed'].includes(i.status));
  const slaOverdue = incidents.filter(i => i.sla_status === 'overdue');
  return {
    total: incidents.length,
    open: open.length,
    highPriority: incidents.filter(i => i.priority === 'high').length,
    slaOverdue: slaOverdue.length,
    resolved: incidents.filter(i => ['resolved', 'closed'].includes(i.status)).length,
  };
}

/**
 * Affiliates — canonical query.
 */
export const useAdminAffiliates = (options?: { enabled?: boolean }) =>
  useQuery({
    queryKey: ['admin-affiliates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('affiliates')
        .select('id, name, email, code, commission_percent, total_earnings, pending_earnings, paid_earnings, total_orders, total_sales, is_active, created_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    staleTime: 15_000,
    enabled: options?.enabled ?? true,
  });

export function computeAffiliateMetrics(affiliates: any[]) {
  const active = affiliates.filter(a => a.is_active);
  return {
    total: affiliates.length,
    active: active.length,
    totalEarnings: affiliates.reduce((s, a) => s + (a.total_earnings || 0), 0),
    pendingEarnings: affiliates.reduce((s, a) => s + (a.pending_earnings || 0), 0),
    paidEarnings: affiliates.reduce((s, a) => s + (a.paid_earnings || 0), 0),
    totalSales: affiliates.reduce((s, a) => s + (a.total_sales || 0), 0),
  };
}

/**
 * Affiliate payout requests — canonical query.
 */
export const useAdminPayoutRequests = (options?: { enabled?: boolean }) =>
  useQuery({
    queryKey: ['admin-payout-requests'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('affiliate_payout_requests')
        .select('id, affiliate_id, amount, status, payout_type, notes, created_at, processed_at')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
    staleTime: 10_000,
    enabled: options?.enabled ?? true,
  });

/**
 * Refund requests — canonical query.
 */
export const useAdminRefunds = (options?: { enabled?: boolean }) =>
  useQuery({
    queryKey: ['admin-refunds'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('refund_requests')
        .select('id, order_id, user_id, reason, refund_amount, status, created_at, processed_at, processed_by')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
    staleTime: 10_000,
    enabled: options?.enabled ?? true,
  });

/**
 * Categories — canonical query.
 */
export const useAdminCategories = (options?: { enabled?: boolean }) =>
  useQuery({
    queryKey: ['admin-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('id, name_sv, name_en, slug, parent_id, display_order, icon, is_visible, created_at')
        .order('display_order');
      if (error) throw error;
      return data || [];
    },
    staleTime: 30_000,
    enabled: options?.enabled ?? true,
  });

/**
 * Search logs — canonical query.
 */
export const useAdminSearchLogs = (days = 30, options?: { enabled?: boolean }) =>
  useQuery({
    queryKey: ['admin-search-logs', days],
    queryFn: async () => {
      const since = daysAgo(days);
      const { data, error } = await supabase
        .from('search_logs')
        .select('id, search_term, results_count, created_at')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(1000);
      if (error) throw error;
      return data || [];
    },
    staleTime: 15_000,
    enabled: options?.enabled ?? true,
  });

/**
 * Activity logs — canonical query.
 */
export const useAdminActivityLogs = (days = 7, options?: { enabled?: boolean }) =>
  useQuery({
    queryKey: ['admin-activity-logs', days],
    queryFn: async () => {
      const since = daysAgo(days);
      const { data, error } = await supabase
        .from('activity_logs')
        .select('id, log_type, category, message, details, order_id, user_id, created_at')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return data || [];
    },
    staleTime: 10_000,
    enabled: options?.enabled ?? true,
  });

/**
 * Staff performance — canonical query.
 */
export const useAdminStaffPerformance = (options?: { enabled?: boolean }) =>
  useQuery({
    queryKey: ['admin-staff-performance'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('staff_performance')
        .select('user_id, tasks_completed, tasks_active, sla_hits, sla_misses, points, avg_completion_seconds, total_completion_seconds, updated_at')
        .order('points', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    staleTime: 15_000,
    enabled: options?.enabled ?? true,
  });

/**
 * Product sales — canonical query for top products.
 */
export const useAdminProductSales = (options?: { enabled?: boolean }) =>
  useQuery({
    queryKey: ['admin-product-sales'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_sales')
        .select('product_id, product_title, total_quantity_sold, total_revenue, last_sold_at')
        .order('total_quantity_sold', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    staleTime: 30_000,
    enabled: options?.enabled ?? true,
  });

/**
 * Store settings — canonical query.
 */
export const useAdminStoreSettings = (options?: { enabled?: boolean }) =>
  useQuery({
    queryKey: ['admin-store-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('store_settings')
        .select('key, value, updated_at');
      if (error) throw error;
      return data || [];
    },
    staleTime: 30_000,
    enabled: options?.enabled ?? true,
  });

/**
 * Email templates — canonical query.
 */
export const useAdminEmailTemplates = (options?: { enabled?: boolean }) =>
  useQuery({
    queryKey: ['admin-email-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_templates')
        .select('*')
        .order('template_type');
      if (error) throw error;
      return data || [];
    },
    staleTime: 30_000,
    enabled: options?.enabled ?? true,
  });

/**
 * Campaigns/bundles — canonical query.
 */
export const useAdminBundles = (options?: { enabled?: boolean }) =>
  useQuery({
    queryKey: ['admin-bundles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bundles')
        .select('*')
        .order('display_order');
      if (error) throw error;
      return data || [];
    },
    staleTime: 15_000,
    enabled: options?.enabled ?? true,
  });

/**
 * Notifications — canonical query.
 */
export const useAdminNotifications = (options?: { enabled?: boolean }) =>
  useQuery({
    queryKey: ['admin-notifications'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('id, type, message, read, related_id, related_type, created_at, user_id')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
    staleTime: 5_000,
    enabled: options?.enabled ?? true,
  });
