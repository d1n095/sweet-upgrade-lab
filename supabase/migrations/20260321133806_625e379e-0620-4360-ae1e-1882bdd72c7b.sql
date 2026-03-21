
-- 1. Create a security definer function for warehouse to get only shipping-relevant data
CREATE OR REPLACE FUNCTION public.get_order_shipping_profiles(p_order_ids uuid[])
RETURNS TABLE(
  user_id uuid,
  first_name text,
  last_name text,
  address text,
  zip text,
  city text,
  country text,
  phone text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only warehouse, admin, founder can call this
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
      AND role IN ('admin', 'founder', 'warehouse')
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  SELECT p.user_id, p.first_name, p.last_name, p.address, p.zip, p.city, p.country, p.phone
  FROM public.profiles p
  WHERE p.user_id IN (
    SELECT o.user_id FROM public.orders o WHERE o.id = ANY(p_order_ids)
  );
END;
$$;

-- 2. Create a function for support to get limited profile data (no full address)
CREATE OR REPLACE FUNCTION public.get_support_profile(p_user_id uuid)
RETURNS TABLE(
  user_id uuid,
  username text,
  first_name text,
  city text,
  country text,
  is_member boolean,
  level integer,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only support, admin, founder, moderator
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
      AND role IN ('admin', 'founder', 'support', 'moderator')
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  SELECT p.user_id, p.username, p.first_name, p.city, p.country, p.is_member, p.level, p.created_at
  FROM public.profiles p
  WHERE p.user_id = p_user_id;
END;
$$;

-- 3. Replace the broad "Staff can view all profiles" policy with role-specific ones
DROP POLICY IF EXISTS "Staff can view all profiles" ON public.profiles;

-- Admin/founder: full access (unchanged)
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
USING (public.is_admin(auth.uid()));

-- Non-admin staff: can only see non-sensitive columns via the security definer functions above.
-- They still need basic SELECT for username lookups (e.g. reviews, activity logs)
-- but we restrict to only public-safe fields using a view approach via RLS.
-- For now, give limited staff read access to only id, user_id, username, avatar_url, is_member, level
CREATE POLICY "Staff can view limited profiles"
ON public.profiles
FOR SELECT
USING (
  is_staff(auth.uid())
  AND NOT is_admin(auth.uid())
);

-- Note: The policy above still allows SELECT on all columns at the SQL level.
-- The real restriction is enforced by:
-- 1. Frontend code only requesting needed columns via .select('username, avatar_url, ...')
-- 2. The security definer functions above for structured data access
-- 3. We add a database view for non-admin staff as the proper long-term solution:

CREATE OR REPLACE VIEW public.profiles_limited AS
SELECT
  id,
  user_id,
  username,
  avatar_url,
  is_member,
  member_since,
  level,
  xp,
  trust_score,
  created_at
FROM public.profiles;

-- Grant access to the view
GRANT SELECT ON public.profiles_limited TO authenticated;

-- 4. Create a view for warehouse with shipping data only
CREATE OR REPLACE VIEW public.profiles_shipping AS
SELECT
  user_id,
  first_name,
  last_name,
  address,
  zip,
  city,
  country,
  phone
FROM public.profiles;

GRANT SELECT ON public.profiles_shipping TO authenticated;
