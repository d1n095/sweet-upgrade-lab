-- Add flexible payout fields to affiliates table
ALTER TABLE public.affiliates 
ADD COLUMN IF NOT EXISTS min_payout_amount NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS auto_payout BOOLEAN DEFAULT false;

-- Create payout requests table
CREATE TABLE IF NOT EXISTS public.affiliate_payout_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  affiliate_id UUID NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  payout_type TEXT NOT NULL DEFAULT 'cash' CHECK (payout_type IN ('cash', 'store_credit')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'rejected')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  processed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.affiliate_payout_requests ENABLE ROW LEVEL SECURITY;

-- Allow affiliates to view their own payout requests
CREATE POLICY "Affiliates can view own payout requests"
  ON public.affiliate_payout_requests
  FOR SELECT
  USING (
    affiliate_id IN (
      SELECT id FROM public.affiliates 
      WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

-- Allow affiliates to create payout requests
CREATE POLICY "Affiliates can create payout requests"
  ON public.affiliate_payout_requests
  FOR INSERT
  WITH CHECK (
    affiliate_id IN (
      SELECT id FROM public.affiliates 
      WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

-- Allow admins to manage all payout requests
CREATE POLICY "Admins can manage all payout requests"
  ON public.affiliate_payout_requests
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );