
CREATE TABLE public.functional_failure_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type text NOT NULL,
  component text NOT NULL,
  entity_type text NOT NULL,
  failed_step text NOT NULL,
  fail_reason text,
  pattern_key text NOT NULL,
  occurrence_count integer NOT NULL DEFAULT 1,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_scan_retest_at timestamptz,
  last_retest_passed boolean,
  severity text NOT NULL DEFAULT 'medium',
  is_resolved boolean NOT NULL DEFAULT false,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(pattern_key)
);

ALTER TABLE public.functional_failure_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read failure memory" ON public.functional_failure_memory
  FOR SELECT TO authenticated USING (is_staff(auth.uid()));

CREATE POLICY "Staff can insert failure memory" ON public.functional_failure_memory
  FOR INSERT TO authenticated WITH CHECK (is_staff(auth.uid()));

CREATE POLICY "Staff can update failure memory" ON public.functional_failure_memory
  FOR UPDATE TO authenticated USING (is_staff(auth.uid()));

CREATE POLICY "Service role full access" ON public.functional_failure_memory
  FOR ALL TO service_role USING (true) WITH CHECK (true);
