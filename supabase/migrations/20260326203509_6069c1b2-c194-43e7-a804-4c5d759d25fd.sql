ALTER TABLE public.scan_runs ADD COLUMN IF NOT EXISTS system_stage text DEFAULT 'development';
ALTER TABLE public.scan_runs ADD COLUMN IF NOT EXISTS scan_mode text DEFAULT 'full';
ALTER TABLE public.scan_runs ADD COLUMN IF NOT EXISTS target_area text;
ALTER TABLE public.scan_runs ADD COLUMN IF NOT EXISTS verification_for text;