
-- Drop the recursive policy on user_roles
DROP POLICY IF EXISTS "Admins can view all user_roles" ON public.user_roles;

-- Recreate using a security definer function to avoid recursion
CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin', 'founder', 'it', 'moderator', 'support', 'manager', 'marketing', 'finance', 'warehouse')
  )
$$;

-- Recreate policy using the security definer function
CREATE POLICY "Staff can view all user_roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (public.is_staff(auth.uid()));
