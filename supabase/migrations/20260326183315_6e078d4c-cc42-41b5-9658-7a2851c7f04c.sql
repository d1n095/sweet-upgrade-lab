ALTER TABLE public.work_items ADD COLUMN IF NOT EXISTS verification_status text DEFAULT 'unknown';
ALTER TABLE public.work_items ADD COLUMN IF NOT EXISTS verification_scans_checked integer DEFAULT 0;
ALTER TABLE public.work_items ADD COLUMN IF NOT EXISTS verified_at timestamptz;