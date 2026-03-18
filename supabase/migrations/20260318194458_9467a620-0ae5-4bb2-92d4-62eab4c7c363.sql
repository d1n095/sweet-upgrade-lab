
DROP FUNCTION IF EXISTS public.admin_search_users(text);

CREATE OR REPLACE FUNCTION public.admin_search_users(p_query text)
 RETURNS TABLE(user_id uuid, email text, username text, avatar_url text, phone text, user_created_at timestamptz)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
      AND role IN ('admin', 'founder', 'it', 'moderator', 'support', 'manager', 'marketing', 'finance', 'warehouse')
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  SELECT 
    p.user_id,
    u.email::text,
    p.username,
    p.avatar_url,
    u.phone::text,
    u.created_at AS user_created_at
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.user_id
  WHERE 
    p_query = '' 
    OR p.username ILIKE '%' || p_query || '%'
    OR u.email::text ILIKE '%' || p_query || '%'
    OR u.phone::text ILIKE '%' || p_query || '%'
  LIMIT 20;
END;
$function$;
