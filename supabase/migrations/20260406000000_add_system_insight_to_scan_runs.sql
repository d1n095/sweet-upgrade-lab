-- Add system_insight column to scan_runs.
-- The finalize step in run-full-scan stores structured insight data here.
ALTER TABLE public.scan_runs
  ADD COLUMN IF NOT EXISTS system_insight jsonb;
