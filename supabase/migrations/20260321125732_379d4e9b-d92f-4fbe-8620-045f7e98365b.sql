
-- Add stock intelligence fields to products
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS low_stock_threshold integer NOT NULL DEFAULT 5,
ADD COLUMN IF NOT EXISTS restock_amount integer NOT NULL DEFAULT 50;

-- Add sales velocity tracking
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS units_sold_7d integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS units_sold_30d integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_sold_at timestamp with time zone;

-- Create automation rules table
CREATE TABLE IF NOT EXISTS public.automation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_key text NOT NULL UNIQUE,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  config jsonb NOT NULL DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage automation rules"
ON public.automation_rules FOR ALL
TO authenticated
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Anyone can read active automation rules"
ON public.automation_rules FOR SELECT
TO anon, authenticated
USING (is_active = true);

-- Seed default automation rules
INSERT INTO public.automation_rules (rule_key, description, config) VALUES
('low_stock_urgency', 'Show urgency badge when stock is low', '{"enabled": true, "threshold_field": "low_stock_threshold"}'),
('trending_boost', 'Show trending badge for fast-selling products', '{"enabled": true, "min_sales_7d": 5}'),
('cart_upsell', 'Suggest add-ons for low cart value', '{"enabled": true, "min_cart_value": 199, "max_suggestions": 3}'),
('restock_alert', 'Alert admin when stock hits threshold', '{"enabled": true}'),
('auto_bundle_suggest', 'Auto-suggest bundles from same category', '{"enabled": true, "discount_percent": 8}')
ON CONFLICT (rule_key) DO NOTHING;
