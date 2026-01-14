-- Fix handle_new_user function to not grant automatic membership
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, is_member, member_since)
  VALUES (NEW.id, false, NULL);
  RETURN NEW;
END;
$function$;