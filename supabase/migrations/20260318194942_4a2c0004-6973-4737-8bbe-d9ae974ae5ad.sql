
-- Allow admins to view ALL profiles
CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
      AND role IN ('admin', 'founder', 'it', 'moderator', 'support', 'manager', 'marketing', 'finance', 'warehouse')
  )
);

-- Allow admins to view ALL user_roles
CREATE POLICY "Admins can view all user_roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('admin', 'founder', 'it', 'moderator', 'support', 'manager', 'marketing', 'finance', 'warehouse')
  )
);

-- Allow founders to manage user_roles (insert/update/delete)
CREATE POLICY "Founders can manage all user_roles"
ON public.user_roles FOR ALL
TO authenticated
USING (is_founder(auth.uid()))
WITH CHECK (is_founder(auth.uid()));
