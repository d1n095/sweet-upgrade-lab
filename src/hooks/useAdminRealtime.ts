/**
 * Centralized admin realtime subscription.
 * Listens to all key tables and invalidates the canonical react-query caches.
 * Mount ONCE in AdminLayout so every admin page benefits.
 */
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/** Map of DB table → query keys to invalidate on change */
const TABLE_QUERY_MAP: Record<string, string[]> = {
  orders: ['admin-orders', 'mini-workbench-items'],
  work_items: ['admin-work-items'],
  bug_reports: ['admin-bugs', 'bug-reports'],
  products: ['admin-products'],
  analytics_events: ['admin-analytics'],
  change_log: ['admin-change-log', 'change-log'],
  ai_scan_results: ['admin-scan-results', 'last-scan-result', 'scan-history', 'autopilot-scan-runs'],
  reviews: ['admin-reviews'],
  donations: ['admin-donations'],
  donation_projects: ['admin-donations'],
  order_incidents: ['admin-incidents'],
  affiliates: ['admin-affiliates'],
  affiliate_orders: ['admin-affiliates'],
  affiliate_payout_requests: ['admin-payout-requests'],
  refund_requests: ['admin-refunds'],
  notifications: ['admin-notifications'],
  categories: ['admin-categories'],
  bundles: ['admin-bundles'],
  staff_performance: ['admin-staff-performance'],
  store_settings: ['admin-store-settings'],
  profiles: ['admin-profiles'],
};

export function useAdminRealtime() {
  const queryClient = useQueryClient();

  useEffect(() => {
    let channel = supabase.channel('admin-global-sync');

    for (const [table, keys] of Object.entries(TABLE_QUERY_MAP)) {
      channel = channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        () => {
          for (const key of keys) {
            queryClient.invalidateQueries({ queryKey: [key] });
          }
        }
      );
    }

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
