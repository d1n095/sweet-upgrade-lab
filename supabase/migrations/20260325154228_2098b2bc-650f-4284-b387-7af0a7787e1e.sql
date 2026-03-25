CREATE TABLE public.scan_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'pending',
  started_by uuid,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  current_step int DEFAULT 0,
  total_steps int DEFAULT 10,
  current_step_label text,
  steps_results jsonb DEFAULT '{}',
  unified_result jsonb,
  error_message text,
  work_items_created int DEFAULT 0,
  system_health_score int,
  executive_summary text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.scan_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read scan_runs" ON public.scan_runs
  FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff can insert scan_runs" ON public.scan_runs
  FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));

CREATE INDEX idx_scan_runs_status ON public.scan_runs(status);
CREATE INDEX idx_scan_runs_created ON public.scan_runs(created_at DESC);