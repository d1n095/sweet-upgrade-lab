CREATE OR REPLACE FUNCTION public.get_dashboard_stats(p_from text, p_to text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_result jsonb;
  v_orders jsonb;
  v_analytics jsonb;
  v_searches jsonb;
BEGIN
  IF NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Order stats: ONLY paid, non-deleted, non-cancelled
  SELECT jsonb_build_object(
    'total_revenue', COALESCE(SUM(
      CASE WHEN payment_status = 'paid' THEN total_amount - COALESCE(refund_amount, 0) ELSE 0 END
    ), 0),
    'gross_revenue', COALESCE(SUM(
      CASE WHEN payment_status = 'paid' THEN total_amount ELSE 0 END
    ), 0),
    'total_refunds', COALESCE(SUM(
      CASE WHEN payment_status = 'paid' THEN COALESCE(refund_amount, 0) ELSE 0 END
    ), 0),
    'paid_count', COUNT(*) FILTER (WHERE payment_status = 'paid'),
    'failed_count', COUNT(*) FILTER (WHERE payment_status = 'failed'),
    'pending_count', COUNT(*) FILTER (WHERE payment_status = 'unpaid' AND status = 'pending'),
    'refunded_count', COUNT(*) FILTER (WHERE refund_status = 'refunded'),
    'total_orders', COUNT(*),
    'avg_order', COALESCE(AVG(total_amount) FILTER (WHERE payment_status = 'paid'), 0),
    'median_order', COALESCE(
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY total_amount) FILTER (WHERE payment_status = 'paid'),
      0
    ),
    'ranges', jsonb_build_array(
      jsonb_build_object('label', '0–99 kr', 'count', COUNT(*) FILTER (WHERE payment_status = 'paid' AND total_amount >= 0 AND total_amount < 100)),
      jsonb_build_object('label', '100–249 kr', 'count', COUNT(*) FILTER (WHERE payment_status = 'paid' AND total_amount >= 100 AND total_amount < 250)),
      jsonb_build_object('label', '250–499 kr', 'count', COUNT(*) FILTER (WHERE payment_status = 'paid' AND total_amount >= 250 AND total_amount < 500)),
      jsonb_build_object('label', '500–999 kr', 'count', COUNT(*) FILTER (WHERE payment_status = 'paid' AND total_amount >= 500 AND total_amount < 1000)),
      jsonb_build_object('label', '1 000+ kr', 'count', COUNT(*) FILTER (WHERE payment_status = 'paid' AND total_amount >= 1000))
    )
  ) INTO v_orders
  FROM public.orders
  WHERE created_at >= p_from
    AND created_at <= p_to
    AND deleted_at IS NULL
    AND status != 'cancelled';

  -- Analytics
  SELECT jsonb_build_object(
    'product_views', COUNT(*) FILTER (WHERE event_type = 'product_view'),
    'cart_adds', COUNT(*) FILTER (WHERE event_type = 'add_to_cart'),
    'cart_removes', COUNT(*) FILTER (WHERE event_type = 'remove_from_cart'),
    'checkout_starts', COUNT(*) FILTER (WHERE event_type = 'checkout_start'),
    'checkout_completes', COUNT(*) FILTER (WHERE event_type = 'checkout_complete'),
    'checkout_abandons', COUNT(*) FILTER (WHERE event_type = 'checkout_abandon')
  ) INTO v_analytics
  FROM public.analytics_events
  WHERE created_at >= p_from AND created_at <= p_to;

  -- Searches
  SELECT jsonb_build_object(
    'total_searches', COUNT(*),
    'with_results', COUNT(*) FILTER (WHERE results_count > 0),
    'without_results', COUNT(*) FILTER (WHERE results_count = 0)
  ) INTO v_searches
  FROM public.search_logs
  WHERE created_at >= p_from AND created_at <= p_to;

  v_result := jsonb_build_object(
    'orders', v_orders,
    'analytics', v_analytics,
    'searches', v_searches,
    'period_from', p_from,
    'period_to', p_to
  );

  RETURN v_result;
END;
$function$;