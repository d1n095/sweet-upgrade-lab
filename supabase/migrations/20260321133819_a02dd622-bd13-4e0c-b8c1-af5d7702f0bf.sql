
-- Fix SECURITY DEFINER views by recreating them with security_invoker = true
DROP VIEW IF EXISTS public.profiles_limited;
DROP VIEW IF EXISTS public.profiles_shipping;

CREATE VIEW public.profiles_limited
WITH (security_invoker = true)
AS
SELECT
  id, user_id, username, avatar_url, is_member, member_since, level, xp, trust_score, created_at
FROM public.profiles;

CREATE VIEW public.profiles_shipping
WITH (security_invoker = true)
AS
SELECT
  user_id, first_name, last_name, address, zip, city, country, phone
FROM public.profiles;

GRANT SELECT ON public.profiles_limited TO authenticated;
GRANT SELECT ON public.profiles_shipping TO authenticated;
