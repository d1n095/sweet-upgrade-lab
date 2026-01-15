-- Create influencers table for VIP/influencer program
CREATE TABLE public.influencers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  max_products INTEGER NOT NULL DEFAULT 3,
  products_used INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  valid_until DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create influencer product history (tracks what they've received)
CREATE TABLE public.influencer_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  influencer_id UUID NOT NULL REFERENCES public.influencers(id) ON DELETE CASCADE,
  shopify_product_id TEXT NOT NULL,
  shopify_variant_id TEXT,
  product_title TEXT NOT NULL,
  received_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  UNIQUE(influencer_id, shopify_product_id)
);

-- Enable Row Level Security
ALTER TABLE public.influencers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.influencer_products ENABLE ROW LEVEL SECURITY;

-- Admins can manage influencers
CREATE POLICY "Admins can view all influencers"
ON public.influencers
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can create influencers"
ON public.influencers
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update influencers"
ON public.influencers
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete influencers"
ON public.influencers
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Influencers can view their own record
CREATE POLICY "Users can view their own influencer record"
ON public.influencers
FOR SELECT
USING (auth.uid() = user_id);

-- Influencer products policies
CREATE POLICY "Admins can manage influencer products"
ON public.influencer_products
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view their own influencer products"
ON public.influencer_products
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.influencers 
    WHERE id = influencer_id AND user_id = auth.uid()
  )
);

-- Create trigger for updated_at
CREATE TRIGGER update_influencers_updated_at
  BEFORE UPDATE ON public.influencers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to validate influencer code
CREATE OR REPLACE FUNCTION public.validate_influencer_code(
  p_code TEXT,
  p_email TEXT
)
RETURNS TABLE (
  influencer_id UUID,
  influencer_name TEXT,
  products_remaining INTEGER,
  is_valid BOOLEAN,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_influencer RECORD;
BEGIN
  SELECT * INTO v_influencer 
  FROM public.influencers 
  WHERE UPPER(code) = UPPER(p_code);
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT 
      NULL::UUID, 
      NULL::TEXT, 
      0::INTEGER, 
      false, 
      'Ogiltig kod'::TEXT;
    RETURN;
  END IF;
  
  IF NOT v_influencer.is_active THEN
    RETURN QUERY SELECT 
      v_influencer.id, 
      v_influencer.name, 
      0::INTEGER, 
      false, 
      'Koden är inaktiverad'::TEXT;
    RETURN;
  END IF;
  
  IF v_influencer.valid_until IS NOT NULL AND v_influencer.valid_until < CURRENT_DATE THEN
    RETURN QUERY SELECT 
      v_influencer.id, 
      v_influencer.name, 
      0::INTEGER, 
      false, 
      'Koden har gått ut'::TEXT;
    RETURN;
  END IF;
  
  IF LOWER(v_influencer.email) != LOWER(p_email) THEN
    RETURN QUERY SELECT 
      v_influencer.id, 
      v_influencer.name, 
      0::INTEGER, 
      false, 
      'Email matchar inte koden'::TEXT;
    RETURN;
  END IF;
  
  IF v_influencer.products_used >= v_influencer.max_products THEN
    RETURN QUERY SELECT 
      v_influencer.id, 
      v_influencer.name, 
      0::INTEGER, 
      false, 
      'Alla produkter har redan använts'::TEXT;
    RETURN;
  END IF;
  
  RETURN QUERY SELECT 
    v_influencer.id,
    v_influencer.name,
    (v_influencer.max_products - v_influencer.products_used)::INTEGER,
    true,
    'Kod giltig! Du har ' || (v_influencer.max_products - v_influencer.products_used) || ' produkter kvar.'::TEXT;
END;
$$;