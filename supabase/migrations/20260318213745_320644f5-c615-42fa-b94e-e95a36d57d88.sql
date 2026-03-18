
-- Add first_name and last_name to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS first_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_name text;

-- Migrate existing full_name data (split on first space)
UPDATE public.profiles 
SET 
  first_name = CASE WHEN full_name IS NOT NULL AND full_name != '' THEN split_part(full_name, ' ', 1) ELSE NULL END,
  last_name = CASE WHEN full_name IS NOT NULL AND full_name != '' AND position(' ' in full_name) > 0 THEN substring(full_name from position(' ' in full_name) + 1) ELSE NULL END
WHERE first_name IS NULL AND full_name IS NOT NULL;
