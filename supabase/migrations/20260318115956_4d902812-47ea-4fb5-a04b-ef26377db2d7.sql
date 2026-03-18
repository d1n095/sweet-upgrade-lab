
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'SEK',
  ADD COLUMN IF NOT EXISTS recipe_sv text,
  ADD COLUMN IF NOT EXISTS recipe_en text;
