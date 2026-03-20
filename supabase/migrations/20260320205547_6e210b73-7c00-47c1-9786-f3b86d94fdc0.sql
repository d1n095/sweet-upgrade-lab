
-- Add fulfillment_status to orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS fulfillment_status text NOT NULL DEFAULT 'unfulfilled';

-- Add packing/shipping tracking
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS packed_by uuid;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS packed_at timestamp with time zone;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipped_by uuid;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipped_at timestamp with time zone;

-- Index for fast fulfillment queries
CREATE INDEX IF NOT EXISTS idx_orders_fulfillment ON public.orders (fulfillment_status, payment_status);
