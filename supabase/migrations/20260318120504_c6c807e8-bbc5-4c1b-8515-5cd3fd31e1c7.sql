
-- Recipe ingredient library
CREATE TABLE public.recipe_ingredients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_sv text NOT NULL,
  name_en text,
  category text NOT NULL DEFAULT 'övrigt',
  description_sv text,
  description_en text,
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.recipe_ingredients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage recipe ingredients"
  ON public.recipe_ingredients FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can view active recipe ingredients"
  ON public.recipe_ingredients FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- Seed some common categories and ingredients
INSERT INTO public.recipe_ingredients (name_sv, name_en, category, display_order) VALUES
  ('Eterisk olja - Lavendel', 'Essential Oil - Lavender', 'Eteriska oljor', 1),
  ('Eterisk olja - Pepparmynta', 'Essential Oil - Peppermint', 'Eteriska oljor', 2),
  ('Eterisk olja - Tea Tree', 'Essential Oil - Tea Tree', 'Eteriska oljor', 3),
  ('Eterisk olja - Eukalyptus', 'Essential Oil - Eucalyptus', 'Eteriska oljor', 4),
  ('Eterisk olja - Citron', 'Essential Oil - Lemon', 'Eteriska oljor', 5),
  ('Eterisk olja - Rosmarin', 'Essential Oil - Rosemary', 'Eteriska oljor', 6),
  ('Kokosolja', 'Coconut Oil', 'Basoljor & Smör', 1),
  ('Sheasmör', 'Shea Butter', 'Basoljor & Smör', 2),
  ('Jojobaolja', 'Jojoba Oil', 'Basoljor & Smör', 3),
  ('Mandelolja', 'Almond Oil', 'Basoljor & Smör', 4),
  ('Olivolja', 'Olive Oil', 'Basoljor & Smör', 5),
  ('Bivax', 'Beeswax', 'Basoljor & Smör', 6),
  ('Kakaosmör', 'Cocoa Butter', 'Basoljor & Smör', 7),
  ('Alkohol (Etanol)', 'Alcohol (Ethanol)', 'Lösningsmedel', 1),
  ('Vegetabilisk glycerin', 'Vegetable Glycerin', 'Lösningsmedel', 2),
  ('Häxhassel (Witch Hazel)', 'Witch Hazel', 'Lösningsmedel', 3),
  ('Aloe Vera Gel', 'Aloe Vera Gel', 'Naturliga baser', 1),
  ('Destillerat vatten', 'Distilled Water', 'Naturliga baser', 2),
  ('Bakpulver (Bikarbonat)', 'Baking Soda', 'Naturliga baser', 3),
  ('Majsstärkelse', 'Cornstarch', 'Naturliga baser', 4),
  ('Vitamin E-olja', 'Vitamin E Oil', 'Tillsatser & Konserveringsmedel', 1),
  ('Citrusfröextrakt', 'Grapefruit Seed Extract', 'Tillsatser & Konserveringsmedel', 2),
  ('E-vitamin (Tokoferol)', 'Tocopherol', 'Tillsatser & Konserveringsmedel', 3);
