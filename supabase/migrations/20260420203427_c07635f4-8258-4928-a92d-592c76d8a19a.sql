-- 1. Add cost_price to products (for margin protection in priorityResolver)
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS cost_price numeric(10,2);

COMMENT ON COLUMN public.products.cost_price IS 'Purchase cost per unit. Used for margin calculation in priority resolver safety rules.';

-- 2. product_stats: deterministic per-product counters
CREATE TABLE IF NOT EXISTS public.product_stats (
  product_id uuid PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  views bigint NOT NULL DEFAULT 0,
  cart_adds bigint NOT NULL DEFAULT 0,
  cart_removes bigint NOT NULL DEFAULT 0,
  purchases bigint NOT NULL DEFAULT 0,
  units_sold bigint NOT NULL DEFAULT 0,
  revenue numeric(12,2) NOT NULL DEFAULT 0,
  last_viewed_at timestamptz,
  last_purchased_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.product_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "product_stats readable by everyone"
  ON public.product_stats FOR SELECT
  USING (true);

CREATE POLICY "product_stats writable by admins"
  ON public.product_stats FOR ALL
  TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

CREATE TRIGGER trg_product_stats_updated_at
  BEFORE UPDATE ON public.product_stats
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. price_history: append-only price change log
CREATE TABLE IF NOT EXISTS public.price_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  old_price numeric(10,2),
  new_price numeric(10,2),
  old_cost numeric(10,2),
  new_cost numeric(10,2),
  change_reason text,
  source text NOT NULL DEFAULT 'manual',
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_price_history_product ON public.price_history(product_id, changed_at DESC);

ALTER TABLE public.price_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "price_history readable by everyone"
  ON public.price_history FOR SELECT
  USING (true);

CREATE POLICY "price_history writable by admins"
  ON public.price_history FOR ALL
  TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- 4. Trigger function: auto-log price/cost changes
CREATE OR REPLACE FUNCTION public.log_product_price_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (OLD.price IS DISTINCT FROM NEW.price)
     OR (OLD.cost_price IS DISTINCT FROM NEW.cost_price) THEN
    INSERT INTO public.price_history (
      product_id, old_price, new_price, old_cost, new_cost,
      change_reason, source, changed_by
    ) VALUES (
      NEW.id, OLD.price, NEW.price, OLD.cost_price, NEW.cost_price,
      NULL,
      CASE WHEN auth.role() = 'service_role' THEN 'system' ELSE 'manual' END,
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_product_price_change ON public.products;
CREATE TRIGGER trg_log_product_price_change
  AFTER UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.log_product_price_change();

-- 5. Trigger function: auto-init product_stats on product creation
CREATE OR REPLACE FUNCTION public.init_product_stats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.product_stats (product_id) VALUES (NEW.id)
  ON CONFLICT (product_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_init_product_stats ON public.products;
CREATE TRIGGER trg_init_product_stats
  AFTER INSERT ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.init_product_stats();

-- 6. Backfill product_stats for existing products
INSERT INTO public.product_stats (product_id)
SELECT id FROM public.products
ON CONFLICT (product_id) DO NOTHING;