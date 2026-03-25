
CREATE TABLE public.scan_dismissals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_key text NOT NULL,
  issue_title text NOT NULL,
  reason text NOT NULL DEFAULT '',
  dismissed_by uuid NOT NULL,
  scan_type text NOT NULL DEFAULT 'system_scan',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(issue_key, scan_type)
);

ALTER TABLE public.scan_dismissals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view dismissals" ON public.scan_dismissals
  FOR SELECT TO authenticated USING (is_staff(auth.uid()));

CREATE POLICY "Admins can manage dismissals" ON public.scan_dismissals
  FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
