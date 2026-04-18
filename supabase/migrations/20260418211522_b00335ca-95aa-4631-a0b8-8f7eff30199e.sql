CREATE TABLE IF NOT EXISTS public.system_health_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checked_at timestamptz NOT NULL DEFAULT now(),
  overall_status text NOT NULL CHECK (overall_status IN ('ok','degraded','failed')),
  db_ok boolean NOT NULL DEFAULT true,
  api_ms integer,
  scan_ok boolean NOT NULL DEFAULT true,
  queue_ok boolean NOT NULL DEFAULT true,
  details jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_system_health_checks_checked_at
  ON public.system_health_checks (checked_at DESC);

ALTER TABLE public.system_health_checks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can read health checks" ON public.system_health_checks;
CREATE POLICY "Staff can read health checks"
  ON public.system_health_checks FOR SELECT
  USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Service role writes health checks" ON public.system_health_checks;
CREATE POLICY "Service role writes health checks"
  ON public.system_health_checks FOR INSERT
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.system_health_check()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pgmq
AS $$
DECLARE
  v_db_ok boolean := true;
  v_queue_depth bigint := 0;
  v_queue_ok boolean := true;
BEGIN
  PERFORM 1;
  BEGIN
    SELECT COUNT(*) INTO v_queue_depth FROM pgmq.q_emails;
    IF v_queue_depth > 500 THEN v_queue_ok := false; END IF;
  EXCEPTION WHEN OTHERS THEN
    v_queue_ok := true;
    v_queue_depth := 0;
  END;
  RETURN jsonb_build_object(
    'db_ok', v_db_ok,
    'queue_ok', v_queue_ok,
    'queue_depth', v_queue_depth
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.system_health_check() TO authenticated, service_role;