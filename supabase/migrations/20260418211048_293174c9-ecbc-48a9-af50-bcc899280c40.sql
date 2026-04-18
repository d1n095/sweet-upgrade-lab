-- Guard 1: Block invalid product prices (< 0 or > 100000) and log security_event
CREATE OR REPLACE FUNCTION public.guard_product_price_range()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.price IS NULL OR NEW.price < 0 OR NEW.price > 100000 THEN
    BEGIN
      INSERT INTO public.security_events (type, severity, message, endpoint)
      VALUES (
        'data',
        'critical',
        'Blocked invalid product price: ' || COALESCE(NEW.price::text, 'NULL') || ' (product: ' || COALESCE(NEW.title_sv, 'unknown') || ')',
        'db_trigger:guard_product_price_range'
      );
    EXCEPTION WHEN OTHERS THEN
      -- never fail on logging
      NULL;
    END;
    RAISE EXCEPTION 'Invalid price anomaly: price must be between 0 and 100000 (got %)', NEW.price;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_product_price_range_trigger ON public.products;
CREATE TRIGGER guard_product_price_range_trigger
BEFORE INSERT OR UPDATE OF price ON public.products
FOR EACH ROW EXECUTE FUNCTION public.guard_product_price_range();

-- Guard 2: Block profile inserts without user_id and log security_event
CREATE OR REPLACE FUNCTION public.guard_profile_user_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    BEGIN
      INSERT INTO public.security_events (type, severity, message, endpoint)
      VALUES (
        'data',
        'critical',
        'Blocked user profile creation without id',
        'db_trigger:guard_profile_user_id'
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
    RAISE EXCEPTION 'User created without id: user_id is required';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_profile_user_id_trigger ON public.profiles;
CREATE TRIGGER guard_profile_user_id_trigger
BEFORE INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.guard_profile_user_id();