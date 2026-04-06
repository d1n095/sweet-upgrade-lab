-- Backfill source_id for existing active work_items where it is NULL.
-- Scanner-created items that can be linked to a scan run are updated first;
-- all remaining NULL rows fall back to 'lovable_manual'.

-- Step 1: Recover scan_run_id for scanner-sourced items by joining on the
--         closest scan_run that completed within 5 minutes of the work_item's
--         first_seen_at (or created_at as fallback).
UPDATE work_items wi
SET source_id = sr.id
FROM scan_runs sr
WHERE wi.source_id IS NULL
  AND wi.source_type = 'scanner'
  AND wi.status IN ('open', 'claimed', 'in_progress', 'escalated')
  AND sr.status IN ('done', 'completed')
  AND ABS(
    EXTRACT(EPOCH FROM (
      COALESCE(wi.first_seen_at, wi.created_at) - sr.completed_at
    ))
  ) <= 300;  -- within 5 minutes

-- Step 2: Set fallback 'lovable_manual' for all remaining active items
--         that still have no source_id after step 1.
UPDATE work_items
SET source_id = 'lovable_manual'
WHERE source_id IS NULL
  AND status IN ('open', 'claimed', 'in_progress', 'escalated');
