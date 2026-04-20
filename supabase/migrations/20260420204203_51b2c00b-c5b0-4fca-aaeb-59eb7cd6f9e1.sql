-- ============================================================================
-- AFFILIATE CLICK TRACKING
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.affiliate_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  code text NOT NULL,
  landing_path text,
  referrer text,
  ip_hash text,
  user_agent text,
  session_id text,
  converted_order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  converted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_affiliate
  ON public.affiliate_clicks(affiliate_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_code
  ON public.affiliate_clicks(code, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_session
  ON public.affiliate_clicks(session_id) WHERE session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_converted
  ON public.affiliate_clicks(converted_order_id) WHERE converted_order_id IS NOT NULL;

ALTER TABLE public.affiliate_clicks ENABLE ROW LEVEL SECURITY;

-- Admins/founders can read all
CREATE POLICY "affiliate_clicks readable by admins"
  ON public.affiliate_clicks FOR SELECT
  TO authenticated
  USING (is_admin(auth.uid()));

-- Affiliates can read their own clicks
CREATE POLICY "affiliate_clicks readable by owner"
  ON public.affiliate_clicks FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.affiliates a
      WHERE a.id = affiliate_clicks.affiliate_id
        AND a.user_id = auth.uid()
    )
  );

-- Inserts only via SECURITY DEFINER function below; block direct writes
CREATE POLICY "affiliate_clicks no direct insert"
  ON public.affiliate_clicks FOR INSERT
  TO authenticated, anon
  WITH CHECK (false);

