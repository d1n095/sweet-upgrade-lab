
CREATE OR REPLACE FUNCTION public.admin_search_users(p_query text)
RETURNS TABLE(
  user_id uuid,
  email text,
  username text,
  avatar_url text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Only allow admins
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  SELECT 
    p.user_id,
    u.email::text,
    p.username,
    p.avatar_url
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.user_id
  WHERE 
    p.username ILIKE '%' || p_query || '%'
    OR u.email::text ILIKE '%' || p_query || '%'
    OR u.phone::text ILIKE '%' || p_query || '%'
  LIMIT 10;
END;
$$;
