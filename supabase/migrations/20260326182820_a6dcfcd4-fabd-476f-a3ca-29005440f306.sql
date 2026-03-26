ALTER TABLE public.scan_snapshots ADD COLUMN IF NOT EXISTS coverage_total integer DEFAULT 0;
ALTER TABLE public.scan_snapshots ADD COLUMN IF NOT EXISTS coverage_unique_targets integer DEFAULT 0;