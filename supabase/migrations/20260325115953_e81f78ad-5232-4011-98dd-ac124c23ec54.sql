
CREATE TABLE public.change_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  change_type TEXT NOT NULL DEFAULT 'update',
  description TEXT NOT NULL,
  affected_components TEXT[] DEFAULT '{}',
  source TEXT NOT NULL DEFAULT 'manual',
  work_item_id TEXT,
  bug_report_id UUID,
  scan_id UUID,
  prompt_queue_id UUID,
  metadata JSONB DEFAULT '{}',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.change_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read change_log" ON public.change_log
  FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff can insert change_log" ON public.change_log
  FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));

CREATE INDEX idx_change_log_created_at ON public.change_log (created_at DESC);
CREATE INDEX idx_change_log_source ON public.change_log (source);
CREATE INDEX idx_change_log_work_item ON public.change_log (work_item_id) WHERE work_item_id IS NOT NULL;
CREATE INDEX idx_change_log_bug_report ON public.change_log (bug_report_id) WHERE bug_report_id IS NOT NULL;
