
-- Fix search_path on new functions
ALTER FUNCTION public.generate_random_username() SET search_path = 'public';
ALTER FUNCTION public.calculate_level(integer) SET search_path = 'public';
ALTER FUNCTION public.add_user_xp(uuid, integer, text) SET search_path = 'public';
