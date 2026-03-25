CREATE TABLE public.ai_read_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type text NOT NULL DEFAULT 'scan',
  target_type text NOT NULL,
  target_ids text[] DEFAULT '{}',
  affected_components text[] DEFAULT '{}',
  result text NOT NULL DEFAULT 'no_issues',
  summary text,
  metadata jsonb DEFAULT '{}',
  triggered_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_read_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read ai_read_log" ON public.ai_read_log
  FOR SELECT TO authenticated USING (is_staff(auth.uid()));

CREATE POLICY "Service can insert ai_read_log" ON public.ai_read_log
  FOR INSERT TO authenticated WITH CHECK (is_staff(auth.uid()));

CREATE INDEX idx_ai_read_log_created ON public.ai_read_log(created_at DESC);
CREATE INDEX idx_ai_read_log_target ON public.ai_read_log(target_type);