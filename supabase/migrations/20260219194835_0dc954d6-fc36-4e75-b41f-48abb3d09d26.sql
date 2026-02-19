
-- Create products table (replacing Shopify as product source)
CREATE TABLE public.products (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title_sv text NOT NULL,
  title_en text,
  description_sv text,
  description_en text,
  price numeric NOT NULL DEFAULT 0,
  original_price numeric,
  category text,
  tags text[],
  is_visible boolean NOT NULL DEFAULT true,
  stock integer NOT NULL DEFAULT 0,
  allow_overselling boolean NOT NULL DEFAULT false,
  image_urls text[],
  handle text UNIQUE,
  badge text CHECK (badge IN ('new', 'bestseller', 'sale', NULL)),
  vendor text DEFAULT '4ThePeople',
  display_order integer DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Public can read visible products
CREATE POLICY "Anyone can view visible products"
  ON public.products FOR SELECT
  USING (is_visible = true);

-- Admins can view ALL products (including hidden)
CREATE POLICY "Admins can view all products"
  ON public.products FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Admins can insert
CREATE POLICY "Admins can insert products"
  ON public.products FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Admins can update
CREATE POLICY "Admins can update products"
  ON public.products FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Admins can delete
CREATE POLICY "Admins can delete products"
  ON public.products FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Auto-generate handle from title
CREATE OR REPLACE FUNCTION public.generate_product_handle()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.handle IS NULL OR NEW.handle = '' THEN
    NEW.handle := lower(regexp_replace(NEW.title_sv, '[^a-zA-Z0-9åäöÅÄÖ ]', '', 'g'));
    NEW.handle := lower(regexp_replace(NEW.handle, '[åÅ]', 'a', 'g'));
    NEW.handle := lower(regexp_replace(NEW.handle, '[äÄ]', 'a', 'g'));
    NEW.handle := lower(regexp_replace(NEW.handle, '[öÖ]', 'o', 'g'));
    NEW.handle := lower(regexp_replace(NEW.handle, '\s+', '-', 'g'));
    NEW.handle := NEW.handle || '-' || substring(gen_random_uuid()::text, 1, 8);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER set_product_handle
  BEFORE INSERT ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.generate_product_handle();

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
