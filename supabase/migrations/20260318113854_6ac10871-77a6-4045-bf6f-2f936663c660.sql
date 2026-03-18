
-- Fix activity_logs: scope user_id to auth.uid() or null
DROP POLICY IF EXISTS "Anyone can insert logs" ON public.activity_logs;
CREATE POLICY "Anyone can insert logs safely"
  ON public.activity_logs
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

-- Fix interest_logs: add length limits
DROP POLICY IF EXISTS "Anyone can log interests" ON public.interest_logs;
CREATE POLICY "Anyone can log interests safely"
  ON public.interest_logs
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    LENGTH(interest_type) <= 100 AND
    (email IS NULL OR LENGTH(email) <= 255) AND
    (message IS NULL OR LENGTH(message) <= 2000) AND
    (category IS NULL OR LENGTH(category) <= 100) AND
    (session_id IS NULL OR LENGTH(session_id) <= 200)
  );
