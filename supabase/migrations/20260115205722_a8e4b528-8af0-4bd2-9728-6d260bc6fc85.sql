-- Drop the overly permissive INSERT policy for reviews
DROP POLICY IF EXISTS "Authenticated users can create reviews" ON public.reviews;

-- Create stricter INSERT policy - must be authenticated and user_id must match
CREATE POLICY "Authenticated users can create their own reviews"
ON public.reviews
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Add INSERT policy for review_rewards (currently missing)
CREATE POLICY "System can create rewards"
ON public.review_rewards
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);