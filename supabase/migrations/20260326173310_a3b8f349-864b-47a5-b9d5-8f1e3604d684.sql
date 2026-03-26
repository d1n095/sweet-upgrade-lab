ALTER TABLE public.work_items ADD COLUMN IF NOT EXISTS source_path text;
ALTER TABLE public.work_items ADD COLUMN IF NOT EXISTS source_file text;
ALTER TABLE public.work_items ADD COLUMN IF NOT EXISTS source_component text;