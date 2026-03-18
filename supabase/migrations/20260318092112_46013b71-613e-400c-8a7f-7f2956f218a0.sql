
-- Add unique constraint on key column for upsert support
ALTER TABLE public.store_settings ADD CONSTRAINT store_settings_key_unique UNIQUE (key);

-- Insert homepage section defaults
INSERT INTO public.store_settings (key, value) VALUES
  ('homepage_philosophy', true),
  ('homepage_about', true),
  ('homepage_bestsellers', false),
  ('homepage_reviews', false)
ON CONFLICT (key) DO NOTHING;
