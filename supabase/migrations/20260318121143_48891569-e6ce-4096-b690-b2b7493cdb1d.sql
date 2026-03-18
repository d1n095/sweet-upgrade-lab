
-- Recipe templates (e.g. "Bastudoft", "Kroppsolja")
CREATE TABLE public.recipe_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_sv text NOT NULL,
  name_en text,
  description_sv text,
  description_en text,
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Recipe template slots (each slot = a category-based choice or fixed ingredient)
CREATE TABLE public.recipe_template_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.recipe_templates(id) ON DELETE CASCADE,
  label_sv text NOT NULL,
  label_en text,
  slot_type text NOT NULL DEFAULT 'choice', -- 'choice' (pick from category) or 'fixed' (always included)
  ingredient_category text, -- references recipe_ingredients.category for 'choice' type
  fixed_ingredient_id uuid REFERENCES public.recipe_ingredients(id) ON DELETE SET NULL, -- for 'fixed' type
  is_required boolean NOT NULL DEFAULT true,
  allow_multiple boolean NOT NULL DEFAULT false,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.recipe_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_template_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage recipe templates" ON public.recipe_templates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can view active recipe templates" ON public.recipe_templates FOR SELECT TO anon, authenticated
  USING (is_active = true);

CREATE POLICY "Admins can manage recipe template slots" ON public.recipe_template_slots FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can view recipe template slots" ON public.recipe_template_slots FOR SELECT TO anon, authenticated
  USING (true);
