
-- Tag system for products
CREATE TABLE public.product_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_sv text NOT NULL,
  name_en text,
  slug text NOT NULL UNIQUE,
  color text DEFAULT '#6366f1',
  display_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.product_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view tags" ON public.product_tags FOR SELECT USING (true);
CREATE POLICY "Admins can manage tags" ON public.product_tags FOR ALL TO authenticated
  USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

-- Junction table
CREATE TABLE public.product_tag_relations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.product_tags(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, tag_id)
);

ALTER TABLE public.product_tag_relations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view product tag relations" ON public.product_tag_relations FOR SELECT USING (true);
CREATE POLICY "Admins can manage product tag relations" ON public.product_tag_relations FOR ALL TO authenticated
  USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

-- Seed some starter tags
INSERT INTO public.product_tags (name_sv, slug, color) VALUES
  ('Bastu', 'bastu', '#ef4444'),
  ('Andning', 'andning', '#3b82f6'),
  ('Kyla', 'kyla', '#06b6d4'),
  ('Energi', 'energi', '#f59e0b'),
  ('Avslappning', 'avslappning', '#8b5cf6'),
  ('Hudvård', 'hudvard', '#ec4899'),
  ('Aromaterapi', 'aromaterapi', '#10b981'),
  ('Wellness', 'wellness', '#6366f1');
