
ALTER TABLE public.scan_runs 
  ADD COLUMN IF NOT EXISTS progress integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS completed_steps integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS eta_seconds integer,
  ADD COLUMN IF NOT EXISTS step_logs jsonb DEFAULT '[]'::jsonb;

ALTER PUBLICATION supabase_realtime ADD TABLE public.scan_runs;
