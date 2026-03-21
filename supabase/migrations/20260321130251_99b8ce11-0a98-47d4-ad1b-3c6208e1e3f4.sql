
-- ============================================================
-- SECURITY HARDENING MIGRATION
-- ============================================================

-- 1. FIX USER_ROLES: Only founders can manage, admins can manage non-founder roles
-- Current: Founders can manage all → Keep but add admin INSERT/UPDATE for non-founder
-- Remove ability for regular users to ever modify roles

-- user_roles already has:
--   ALL for founders (good)
--   SELECT for own roles (good)  
--   SELECT for staff (good)
-- This is actually correct. No INSERT/UPDATE for regular users exists. ✅

-- 2. FIX ACTIVITY_LOGS: Remove permissive INSERT policies, use server-side function
DROP POLICY IF EXISTS "Authenticated users can insert activity logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Anyone can insert logs safely" ON public.activity_logs;
DROP POLICY IF EXISTS "Anon can insert activity logs" ON public.activity_logs;

-- Only service_role can insert activity logs now
CREATE POLICY "Only service role can insert activity logs"
ON public.activity_logs FOR INSERT
TO public
WITH CHECK (auth.role() = 'service_role');

-- Create a security definer function for client-side logging
CREATE OR REPLACE FUNCTION public.log_activity(
  p_log_type text,
  p_category text,
  p_message text,
  p_details jsonb DEFAULT NULL,
  p_order_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Validate inputs
  IF length(p_log_type) > 20 OR length(p_category) > 50 OR length(p_message) > 500 THEN
    RAISE EXCEPTION 'Input too long';
  END IF;
  
  INSERT INTO public.activity_logs (log_type, category, message, details, order_id, user_id)
  VALUES (p_log_type, p_category, p_message, p_details, p_order_id, auth.uid());
END;
$$;

-- 3. FIX REVIEWS: Fix broken self-referencing policy
DROP POLICY IF EXISTS "Users can update their own reviews" ON public.reviews;

CREATE POLICY "Users can update their own reviews"
ON public.reviews FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND is_approved = false
  AND NOT (is_verified_purchase IS DISTINCT FROM (
    SELECT r2.is_verified_purchase FROM public.reviews r2 WHERE r2.id = reviews.id
  ))
  AND NOT (is_auto_review IS DISTINCT FROM (
    SELECT r2.is_auto_review FROM public.reviews r2 WHERE r2.id = reviews.id
  ))
);

-- 4. FIX AUTOMATION_RULES: Remove public read access to business logic
DROP POLICY IF EXISTS "Anyone can read active automation rules" ON public.automation_rules;

CREATE POLICY "Staff can read active automation rules"
ON public.automation_rules FOR SELECT
TO authenticated
USING (is_staff(auth.uid()));

-- 5. ADD ADMIN-ONLY SELECT for interest_logs
CREATE POLICY "Admins can view interest logs"
ON public.interest_logs FOR SELECT
TO authenticated
USING (is_admin(auth.uid()));

-- 6. FIX FUNCTION SEARCH PATHS
CREATE OR REPLACE FUNCTION public.read_emails(queue_name text, batch_size integer DEFAULT 10, visibility_timeout integer DEFAULT 30)
RETURNS TABLE(msg_id bigint, read_ct integer, message jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pgmq'
AS $$
BEGIN
  RETURN QUERY
  SELECT r.msg_id, r.read_ct, r.message
  FROM pgmq.read(queue_name, visibility_timeout, batch_size) r;
END;
$$;

CREATE OR REPLACE FUNCTION public.read_email_batch(queue_name text, batch_size integer, vt integer)
RETURNS TABLE(msg_id bigint, read_ct integer, message jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pgmq'
AS $$
BEGIN
  RETURN QUERY SELECT r.msg_id, r.read_ct, r.message FROM pgmq.read(queue_name, vt, batch_size) r;
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN;
END;
$$;

-- 7. FIX product_translation_cache: Replace TRUE with proper check
DROP POLICY IF EXISTS "Service role can manage translation cache" ON public.product_translation_cache;

CREATE POLICY "Service role can manage translation cache"
ON public.product_translation_cache FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Also allow admins
CREATE POLICY "Admins can manage translation cache"
ON public.product_translation_cache FOR ALL
TO authenticated
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));
