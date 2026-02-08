-- Create product_translations table for multi-language product content
CREATE TABLE public.product_translations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shopify_product_id TEXT NOT NULL,
  language_code TEXT NOT NULL,
  title TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(shopify_product_id, language_code)
);

-- Enable RLS
ALTER TABLE public.product_translations ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Product translations are viewable by everyone"
ON public.product_translations FOR SELECT
USING (true);

CREATE POLICY "Admins can manage product translations"
ON public.product_translations FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create updated_at trigger
CREATE TRIGGER update_product_translations_updated_at
BEFORE UPDATE ON public.product_translations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();