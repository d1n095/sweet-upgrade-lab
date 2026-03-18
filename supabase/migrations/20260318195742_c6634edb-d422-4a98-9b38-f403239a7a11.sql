
-- Add unique constraint on username in profiles (for uniqueness validation)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_unique ON public.profiles (username) WHERE username IS NOT NULL;
