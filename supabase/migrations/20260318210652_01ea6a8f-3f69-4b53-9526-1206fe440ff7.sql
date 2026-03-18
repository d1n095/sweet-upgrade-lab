-- Drop old restrictive SELECT policies
DROP POLICY IF EXISTS "Admins can view all activity logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Admins can view all logs" ON public.activity_logs;

-- Create new policy using is_admin() which covers admin, founder, it
CREATE POLICY "Admins can view activity logs"
ON public.activity_logs
FOR SELECT
TO authenticated
USING (is_admin(auth.uid()));
