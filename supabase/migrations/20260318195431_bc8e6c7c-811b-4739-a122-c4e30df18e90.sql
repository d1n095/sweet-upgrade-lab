
-- Allow founders to update any profile (e.g. change inappropriate usernames)
CREATE POLICY "Founders can update all profiles"
ON public.profiles FOR UPDATE
TO authenticated
USING (public.is_founder(auth.uid()))
WITH CHECK (public.is_founder(auth.uid()));
