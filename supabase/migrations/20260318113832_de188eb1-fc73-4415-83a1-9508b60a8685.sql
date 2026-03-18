
-- Fix validate_affiliate_code: add input validation
CREATE OR REPLACE FUNCTION public.validate_affiliate_code(p_code text)
 RETURNS TABLE(affiliate_id uuid, affiliate_name text, customer_discount numeric, commission_percent numeric, is_valid boolean, message text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_affiliate RECORD;
BEGIN
  -- Input validation
  IF p_code IS NULL OR LENGTH(TRIM(p_code)) = 0 OR LENGTH(p_code) > 50 THEN
    RETURN QUERY SELECT
      NULL::UUID, NULL::TEXT, 0::NUMERIC, 0::NUMERIC, false, 'Ogiltig kod'::TEXT;
    RETURN;
  END IF;

  -- Sanitize: only allow alphanumeric, dash, underscore
  IF p_code !~ '^[a-zA-Z0-9_-]+$' THEN
    RETURN QUERY SELECT
      NULL::UUID, NULL::TEXT, 0::NUMERIC, 0::NUMERIC, false, 'Ogiltig kod'::TEXT;
    RETURN;
  END IF;

  SELECT * INTO v_affiliate
  FROM public.affiliates
  WHERE UPPER(code) = UPPER(p_code);

  IF NOT FOUND THEN
    RETURN QUERY SELECT
      NULL::UUID, NULL::TEXT, 0::NUMERIC, 0::NUMERIC, false, 'Ogiltig kod'::TEXT;
    RETURN;
  END IF;

  IF NOT v_affiliate.is_active THEN
    RETURN QUERY SELECT
      v_affiliate.id, v_affiliate.name, 0::NUMERIC, 0::NUMERIC, false, 'Ogiltig kod'::TEXT;
    RETURN;
  END IF;

  RETURN QUERY SELECT
    v_affiliate.id,
    v_affiliate.name,
    10::NUMERIC,
    v_affiliate.commission_percent,
    true,
    'Kod giltig! Du får 10% rabatt.'::TEXT;
END;
$$;

-- Fix validate_influencer_code: add input validation
CREATE OR REPLACE FUNCTION public.validate_influencer_code(p_code text, p_email text)
 RETURNS TABLE(influencer_id uuid, influencer_name text, products_remaining integer, is_valid boolean, message text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_influencer RECORD;
BEGIN
  -- Input validation
  IF p_code IS NULL OR LENGTH(TRIM(p_code)) = 0 OR LENGTH(p_code) > 50 THEN
    RETURN QUERY SELECT NULL::UUID, NULL::TEXT, 0::INTEGER, false, 'Ogiltig kod'::TEXT;
    RETURN;
  END IF;

  IF p_code !~ '^[a-zA-Z0-9_-]+$' THEN
    RETURN QUERY SELECT NULL::UUID, NULL::TEXT, 0::INTEGER, false, 'Ogiltig kod'::TEXT;
    RETURN;
  END IF;

  IF p_email IS NULL OR LENGTH(p_email) > 255 OR p_email !~ '^[^@]+@[^@]+\.[^@]+$' THEN
    RETURN QUERY SELECT NULL::UUID, NULL::TEXT, 0::INTEGER, false, 'Ogiltig kod'::TEXT;
    RETURN;
  END IF;

  SELECT * INTO v_influencer
  FROM public.influencers
  WHERE UPPER(code) = UPPER(p_code);

  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::UUID, NULL::TEXT, 0::INTEGER, false, 'Ogiltig kod'::TEXT;
    RETURN;
  END IF;

  IF NOT v_influencer.is_active THEN
    RETURN QUERY SELECT v_influencer.id, v_influencer.name, 0::INTEGER, false, 'Ogiltig kod'::TEXT;
    RETURN;
  END IF;

  IF v_influencer.valid_until IS NOT NULL AND v_influencer.valid_until < CURRENT_DATE THEN
    RETURN QUERY SELECT v_influencer.id, v_influencer.name, 0::INTEGER, false, 'Ogiltig kod'::TEXT;
    RETURN;
  END IF;

  IF LOWER(v_influencer.email) != LOWER(p_email) THEN
    RETURN QUERY SELECT v_influencer.id, v_influencer.name, 0::INTEGER, false, 'Ogiltig kod'::TEXT;
    RETURN;
  END IF;

  IF v_influencer.products_used >= v_influencer.max_products THEN
    RETURN QUERY SELECT v_influencer.id, v_influencer.name, 0::INTEGER, false, 'Ogiltig kod'::TEXT;
    RETURN;
  END IF;

  RETURN QUERY SELECT
    v_influencer.id,
    v_influencer.name,
    (v_influencer.max_products - v_influencer.products_used)::INTEGER,
    true,
    'Kod giltig! Du har ' || (v_influencer.max_products - v_influencer.products_used) || ' produkter kvar.'::TEXT;
END;
$$;

-- Fix permissive RLS: restrict affiliate_applications INSERT to validate input
DROP POLICY IF EXISTS "Anyone can apply to affiliate program" ON public.affiliate_applications;
CREATE POLICY "Anyone can apply to affiliate program"
  ON public.affiliate_applications
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    LENGTH(name) <= 200 AND
    LENGTH(email) <= 255 AND
    (phone IS NULL OR LENGTH(phone) <= 30) AND
    (social_media IS NULL OR LENGTH(social_media) <= 500) AND
    (why_join IS NULL OR LENGTH(why_join) <= 2000) AND
    status = 'pending' AND
    admin_notes IS NULL AND
    processed_at IS NULL
  );
