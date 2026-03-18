
-- Add payment_method, shipping_method, refund columns to orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_method text DEFAULT NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipping_method text DEFAULT NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS refund_status text DEFAULT NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS refund_amount numeric DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS refunded_at timestamp with time zone DEFAULT NULL;
