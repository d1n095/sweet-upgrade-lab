
-- Hierarchical categories table
CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  slug text NOT NULL UNIQUE,
  icon text DEFAULT 'Tag',
  display_order integer NOT NULL DEFAULT 0,
  is_visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  name_sv text NOT NULL,
  name_en text
);

-- Many-to-many: products <-> categories
CREATE TABLE public.product_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(product_id, category_id)
);

-- Indexes
CREATE INDEX idx_categories_parent ON public.categories(parent_id);
CREATE INDEX idx_categories_slug ON public.categories(slug);
CREATE INDEX idx_product_categories_product ON public.product_categories(product_id);
CREATE INDEX idx_product_categories_category ON public.product_categories(category_id);

-- RLS
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;

-- Categories: public read, admin write
CREATE POLICY "Anyone can view visible categories"
  ON public.categories FOR SELECT
  USING (is_visible = true);

CREATE POLICY "Admins can view all categories"
  ON public.categories FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can manage categories"
  ON public.categories FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Product categories: public read, admin write
CREATE POLICY "Anyone can view product categories"
  ON public.product_categories FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage product categories"
  ON public.product_categories FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Timestamp trigger
CREATE TRIGGER update_categories_updated_at
  BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed initial categories from existing hardcoded data
INSERT INTO public.categories (name_sv, name_en, slug, icon, display_order) VALUES
  ('Elektronik', 'Electronics', 'elektronik', 'Cpu', 1),
  ('Mode', 'Fashion', 'mode', 'Shirt', 2),
  ('Kroppsvård', 'Body Care', 'kroppsvard', 'Droplets', 3),
  ('Ljus', 'Candles', 'ljus', 'Sparkles', 4),
  ('Smycken & Silver', 'Jewelry & Silver', 'smycken', 'Gem', 5),
  ('Bastudofter', 'Sauna Scents', 'bastudofter', 'Flame', 6),
  ('Hemtextil', 'Home Textiles', 'hemtextil', 'Bed', 7),
  ('CBD', 'CBD', 'cbd', 'Leaf', 8);

-- Add sub-categories for Bastu
INSERT INTO public.categories (name_sv, name_en, slug, icon, display_order, parent_id)
  SELECT 'Bastutillbehör', 'Sauna Accessories', 'bastutillbehor', 'Flame', 9, id
  FROM public.categories WHERE slug = 'bastudofter';
