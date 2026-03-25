
CREATE TABLE public.root_cause_memory (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bug_report_id UUID REFERENCES public.bug_reports(id) ON DELETE SET NULL,
  work_item_id TEXT,
  change_log_id UUID REFERENCES public.change_log(id) ON DELETE SET NULL,
  root_cause TEXT NOT NULL,
  affected_system TEXT NOT NULL,
  fix_applied TEXT NOT NULL,
  pattern_key TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium',
  recurrence_count INTEGER NOT NULL DEFAULT 1,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_root_cause_pattern ON public.root_cause_memory(pattern_key);
CREATE INDEX idx_root_cause_system ON public.root_cause_memory(affected_system);

ALTER TABLE public.root_cause_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view root causes"
  ON public.root_cause_memory FOR SELECT
  TO authenticated
  USING (is_staff(auth.uid()));

CREATE POLICY "Admins can manage root causes"
  ON public.root_cause_memory FOR ALL
  TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));
