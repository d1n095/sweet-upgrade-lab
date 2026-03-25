
ALTER TABLE public.scan_runs
  ADD COLUMN IF NOT EXISTS iteration integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS max_iterations integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS iteration_results jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS pattern_discoveries jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS high_risk_areas jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS coverage_score integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_new_issues integer DEFAULT 0;
