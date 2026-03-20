
-- Create refund requests table
CREATE TABLE public.refund_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL,
  approved_by UUID,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  admin_notes TEXT,
  stripe_refund_id TEXT,
  refund_amount NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  processed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.refund_requests ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins can manage refund requests"
ON public.refund_requests
FOR ALL
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- Staff can view and create
CREATE POLICY "Staff can view refund requests"
ON public.refund_requests
FOR SELECT
USING (is_staff(auth.uid()));

CREATE POLICY "Staff can create refund requests"
ON public.refund_requests
FOR INSERT
WITH CHECK (is_staff(auth.uid()) AND auth.uid() = requested_by AND status = 'pending');

-- Index for quick lookups
CREATE INDEX idx_refund_requests_order_id ON public.refund_requests(order_id);
CREATE INDEX idx_refund_requests_status ON public.refund_requests(status);