-- ============================================================================
-- TRACK CLICK (callable by anonymous visitors)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.track_affiliate_click(
  p_code text,
  p_landing_path text DEFAULT NULL,
  p_referrer text DEFAULT NULL,
  p_ip_hash text DEFAULT NULL,
  p_user_agent text DEFAULT NULL,
  p_session_id text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_affiliate_id uuid;
  v_click_id uuid;
BEGIN
  -- Validate code format
  IF p_code IS NULL OR LENGTH(TRIM(p_code)) = 0 OR LENGTH(p_code) > 50 THEN
    RETURN NULL;
  END IF;
  IF p_code !~ '^[a-zA-Z0-9_-]+$' THEN
    RETURN NULL;
  END IF;

  -- Lookup active affiliate
  SELECT id INTO v_affiliate_id
  FROM public.affiliates
  WHERE UPPER(code) = UPPER(p_code)
    AND is_active = true;

  IF v_affiliate_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Truncate long inputs defensively
  INSERT INTO public.affiliate_clicks (
    affiliate_id, code, landing_path, referrer, ip_hash, user_agent, session_id
  ) VALUES (
    v_affiliate_id,
    UPPER(p_code),
    LEFT(COALESCE(p_landing_path, ''), 500),
    LEFT(COALESCE(p_referrer, ''), 500),
    LEFT(COALESCE(p_ip_hash, ''), 128),
    LEFT(COALESCE(p_user_agent, ''), 500),
    LEFT(COALESCE(p_session_id, ''), 128)
  )
  RETURNING id INTO v_click_id;

  RETURN v_click_id;
END;
$$;

-- Allow anonymous + authenticated to call the tracker
GRANT EXECUTE ON FUNCTION public.track_affiliate_click(text, text, text, text, text, text)
  TO anon, authenticated;

-- ============================================================================
-- MARK CLICK AS CONVERTED (called from checkout completion)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.mark_affiliate_click_converted(
  p_session_id text,
  p_affiliate_id uuid,
  p_order_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  IF p_session_id IS NULL OR p_affiliate_id IS NULL OR p_order_id IS NULL THEN
    RETURN 0;
  END IF;

  -- Mark the most recent un-converted click for this session+affiliate
  WITH target AS (
    SELECT id FROM public.affiliate_clicks
    WHERE session_id = p_session_id
      AND affiliate_id = p_affiliate_id
      AND converted_order_id IS NULL
    ORDER BY created_at DESC
    LIMIT 1
  )
  UPDATE public.affiliate_clicks ac
  SET converted_order_id = p_order_id,
      converted_at = now()
  FROM target
  WHERE ac.id = target.id;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_affiliate_click_converted(text, uuid, uuid)
  TO authenticated, service_role;

-- ============================================================================
-- COMMISSION CALCULATOR (pure, deterministic)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.calculate_affiliate_commission(
  p_affiliate_id uuid,
  p_order_total numeric
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pct numeric;
  v_discount numeric := 10; -- fixed customer discount (matches validate_affiliate_code)
  v_commission numeric;
BEGIN
  IF p_affiliate_id IS NULL OR p_order_total IS NULL OR p_order_total < 0 THEN
    RETURN jsonb_build_object('commission', 0, 'customer_discount', 0, 'percent', 0, 'valid', false);
  END IF;

  SELECT commission_percent INTO v_pct
  FROM public.affiliates
  WHERE id = p_affiliate_id AND is_active = true;

  IF v_pct IS NULL THEN
    RETURN jsonb_build_object('commission', 0, 'customer_discount', 0, 'percent', 0, 'valid', false);
  END IF;

  -- Deterministic: commission = order_total * percent / 100, rounded to 2 decimals
  v_commission := ROUND(p_order_total * v_pct / 100.0, 2);

  RETURN jsonb_build_object(
    'commission', v_commission,
    'customer_discount', v_discount,
    'percent', v_pct,
    'order_total', p_order_total,
    'valid', true
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.calculate_affiliate_commission(uuid, numeric)
  TO authenticated, service_role;

-- ============================================================================
-- PERFORMANCE STATS (deterministic, per-affiliate)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_affiliate_performance(
  p_affiliate_id uuid,
  p_from timestamptz DEFAULT (now() - INTERVAL '30 days'),
  p_to   timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clicks int;
  v_conversions int;
  v_orders int;
  v_revenue numeric;
  v_commission numeric;
  v_pending numeric;
  v_paid numeric;
BEGIN
  -- Auth: admin OR the affiliate's own user
  IF NOT (
    is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.affiliates a
      WHERE a.id = p_affiliate_id AND a.user_id = auth.uid()
    )
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT COUNT(*) INTO v_clicks
  FROM public.affiliate_clicks
  WHERE affiliate_id = p_affiliate_id
    AND created_at BETWEEN p_from AND p_to;

  SELECT COUNT(*) INTO v_conversions
  FROM public.affiliate_clicks
  WHERE affiliate_id = p_affiliate_id
    AND converted_order_id IS NOT NULL
    AND converted_at BETWEEN p_from AND p_to;

  SELECT
    COUNT(*),
    COALESCE(SUM(order_total), 0),
    COALESCE(SUM(commission_amount), 0),
    COALESCE(SUM(commission_amount) FILTER (WHERE status = 'pending'), 0),
    COALESCE(SUM(commission_amount) FILTER (WHERE status = 'paid'), 0)
  INTO v_orders, v_revenue, v_commission, v_pending, v_paid
  FROM public.affiliate_orders
  WHERE affiliate_id = p_affiliate_id
    AND created_at BETWEEN p_from AND p_to;

  RETURN jsonb_build_object(
    'affiliate_id', p_affiliate_id,
    'period_from', p_from,
    'period_to', p_to,
    'clicks', v_clicks,
    'conversions', v_conversions,
    'conversion_rate', CASE WHEN v_clicks > 0 THEN ROUND(v_conversions::numeric / v_clicks * 100, 2) ELSE 0 END,
    'orders', v_orders,
    'revenue', v_revenue,
    'commission_total', v_commission,
    'commission_pending', v_pending,
    'commission_paid', v_paid
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_affiliate_performance(uuid, timestamptz, timestamptz)
  TO authenticated, service_role;