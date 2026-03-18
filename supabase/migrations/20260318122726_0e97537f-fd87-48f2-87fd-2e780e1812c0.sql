
-- Enable RLS on activity_logs (may already be enabled, safe to run)
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Allow admins to read all logs
CREATE POLICY "Admins can view all activity logs"
  ON public.activity_logs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Allow authenticated users to insert logs
CREATE POLICY "Authenticated users can insert activity logs"
  ON public.activity_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow anon to insert logs (for pre-auth events like failed logins)
CREATE POLICY "Anon can insert activity logs"
  ON public.activity_logs FOR INSERT
  TO anon
  WITH CHECK (true);
