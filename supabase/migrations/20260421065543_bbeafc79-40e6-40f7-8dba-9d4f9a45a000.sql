-- ============================================================================
-- 1. STOCK_HISTORY — append-only audit log mirroring price_history
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.stock_history (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  old_stock     integer,
  new_stock     integer,
  old_reserved  integer,
  new_reserved  integer,
  delta_stock   integer GENERATED ALWAYS AS (COALESCE(new_stock,0) - COALESCE(old_stock,0)) STORED,
  change_reason text,
  source        text NOT NULL DEFAULT 'manual',
  changed_by    uuid,
  changed_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_history_product
  ON public.stock_history (product_id, changed_at DESC);

ALTER TABLE public.stock_history ENABLE ROW LEVEL SECURITY;

-- Public read (matches price_history pattern)
DROP POLICY IF EXISTS "stock_history readable by everyone" ON public.stock_history;
CREATE POLICY "stock_history readable by everyone"
  ON public.stock_history FOR SELECT USING (true);

-- Admin-only insert
DROP POLICY IF EXISTS "stock_history insert by admins" ON public.stock_history;
CREATE POLICY "stock_history insert by admins"
  ON public.stock_history FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

-- Admin-only delete (no UPDATE policy → immutable audit log)
DROP POLICY IF EXISTS "stock_history delete by admins" ON public.stock_history;
CREATE POLICY "stock_history delete by admins"
  ON public.stock_history FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

-- ============================================================================
-- 2. TRIGGER FUNCTION — log stock or reserved_stock changes automatically
--    Mirrors log_product_price_change() exactly.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.log_product_stock_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF (OLD.stock IS DISTINCT FROM NEW.stock)
     OR (OLD.reserved_stock IS DISTINCT FROM NEW.reserved_stock) THEN
    INSERT INTO public.stock_history (
      product_id, old_stock, new_stock, old_reserved, new_reserved,
      change_reason, source, changed_by
    ) VALUES (
      NEW.id, OLD.stock, NEW.stock, OLD.reserved_stock, NEW.reserved_stock,
      NULL,
      CASE WHEN auth.role() = 'service_role' THEN 'system' ELSE 'manual' END,
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_log_product_stock_change ON public.products;
CREATE TRIGGER trg_log_product_stock_change
  AFTER UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.log_product_stock_change();

-- ============================================================================
-- 3. ENUM EXTENSION — add cart_abandonment to ecommerce_event_type
-- ============================================================================
ALTER TYPE public.ecommerce_event_type ADD VALUE IF NOT EXISTS 'cart_abandonment';