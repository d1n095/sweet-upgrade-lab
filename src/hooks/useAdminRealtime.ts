/**
 * Centralized admin realtime subscription.
 * Listens to all key tables and invalidates the canonical react-query caches.
 * Mount ONCE in AdminLayout so every admin page benefits.
 */
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const ADMIN_QUERY_KEYS = [
  'admin-orders',
  'admin-work-items',
  'admin-products',
  'admin-bugs',
  'admin-analytics',
  'mini-workbench-items',
] as const;

export function useAdminRealtime() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('admin-global-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
        queryClient.invalidateQueries({ queryKey: ['mini-workbench-items'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'work_items' }, () => {
        queryClient.invalidateQueries({ queryKey: ['admin-work-items'] });
        queryClient.invalidateQueries({ queryKey: ['mini-workbench-items'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bug_reports' }, () => {
        queryClient.invalidateQueries({ queryKey: ['admin-bugs'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => {
        queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'analytics_events' }, () => {
        queryClient.invalidateQueries({ queryKey: ['admin-analytics'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'change_log' }, () => {
        queryClient.invalidateQueries({ queryKey: ['admin-change-log'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ai_scan_results' }, () => {
        queryClient.invalidateQueries({ queryKey: ['admin-scan-results'] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
