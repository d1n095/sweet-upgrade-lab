-- Fix 1: profiles_limited view should respect underlying RLS via security_invoker
DROP VIEW IF EXISTS public.profiles_limited;
CREATE VIEW public.profiles_limited
WITH (security_invoker = on) AS
SELECT id, user_id, username, avatar_url, is_member, member_since, level, xp, trust_score, created_at
FROM public.profiles;

-- Fix 2: restrict user_roles enumeration to admins only
DROP POLICY IF EXISTS "Staff can view all user_roles" ON public.user_roles;
CREATE POLICY "Admins can view all user_roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));