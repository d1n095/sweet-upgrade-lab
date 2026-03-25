
CREATE TABLE public.system_observability_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  event_type text NOT NULL DEFAULT 'action',
  severity text NOT NULL DEFAULT 'info',
  source text NOT NULL DEFAULT 'client',
  message text NOT NULL,
  details jsonb DEFAULT '{}',
  scan_id text,
  bug_id text,
  work_item_id text,
  trace_id text,
  component text,
  endpoint text,
  duration_ms integer,
  user_id uuid,
  error_code text,
  stack_trace text
);

CREATE INDEX idx_observability_created_at ON public.system_observability_log (created_at DESC);
CREATE INDEX idx_observability_event_type ON public.system_observability_log (event_type);
CREATE INDEX idx_observability_severity ON public.system_observability_log (severity);
CREATE INDEX idx_observability_trace_id ON public.system_observability_log (trace_id) WHERE trace_id IS NOT NULL;
CREATE INDEX idx_observability_scan_id ON public.system_observability_log (scan_id) WHERE scan_id IS NOT NULL;
CREATE INDEX idx_observability_bug_id ON public.system_observability_log (bug_id) WHERE bug_id IS NOT NULL;
CREATE INDEX idx_observability_work_item_id ON public.system_observability_log (work_item_id) WHERE work_item_id IS NOT NULL;

ALTER TABLE public.system_observability_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read observability logs"
  ON public.system_observability_log FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "Authenticated can insert observability logs"
  ON public.system_observability_log FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.cleanup_old_observability_logs()
  RETURNS integer
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM public.system_observability_log
  WHERE created_at < now() - INTERVAL '30 days';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;
