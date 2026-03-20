-- Enforce webhook-only order creation and idempotency for Stripe callbacks
-- 1) Block client-side order inserts
DROP POLICY IF EXISTS "Users can create their own orders" ON public.orders;

-- 2) Guarantee one order per Stripe session/payment intent
CREATE UNIQUE INDEX IF NOT EXISTS ux_orders_stripe_session_id
  ON public.orders (stripe_session_id)
  WHERE stripe_session_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_orders_payment_intent_id
  ON public.orders (payment_intent_id)
  WHERE payment_intent_id IS NOT NULL;