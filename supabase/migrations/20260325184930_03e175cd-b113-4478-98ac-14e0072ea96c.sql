CREATE TABLE public.access_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  target_user_id uuid,
  action text NOT NULL,
  role_before text[],
  role_after text[],
  permission_changes jsonb,
  detail text,
  actor_email text,
  target_email text,
  source text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.access_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read access audit log"
ON public.access_audit_log
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Service role can insert access audit log"
ON public.access_audit_log
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin(auth.uid()));

CREATE INDEX idx_access_audit_log_created_at ON public.access_audit_log (created_at DESC);
CREATE INDEX idx_access_audit_log_target_user ON public.access_audit_log (target_user_id);
CREATE INDEX idx_access_audit_log_action ON public.access_audit_log (action);