
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS ingredients_sv text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS ingredients_en text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS certifications text[] DEFAULT NULL;
