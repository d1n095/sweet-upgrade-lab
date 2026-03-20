
-- 1. Add is_sellable to products (active products default true)
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_sellable boolean NOT NULL DEFAULT true;

-- 2. Add benefits/risks to recipe_ingredients
ALTER TABLE public.recipe_ingredients ADD COLUMN IF NOT EXISTS benefits_sv text[] DEFAULT '{}';
ALTER TABLE public.recipe_ingredients ADD COLUMN IF NOT EXISTS benefits_en text[] DEFAULT '{}';
ALTER TABLE public.recipe_ingredients ADD COLUMN IF NOT EXISTS risks_sv text[] DEFAULT '{}';
ALTER TABLE public.recipe_ingredients ADD COLUMN IF NOT EXISTS risks_en text[] DEFAULT '{}';
ALTER TABLE public.recipe_ingredients ADD COLUMN IF NOT EXISTS is_searchable boolean NOT NULL DEFAULT true;
ALTER TABLE public.recipe_ingredients ADD COLUMN IF NOT EXISTS slug text;

-- 3. Create product_ingredients junction table (many-to-many)
CREATE TABLE IF NOT EXISTS public.product_ingredients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  ingredient_id uuid NOT NULL REFERENCES public.recipe_ingredients(id) ON DELETE CASCADE,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(product_id, ingredient_id)
);

ALTER TABLE public.product_ingredients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view product ingredients"
  ON public.product_ingredients FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage product ingredients"
  ON public.product_ingredients FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- 4. Add matched columns to search_logs
ALTER TABLE public.search_logs ADD COLUMN IF NOT EXISTS matched_product_id uuid REFERENCES public.products(id) ON DELETE SET NULL;
ALTER TABLE public.search_logs ADD COLUMN IF NOT EXISTS matched_ingredient_id uuid REFERENCES public.recipe_ingredients(id) ON DELETE SET NULL;
ALTER TABLE public.search_logs ADD COLUMN IF NOT EXISTS user_id uuid;

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_product_ingredients_product ON public.product_ingredients(product_id);
CREATE INDEX IF NOT EXISTS idx_product_ingredients_ingredient ON public.product_ingredients(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_search_logs_term ON public.search_logs(search_term);
CREATE INDEX IF NOT EXISTS idx_search_logs_created ON public.search_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_slug ON public.recipe_ingredients(slug);
