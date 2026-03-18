-- Add storytelling fields to products table
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS feeling_sv text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS feeling_en text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS effects_sv text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS effects_en text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS usage_sv text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS usage_en text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS extended_description_sv text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS extended_description_en text;

-- Add homepage block entries to page_sections
INSERT INTO public.page_sections (page, section_key, title_sv, title_en, content_sv, content_en, icon, is_visible, display_order) VALUES
  ('home', 'bestsellers', 'Populära just nu', 'Popular right now', NULL, NULL, 'TrendingUp', false, 10),
  ('home', 'reviews', 'Vad våra kunder säger', 'What our customers say', NULL, NULL, 'Star', false, 11),
  ('home', 'contact', 'Kontakta oss', 'Contact us', 'Har du frågor? Vi finns här.', 'Have questions? We are here.', 'Phone', false, 12),
  ('home', 'sustainability', 'Hållbarhet', 'Sustainability', 'Vi tror på en hållbar framtid.', 'We believe in a sustainable future.', 'Leaf', false, 13),
  ('home', 'new_products', 'Nya produkter', 'New products', NULL, NULL, 'Package', false, 14),
  ('home', 'values', 'Våra värderingar', 'Our values', 'Transparens, kvalitet och ärlighet.', 'Transparency, quality and honesty.', 'Heart', false, 15),
  ('home', 'timeline', 'Vår resa', 'Our journey', NULL, NULL, 'Clock', false, 16)
ON CONFLICT DO NOTHING;