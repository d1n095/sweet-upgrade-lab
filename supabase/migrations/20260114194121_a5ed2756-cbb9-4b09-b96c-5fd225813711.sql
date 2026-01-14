-- Create tables for customer insights (anonymous, GDPR-safe logging)
CREATE TABLE public.search_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  search_term TEXT NOT NULL,
  results_count INTEGER NOT NULL DEFAULT 0,
  session_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.interest_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  interest_type TEXT NOT NULL,
  category TEXT,
  message TEXT,
  email TEXT,
  session_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create bundles table for kit/bundle support
CREATE TABLE public.bundles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  name_en TEXT,
  description TEXT,
  description_en TEXT,
  discount_percent NUMERIC NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT false,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create bundle_items table for products in bundles
CREATE TABLE public.bundle_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bundle_id UUID NOT NULL REFERENCES public.bundles(id) ON DELETE CASCADE,
  shopify_product_id TEXT NOT NULL,
  shopify_variant_id TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.search_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interest_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bundles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bundle_items ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts for search and interest logs (GDPR-safe anonymous logging)
CREATE POLICY "Anyone can log searches"
ON public.search_logs
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Anyone can log interests"
ON public.interest_logs
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Bundles are viewable by everyone (for display)
CREATE POLICY "Bundles are viewable by everyone"
ON public.bundles
FOR SELECT
TO anon, authenticated
USING (true);

-- Bundle items are viewable by everyone (for display)
CREATE POLICY "Bundle items are viewable by everyone"
ON public.bundle_items
FOR SELECT
TO anon, authenticated
USING (true);

-- Create trigger for bundles updated_at
CREATE TRIGGER update_bundles_updated_at
BEFORE UPDATE ON public.bundles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();