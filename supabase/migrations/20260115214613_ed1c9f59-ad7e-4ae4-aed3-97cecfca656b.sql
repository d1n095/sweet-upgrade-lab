-- Create affiliates table
CREATE TABLE public.affiliates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  commission_percent NUMERIC NOT NULL DEFAULT 10 CHECK (commission_percent >= 5 AND commission_percent <= 20),
  total_earnings NUMERIC NOT NULL DEFAULT 0,
  pending_earnings NUMERIC NOT NULL DEFAULT 0,
  paid_earnings NUMERIC NOT NULL DEFAULT 0,
  total_orders INTEGER NOT NULL DEFAULT 0,
  total_sales NUMERIC NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  payout_method TEXT DEFAULT 'bank_transfer',
  payout_details JSONB,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create affiliate_orders for tracking affiliate sales
CREATE TABLE public.affiliate_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  affiliate_id UUID NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  shopify_order_id TEXT,
  order_total NUMERIC NOT NULL,
  commission_amount NUMERIC NOT NULL,
  customer_discount NUMERIC NOT NULL DEFAULT 10,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'paid', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  paid_at TIMESTAMP WITH TIME ZONE
);

-- Create affiliate_payouts for tracking payouts
CREATE TABLE public.affiliate_payouts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  affiliate_id UUID NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  payout_method TEXT NOT NULL,
  payout_reference TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_payouts ENABLE ROW LEVEL SECURITY;

-- Affiliates policies
CREATE POLICY "Admins can manage all affiliates"
ON public.affiliates FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view their own affiliate record"
ON public.affiliates FOR SELECT
USING (user_id = auth.uid());

-- Affiliate orders policies
CREATE POLICY "Admins can manage all affiliate orders"
ON public.affiliate_orders FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Affiliates can view their own orders"
ON public.affiliate_orders FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.affiliates
  WHERE affiliates.id = affiliate_orders.affiliate_id
  AND affiliates.user_id = auth.uid()
));

-- Affiliate payouts policies
CREATE POLICY "Admins can manage all payouts"
ON public.affiliate_payouts FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Affiliates can view their own payouts"
ON public.affiliate_payouts FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.affiliates
  WHERE affiliates.id = affiliate_payouts.affiliate_id
  AND affiliates.user_id = auth.uid()
));

-- Function to validate affiliate code and get discount
CREATE OR REPLACE FUNCTION public.validate_affiliate_code(p_code TEXT)
RETURNS TABLE(
  affiliate_id UUID,
  affiliate_name TEXT,
  customer_discount NUMERIC,
  commission_percent NUMERIC,
  is_valid BOOLEAN,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_affiliate RECORD;
BEGIN
  SELECT * INTO v_affiliate
  FROM public.affiliates
  WHERE UPPER(code) = UPPER(p_code);

  IF NOT FOUND THEN
    RETURN QUERY SELECT
      NULL::UUID,
      NULL::TEXT,
      0::NUMERIC,
      0::NUMERIC,
      false,
      'Ogiltig kod'::TEXT;
    RETURN;
  END IF;

  IF NOT v_affiliate.is_active THEN
    RETURN QUERY SELECT
      v_affiliate.id,
      v_affiliate.name,
      0::NUMERIC,
      0::NUMERIC,
      false,
      'Koden är inaktiverad'::TEXT;
    RETURN;
  END IF;

  RETURN QUERY SELECT
    v_affiliate.id,
    v_affiliate.name,
    10::NUMERIC, -- 10% discount for customers
    v_affiliate.commission_percent,
    true,
    'Kod giltig! Du får 10% rabatt.'::TEXT;
END;
$$;

-- Trigger to update updated_at
CREATE TRIGGER update_affiliates_updated_at
BEFORE UPDATE ON public.affiliates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();