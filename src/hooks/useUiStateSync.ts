/**
 * UI State Sync Validation Hook
 * 
 * Ensures UI state matches actual system state by:
 * 1. Validating selected/detail items against DB
 * 2. Detecting stale list state (count mismatch)
 * 3. Force-refetching when mismatches are detected
 * 4. Resetting invalid selections
 */

import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface UiStateSyncOptions {
  /** The currently selected/detail item (or null) */
  selectedItem: any | null;
  /** Setter to clear the selected item when it's stale */
  clearSelection: () => void;
  /** Setter to update selected item with fresh data */
  updateSelection: (item: any) => void;
  /** The current list of items shown in the UI */
  listItems: any[];
  /** Query key to invalidate on mismatch */
  queryKey: string[];
  /** Table to validate against */
  table: string;
  /** How often to validate (ms). Default: 15000 */
  intervalMs?: number;
  /** Whether the hook is active */
  enabled?: boolean;
}

interface SyncReport {
  selectionValid: boolean;
  listFresh: boolean;
  mismatches: string[];
}

export function useUiStateSync({
  selectedItem,
  clearSelection,
  updateSelection,
  listItems,
  queryKey,
  table,
  intervalMs = 15_000,
  enabled = true,
}: UiStateSyncOptions) {
  const queryClient = useQueryClient();
  const lastSyncRef = useRef<number>(0);
  const syncingRef = useRef(false);

  const validateSelection = useCallback(async (): Promise<boolean> => {
    if (!selectedItem?.id) return true;

    try {
      const { data, error } = await supabase
        .from(table as any)
        .select('id, status, priority, title, updated_at')
        .eq('id', selectedItem.id)
        .maybeSingle();

      if (error || !data) {
        // Item no longer exists
        clearSelection();
        return false;
      }

      // Check for stale data: if DB has newer updated_at
      const dbUpdated = new Date((data as any).updated_at).getTime();
      const uiUpdated = selectedItem.updated_at ? new Date(selectedItem.updated_at).getTime() : 0;

      if (dbUpdated > uiUpdated) {
        // Fetch full item and update selection
        const { data: fullItem } = await supabase
          .from(table as any)
          .select('*')
          .eq('id', selectedItem.id)
          .maybeSingle();

        if (fullItem) {
          updateSelection(fullItem as any);
        }
        return false;
      }

      return true;
    } catch {
      return true; // Don't disrupt on network errors
    }
  }, [selectedItem, table, clearSelection, updateSelection]);

  const validateListFreshness = useCallback(async (): Promise<boolean> => {
    if (!listItems.length) return true;

    try {
      // Quick count check: are we missing items or have extra?
      const { count, error } = await supabase
        .from(table as any)
        .select('id', { count: 'exact', head: true });

      if (error || count === null) return true;

      // If count differs significantly, force refetch
      // Allow small variance (±5) to avoid unnecessary refetches during active use
      const diff = Math.abs(count - listItems.length);
      if (diff > 5) {
        queryClient.invalidateQueries({ queryKey });
        return false;
      }

      // Spot-check: verify a random sample of items still have matching status
      const sampleSize = Math.min(3, listItems.length);
      const sample = listItems
        .slice()
        .sort(() => Math.random() - 0.5)
        .slice(0, sampleSize);

      const sampleIds = sample.map(i => i.id);
      const { data: dbSample } = await supabase
        .from(table as any)
        .select('id, status, priority')
        .in('id', sampleIds);

      if (!dbSample) return true;

      const dbMap = new Map((dbSample as any[]).map(i => [i.id, i]));
      let hasMismatch = false;

      for (const uiItem of sample) {
        const dbItem = dbMap.get(uiItem.id);
        if (!dbItem) {
          hasMismatch = true;
          break;
        }
        if (dbItem.status !== uiItem.status || dbItem.priority !== uiItem.priority) {
          hasMismatch = true;
          break;
        }
      }

      if (hasMismatch) {
        queryClient.invalidateQueries({ queryKey });
        return false;
      }

      return true;
    } catch {
      return true;
    }
  }, [listItems, table, queryKey, queryClient]);

  const runSync = useCallback(async (): Promise<SyncReport> => {
    if (syncingRef.current) return { selectionValid: true, listFresh: true, mismatches: [] };
    syncingRef.current = true;

    const mismatches: string[] = [];

    try {
      const selectionValid = await validateSelection();
      if (!selectionValid) mismatches.push('selection_stale');

      const listFresh = await validateListFreshness();
      if (!listFresh) mismatches.push('list_stale');

      lastSyncRef.current = Date.now();
      return { selectionValid, listFresh, mismatches };
    } finally {
      syncingRef.current = false;
    }
  }, [validateSelection, validateListFreshness]);

  // Periodic validation
  useEffect(() => {
    if (!enabled) return;

    const interval = setInterval(() => {
      runSync();
    }, intervalMs);

    return () => clearInterval(interval);
  }, [enabled, intervalMs, runSync]);

  // Validate selection immediately when it changes
  useEffect(() => {
    if (!enabled || !selectedItem?.id) return;
    validateSelection();
  }, [selectedItem?.id, enabled, validateSelection]);

  // Force sync after user actions (visibility change = tab switch back)
  useEffect(() => {
    if (!enabled) return;

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        const elapsed = Date.now() - lastSyncRef.current;
        if (elapsed > 5_000) {
          runSync();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [enabled, runSync]);

  return { runSync };
}
