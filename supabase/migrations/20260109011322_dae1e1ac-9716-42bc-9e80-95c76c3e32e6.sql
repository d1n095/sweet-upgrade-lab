-- Create profiles table (minimal - just email from auth)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  is_member BOOLEAN NOT NULL DEFAULT false,
  member_since TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create member_prices table for exclusive member pricing
CREATE TABLE public.member_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shopify_product_id TEXT NOT NULL,
  shopify_variant_id TEXT NOT NULL,
  member_price DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(shopify_variant_id)
);

-- Create volume_discounts table
CREATE TABLE public.volume_discounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shopify_product_id TEXT,
  min_quantity INTEGER NOT NULL,
  discount_percent DECIMAL(5,2) NOT NULL,
  is_global BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create bundle_pricing table
CREATE TABLE public.bundle_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  discount_percent DECIMAL(5,2) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create bundle_products table (products in a bundle)
CREATE TABLE public.bundle_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_id UUID REFERENCES public.bundle_pricing(id) ON DELETE CASCADE NOT NULL,
  shopify_product_id TEXT NOT NULL,
  shopify_variant_id TEXT
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.volume_discounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bundle_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bundle_products ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Member prices are public readable (for displaying on product pages)
CREATE POLICY "Member prices are viewable by everyone"
ON public.member_prices FOR SELECT
USING (true);

-- Volume discounts are public readable
CREATE POLICY "Volume discounts are viewable by everyone"
ON public.volume_discounts FOR SELECT
USING (true);

-- Bundle pricing is public readable
CREATE POLICY "Bundle pricing is viewable by everyone"
ON public.bundle_pricing FOR SELECT
USING (true);

-- Bundle products are public readable
CREATE POLICY "Bundle products are viewable by everyone"
ON public.bundle_products FOR SELECT
USING (true);

-- Create trigger for auto-creating profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, is_member, member_since)
  VALUES (NEW.id, true, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create trigger for updating timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_member_prices_updated_at
  BEFORE UPDATE ON public.member_prices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();