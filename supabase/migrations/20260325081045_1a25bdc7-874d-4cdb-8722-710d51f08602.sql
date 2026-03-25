ALTER TABLE public.product_tags ADD COLUMN IF NOT EXISTS tag_type text NOT NULL DEFAULT 'use_case';
ALTER TABLE public.product_tags ADD COLUMN IF NOT EXISTS is_searchable boolean NOT NULL DEFAULT true;
ALTER TABLE public.product_tags ADD COLUMN IF NOT EXISTS name_en text;

COMMENT ON COLUMN public.product_tags.tag_type IS 'Type: use_case, effect, feeling, scent, body_part';
