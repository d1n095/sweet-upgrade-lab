
-- Add weight field to products table
ALTER TABLE public.products ADD COLUMN weight_grams integer DEFAULT NULL;

-- Add comment for clarity
COMMENT ON COLUMN public.products.weight_grams IS 'Product weight in grams. Required for physical products to calculate shipping.';

-- Add shipping weight tier settings to store_settings
INSERT INTO public.store_settings (key, value, text_value) VALUES
  ('shipping_weight_enabled', true, 'true'),
  ('shipping_tier_1_max_grams', true, '1000'),
  ('shipping_tier_1_price', true, '49'),
  ('shipping_tier_2_max_grams', true, '5000'),
  ('shipping_tier_2_price', true, '79'),
  ('shipping_tier_3_price', true, '129'),
  ('shipping_price_per_kg', true, '15'),
  ('shipping_max_weight_grams', true, '30000'),
  ('shipping_fallback_price', true, '99')
ON CONFLICT (key) DO NOTHING;
