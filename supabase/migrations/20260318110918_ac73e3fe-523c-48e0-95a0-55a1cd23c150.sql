
CREATE TABLE public.timeline_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year text NOT NULL,
  title_sv text NOT NULL,
  title_en text,
  description_sv text,
  description_en text,
  is_visible boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.timeline_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view visible timeline entries"
  ON public.timeline_entries FOR SELECT
  TO public
  USING (is_visible = true);

CREATE POLICY "Admins can manage timeline entries"
  ON public.timeline_entries FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.timeline_entries (year, title_sv, title_en, description_sv, description_en, display_order) VALUES
  ('2024', 'Idén föds', 'The idea is born', 'Ett behov av renare alternativ – utan kompromisser på kvalitet.', 'A need for cleaner alternatives – without compromising quality.', 1),
  ('2025', 'Första produkterna', 'First products', 'Lansering av våra första kategorier: teknik och kroppsvård.', 'Launch of our first categories: tech and body care.', 2),
  ('2026', 'Expansion', 'Expansion', 'Fler kategorier. Fler certifieringar. Samma standard.', 'More categories. More certifications. Same standards.', 3);
