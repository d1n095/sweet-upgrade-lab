
-- Fix 1: Restrict profiles UPDATE to only safe fields (username, avatar_url)
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- Find and drop any existing user update policy on profiles
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE tablename = 'profiles' AND schemaname = 'public'
      AND cmd = 'UPDATE' AND policyname NOT ILIKE '%admin%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', pol.policyname);
  END LOOP;
END$$;

CREATE POLICY "Users can update own safe fields"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND is_member IS NOT DISTINCT FROM (SELECT is_member FROM public.profiles WHERE user_id = auth.uid())
    AND level IS NOT DISTINCT FROM (SELECT level FROM public.profiles WHERE user_id = auth.uid())
    AND trust_score IS NOT DISTINCT FROM (SELECT trust_score FROM public.profiles WHERE user_id = auth.uid())
    AND member_since IS NOT DISTINCT FROM (SELECT member_since FROM public.profiles WHERE user_id = auth.uid())
    AND xp IS NOT DISTINCT FROM (SELECT xp FROM public.profiles WHERE user_id = auth.uid())
  );

-- Fix 2: Restrict reviews UPDATE so users can only change comment and rating, not approval/verification
DROP POLICY IF EXISTS "Users can update their own reviews" ON public.reviews;

CREATE POLICY "Users can update their own reviews"
  ON public.reviews FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND is_approved = false
    AND is_verified_purchase IS NOT DISTINCT FROM (SELECT is_verified_purchase FROM public.reviews WHERE id = reviews.id)
    AND is_auto_review IS NOT DISTINCT FROM (SELECT is_auto_review FROM public.reviews WHERE id = reviews.id)
  );

-- Fix 3: Restrict referrals INSERT to enforce safe defaults
DROP POLICY IF EXISTS "Users can create referrals" ON public.referrals;

CREATE POLICY "Users can create referrals"
  ON public.referrals FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = referrer_id
    AND reward_granted = false
    AND status = 'pending'
  );
