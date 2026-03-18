
-- Add order_number column with auto-generated ORD-XXXXX format
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS order_number text UNIQUE;

-- Function to generate order number
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_seq integer;
BEGIN
  -- Get count of existing orders + 1
  SELECT COUNT(*) + 1 INTO v_seq FROM public.orders;
  NEW.order_number := 'ORD-' || LPAD(v_seq::text, 5, '0');
  
  -- Handle uniqueness collision
  WHILE EXISTS (SELECT 1 FROM public.orders WHERE order_number = NEW.order_number) LOOP
    v_seq := v_seq + 1;
    NEW.order_number := 'ORD-' || LPAD(v_seq::text, 5, '0');
  END LOOP;
  
  RETURN NEW;
END;
$$;

-- Create trigger for auto-generating order number
CREATE TRIGGER set_order_number
  BEFORE INSERT ON public.orders
  FOR EACH ROW
  WHEN (NEW.order_number IS NULL)
  EXECUTE FUNCTION public.generate_order_number();
