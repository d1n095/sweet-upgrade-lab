
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS reserved_stock integer NOT NULL DEFAULT 0;
