
-- Automation action log
CREATE TABLE public.automation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type text NOT NULL,        -- escalate, reassign, reprioritize, alert
  target_type text NOT NULL,         -- task, order, incident
  target_id uuid NOT NULL,
  reason text NOT NULL,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.automation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view automation logs"
  ON public.automation_logs FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "Service role can manage automation logs"
  ON public.automation_logs FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Index for fast lookups
CREATE INDEX idx_automation_logs_target ON public.automation_logs (target_type, target_id);
CREATE INDEX idx_automation_logs_created ON public.automation_logs (created_at DESC);
