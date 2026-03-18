
-- Drop the recursive policy on profiles
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

-- Recreate using the security definer function
CREATE POLICY "Staff can view all profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (public.is_staff(auth.uid()));
