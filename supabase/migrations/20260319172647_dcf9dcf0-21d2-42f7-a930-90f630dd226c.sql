CREATE OR REPLACE FUNCTION public.enforce_order_defaults()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Allow trusted backend writes (service role) to persist explicit payment/order fields
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- For client-originated inserts, enforce safe defaults
  NEW.status := COALESCE(NEW.status, 'pending');
  NEW.payment_status := COALESCE(NEW.payment_status, 'unpaid');
  NEW.review_reminder_sent := COALESCE(NEW.review_reminder_sent, false);

  IF NEW.delivered_at IS NULL THEN
    NEW.delivered_at := NULL;
  END IF;

  IF NEW.tracking_number IS NULL THEN
    NEW.tracking_number := NULL;
  END IF;

  IF NEW.payment_intent_id IS NULL THEN
    NEW.payment_intent_id := NULL;
  END IF;

  IF NEW.stripe_session_id IS NULL THEN
    NEW.stripe_session_id := NULL;
  END IF;

  RETURN NEW;
END;
$function$;