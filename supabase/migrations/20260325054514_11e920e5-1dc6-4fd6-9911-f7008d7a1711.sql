
CREATE TABLE public.ai_scan_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_type text NOT NULL DEFAULT 'system_scan',
  results jsonb NOT NULL DEFAULT '{}'::jsonb,
  overall_score integer,
  overall_status text,
  executive_summary text,
  issues_count integer DEFAULT 0,
  tasks_created integer DEFAULT 0,
  scanned_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_scan_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage scan results"
  ON public.ai_scan_results FOR ALL
  TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Staff can view scan results"
  ON public.ai_scan_results FOR SELECT
  TO authenticated
  USING (is_staff(auth.uid()));
