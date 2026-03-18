
-- Add a text_value column to store_settings for non-boolean values (shipping cost, thresholds, etc.)
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS text_value text;

-- Seed shipping defaults
INSERT INTO public.store_settings (key, value, text_value) VALUES
  ('shipping_cost', true, '39'),
  ('free_shipping_threshold', true, '500'),
  ('free_shipping_enabled', true, NULL)
ON CONFLICT (key) DO NOTHING;
