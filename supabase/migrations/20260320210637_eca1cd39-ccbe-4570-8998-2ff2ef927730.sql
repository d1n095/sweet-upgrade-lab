
-- Drop the order number generation trigger (Stripe payment_intent replaces it)
DROP TRIGGER IF EXISTS set_order_number ON public.orders;
DROP FUNCTION IF EXISTS generate_order_number();
