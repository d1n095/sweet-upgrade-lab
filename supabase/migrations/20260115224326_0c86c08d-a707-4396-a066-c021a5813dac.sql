-- Create table to track product sales for bestseller logic
CREATE TABLE public.product_sales (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shopify_product_id TEXT NOT NULL UNIQUE,
  product_title TEXT NOT NULL,
  total_quantity_sold INTEGER NOT NULL DEFAULT 0,
  last_sale_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.product_sales ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access (everyone can see bestseller data)
CREATE POLICY "Product sales are publicly readable"
ON public.product_sales
FOR SELECT
USING (true);

-- Create policy for admin insert/update (via edge functions with service role)
CREATE POLICY "Admins can manage product sales"
ON public.product_sales
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = 'admin'
  )
);

-- Create index for faster bestseller queries
CREATE INDEX idx_product_sales_quantity ON public.product_sales(total_quantity_sold DESC);

-- Create trigger for updated_at
CREATE TRIGGER update_product_sales_updated_at
BEFORE UPDATE ON public.product_sales
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();