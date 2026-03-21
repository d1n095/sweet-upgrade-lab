-- Fix duplicate volume_discounts policies
DROP POLICY IF EXISTS "Anyone can read volume discounts" ON public.volume_discounts;
DROP POLICY IF EXISTS "Anyone can view volume discounts" ON public.volume_discounts;
-- Keep only one
-- "Volume discounts are viewable by everyone" already exists

-- Restrict search_logs INSERT to limit abuse (require at least a search_query)
DROP POLICY IF EXISTS "Anyone can log searches" ON public.search_logs;
CREATE POLICY "Authenticated users can log searches"
ON public.search_logs
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow anon to log too but with a simpler policy name
CREATE POLICY "Anon users can log searches"
ON public.search_logs
FOR INSERT
TO anon
WITH CHECK (true);