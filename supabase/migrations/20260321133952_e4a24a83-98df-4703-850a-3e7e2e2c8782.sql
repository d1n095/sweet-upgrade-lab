
-- Phone normalization function
CREATE OR REPLACE FUNCTION public.normalize_phone(p_phone text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $$
DECLARE
  cleaned text;
BEGIN
  IF p_phone IS NULL OR TRIM(p_phone) = '' THEN
    RETURN NULL;
  END IF;
  -- Remove all non-digit characters
  cleaned := regexp_replace(TRIM(p_phone), '\D', '', 'g');
  -- Convert leading 0 to 46 (Swedish)
  IF LEFT(cleaned, 1) = '0' THEN
    cleaned := '46' || SUBSTRING(cleaned FROM 2);
  END IF;
  -- Remove leading 00 (international prefix)
  IF LEFT(cleaned, 2) = '00' THEN
    cleaned := SUBSTRING(cleaned FROM 3);
  END IF;
  RETURN '+' || cleaned;
END;
$$;

-- Auto-normalize phone on profile insert/update
CREATE OR REPLACE FUNCTION public.normalize_profile_phone()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.phone IS NOT NULL AND TRIM(NEW.phone) != '' THEN
    NEW.phone := normalize_phone(NEW.phone);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_normalize_profile_phone
BEFORE INSERT OR UPDATE OF phone ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.normalize_profile_phone();

-- Add unique index on normalized phone (only for non-null phones)
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_unique_phone
ON public.profiles (phone)
WHERE phone IS NOT NULL AND phone != '';
