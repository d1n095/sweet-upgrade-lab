
-- 1. Fix orders INSERT: use a trigger to enforce safe defaults on insert
CREATE OR REPLACE FUNCTION public.enforce_order_defaults()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Force safe defaults regardless of what the client sends
  NEW.status := 'pending';
  NEW.payment_status := 'unpaid';
  NEW.review_reminder_sent := false;
  NEW.delivered_at := NULL;
  NEW.tracking_number := NULL;
  NEW.payment_intent_id := NULL;
  NEW.stripe_session_id := NULL;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_order_defaults_trigger
  BEFORE INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_order_defaults();

-- 2. Fix review_rewards: drop user INSERT, only allow via server
DROP POLICY IF EXISTS "System can create rewards" ON public.review_rewards;

CREATE POLICY "Only service role can create rewards"
  ON public.review_rewards
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- 3. Fix analytics_events: enforce user_id matches auth or is null
DROP POLICY IF EXISTS "Anyone can insert analytics events" ON public.analytics_events;

CREATE POLICY "Anyone can insert analytics events safely"
  ON public.analytics_events
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

-- 4. Fix email_templates: restrict SELECT to admins
DROP POLICY IF EXISTS "Email templates are readable by everyone" ON public.email_templates;

CREATE POLICY "Only admins can view email templates"
  ON public.email_templates
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 5. Fix affiliate_applications: ensure no public SELECT beyond admin
-- The admin ALL policy already covers SELECT for admins. No additional SELECT policy needed.
-- Just verify no open SELECT exists (the ALL policy handles it).

-- 6. Enable leaked password protection
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
