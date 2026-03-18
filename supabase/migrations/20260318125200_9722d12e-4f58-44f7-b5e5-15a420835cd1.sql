ALTER TABLE public.products ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

-- Set existing hidden products to stay active (they just have is_visible=false)
-- No data migration needed, all existing products start as 'active'