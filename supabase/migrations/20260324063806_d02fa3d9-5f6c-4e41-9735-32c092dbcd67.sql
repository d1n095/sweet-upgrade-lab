
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS dosage_sv text,
ADD COLUMN IF NOT EXISTS dosage_en text,
ADD COLUMN IF NOT EXISTS variants_sv text,
ADD COLUMN IF NOT EXISTS variants_en text,
ADD COLUMN IF NOT EXISTS storage_sv text,
ADD COLUMN IF NOT EXISTS storage_en text,
ADD COLUMN IF NOT EXISTS safety_sv text,
ADD COLUMN IF NOT EXISTS safety_en text,
ADD COLUMN IF NOT EXISTS hook_sv text,
ADD COLUMN IF NOT EXISTS hook_en text,
ADD COLUMN IF NOT EXISTS specifications jsonb DEFAULT '{}',
ADD COLUMN IF NOT EXISTS is_concentrate boolean NOT NULL DEFAULT false;
