
CREATE OR REPLACE FUNCTION cleanup_orphan_work_items()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted int := 0;
  v_ignored int := 0;
  v_updated int := 0;
BEGIN
  -- 1. Delete work_items linked to deleted orders
  WITH deleted_order_tasks AS (
    DELETE FROM work_items wi
    WHERE wi.source_type = 'order'
      AND wi.related_order_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM orders o
        WHERE o.id = wi.related_order_id
          AND o.deleted_at IS NOT NULL
      )
    RETURNING wi.id
  )
  SELECT count(*) INTO v_deleted FROM deleted_order_tasks;

  -- 2. Mark as ignored: tasks linked to cancelled orders
  WITH cancelled_order_tasks AS (
    UPDATE work_items wi
    SET status = 'done', completed_at = now()
    WHERE wi.related_order_id IS NOT NULL
      AND wi.status IN ('open', 'claimed', 'in_progress', 'escalated')
      AND EXISTS (
        SELECT 1 FROM orders o
        WHERE o.id = wi.related_order_id
          AND o.status = 'cancelled'
      )
    RETURNING wi.id
  )
  SELECT count(*) INTO v_ignored FROM cancelled_order_tasks;

  -- 3. Close tasks for completed/delivered orders
  WITH completed_order_tasks AS (
    UPDATE work_items wi
    SET status = 'done', completed_at = now()
    WHERE wi.related_order_id IS NOT NULL
      AND wi.status IN ('open', 'claimed', 'in_progress')
      AND wi.item_type IN ('pack_order', 'packing', 'shipping')
      AND EXISTS (
        SELECT 1 FROM orders o
        WHERE o.id = wi.related_order_id
          AND o.fulfillment_status IN ('shipped', 'delivered')
      )
    RETURNING wi.id
  )
  SELECT count(*) INTO v_updated FROM completed_order_tasks;

  -- 4. Remove orphan tasks where related_order_id points to non-existing order
  WITH orphan_tasks AS (
    DELETE FROM work_items wi
    WHERE wi.related_order_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM orders o WHERE o.id = wi.related_order_id
      )
    RETURNING wi.id
  )
  SELECT v_deleted + count(*) INTO v_deleted FROM orphan_tasks;

  RETURN jsonb_build_object(
    'deleted', v_deleted,
    'ignored_cancelled', v_ignored,
    'closed_completed', v_updated
  );
END;
$$;
