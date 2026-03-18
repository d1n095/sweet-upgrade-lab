
-- Add username, avatar_url, xp, level to profiles
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS username text UNIQUE,
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS xp integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS level integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS trust_score integer NOT NULL DEFAULT 0;

-- Function to generate a random username
CREATE OR REPLACE FUNCTION public.generate_random_username()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  prefix text;
  result text;
  prefixes text[] := ARRAY['Member', 'User', 'Green', 'Eco', 'Nature', 'Earth', 'Solar', 'Leaf'];
BEGIN
  prefix := prefixes[1 + floor(random() * array_length(prefixes, 1))::int];
  result := prefix || '-' || substring(gen_random_uuid()::text, 1, 6);
  RETURN result;
END;
$$;

-- Update handle_new_user trigger to auto-generate username
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_username text;
BEGIN
  -- Check if username was provided via metadata
  v_username := NEW.raw_user_meta_data->>'username';
  
  -- If no username provided, generate one
  IF v_username IS NULL OR v_username = '' THEN
    v_username := generate_random_username();
  END IF;
  
  -- Ensure uniqueness
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = v_username) LOOP
    v_username := generate_random_username();
  END LOOP;

  INSERT INTO public.profiles (user_id, is_member, member_since, username)
  VALUES (NEW.id, false, NULL, v_username);
  RETURN NEW;
END;
$$;

-- Calculate level from XP (exponential: level N requires N*100 total XP)
CREATE OR REPLACE FUNCTION public.calculate_level(p_xp integer)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT GREATEST(1, floor((-1 + sqrt(1 + 8.0 * p_xp / 100)) / 2)::integer + 1);
$$;

-- Function to add XP and update level
CREATE OR REPLACE FUNCTION public.add_user_xp(p_user_id uuid, p_xp integer, p_reason text DEFAULT 'other')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_new_xp integer;
BEGIN
  UPDATE public.profiles 
  SET xp = xp + p_xp,
      level = calculate_level(xp + p_xp),
      trust_score = LEAST(100, trust_score + (p_xp / 10)),
      updated_at = now()
  WHERE user_id = p_user_id
  RETURNING xp INTO v_new_xp;
END;
$$;
