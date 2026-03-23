
-- Add delivery_method and delivery_status to orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_method text NOT NULL DEFAULT 'shipping',
  ADD COLUMN IF NOT EXISTS delivery_status text NOT NULL DEFAULT 'pending';

-- Add comment for clarity
COMMENT ON COLUMN public.orders.delivery_method IS 'shipping | pickup | local_delivery';
COMMENT ON COLUMN public.orders.delivery_status IS 'pending | packed | delivered';
