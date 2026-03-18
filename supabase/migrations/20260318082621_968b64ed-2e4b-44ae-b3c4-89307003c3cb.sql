
-- Function: check if user has a verified purchase of a product and hasn't already reviewed it
CREATE OR REPLACE FUNCTION public.check_review_eligibility(p_user_id uuid, p_product_id text)
RETURNS TABLE(can_review boolean, is_verified_purchase boolean, already_reviewed boolean, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_has_purchase boolean := false;
  v_already_reviewed boolean := false;
BEGIN
  -- Check if user already reviewed this product
  SELECT EXISTS (
    SELECT 1 FROM public.reviews
    WHERE user_id = p_user_id
      AND shopify_product_id = p_product_id
  ) INTO v_already_reviewed;

  IF v_already_reviewed THEN
    RETURN QUERY SELECT false, false, true, 'Du har redan recenserat denna produkt'::text;
    RETURN;
  END IF;

  -- Check if user has a confirmed/delivered order containing this product
  SELECT EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.user_id = p_user_id
      AND o.status IN ('confirmed', 'delivered', 'processing', 'shipped')
      AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(o.items) AS item
        WHERE item->>'id' = p_product_id
      )
  ) INTO v_has_purchase;

  IF NOT v_has_purchase THEN
    RETURN QUERY SELECT false, false, false, 'Endast verifierade köpare kan lämna recension'::text;
    RETURN;
  END IF;

  RETURN QUERY SELECT true, true, false, 'Du kan lämna en recension'::text;
END;
$$;

-- Add unique constraint to prevent duplicate reviews per user per product
ALTER TABLE public.reviews ADD CONSTRAINT reviews_user_product_unique UNIQUE (user_id, shopify_product_id);
