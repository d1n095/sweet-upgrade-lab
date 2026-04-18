DROP POLICY IF EXISTS "Service role writes health checks" ON public.system_health_checks;
CREATE POLICY "Service role writes health checks"
  ON public.system_health_checks FOR INSERT
  TO service_role
  WITH CHECK (true);