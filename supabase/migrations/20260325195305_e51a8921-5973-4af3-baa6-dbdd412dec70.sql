
CREATE OR REPLACE FUNCTION public.cleanup_orphan_work_items()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cancelled_deleted_order int := 0;
  v_cancelled_order int := 0;
  v_updated int := 0;
  v_cancelled_orphan int := 0;
BEGIN
  -- 1. Cancel work_items linked to deleted orders (was DELETE)
  WITH deleted_order_tasks AS (
    UPDATE work_items wi
    SET status = 'cancelled', updated_at = now()
    WHERE wi.source_type = 'order'
      AND wi.related_order_id IS NOT NULL
      AND wi.status NOT IN ('done', 'cancelled')
      AND EXISTS (
        SELECT 1 FROM orders o
        WHERE o.id = wi.related_order_id
          AND o.deleted_at IS NOT NULL
      )
    RETURNING wi.id
  )
  SELECT count(*) INTO v_cancelled_deleted_order FROM deleted_order_tasks;

  -- 2. Cancel tasks linked to cancelled orders
  WITH cancelled_order_tasks AS (
    UPDATE work_items wi
    SET status = 'cancelled', updated_at = now()
    WHERE wi.related_order_id IS NOT NULL
      AND wi.status IN ('open', 'claimed', 'in_progress', 'escalated')
      AND EXISTS (
        SELECT 1 FROM orders o
        WHERE o.id = wi.related_order_id
          AND o.status = 'cancelled'
      )
    RETURNING wi.id
  )
  SELECT count(*) INTO v_cancelled_order FROM cancelled_order_tasks;

  -- 3. Close tasks for completed/delivered orders
  WITH completed_order_tasks AS (
    UPDATE work_items wi
    SET status = 'done', completed_at = now(), updated_at = now()
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

  -- 4. Cancel orphan tasks where related_order_id points to non-existing order (was DELETE)
  WITH orphan_tasks AS (
    UPDATE work_items wi
    SET status = 'cancelled', updated_at = now()
    WHERE wi.related_order_id IS NOT NULL
      AND wi.status NOT IN ('done', 'cancelled')
      AND NOT EXISTS (
        SELECT 1 FROM orders o WHERE o.id = wi.related_order_id
      )
    RETURNING wi.id
  )
  SELECT count(*) INTO v_cancelled_orphan FROM orphan_tasks;

  RETURN jsonb_build_object(
    'cancelled_deleted_order', v_cancelled_deleted_order,
    'cancelled_order', v_cancelled_order,
    'closed_completed', v_updated,
    'cancelled_orphan', v_cancelled_orphan
  );
END;
$function$;
