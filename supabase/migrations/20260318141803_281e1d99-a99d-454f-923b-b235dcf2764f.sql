
ALTER TABLE public.volume_discounts
  ADD COLUMN IF NOT EXISTS excluded_product_ids text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS stackable boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS label text;
