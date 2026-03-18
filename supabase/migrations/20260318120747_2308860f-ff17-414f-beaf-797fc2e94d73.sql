
CREATE TABLE public.shipping_extras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title_sv text NOT NULL,
  title_en text,
  description_sv text,
  description_en text,
  icon text DEFAULT 'gift',
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.shipping_extras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage shipping extras"
  ON public.shipping_extras FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can view active shipping extras"
  ON public.shipping_extras FOR SELECT
  TO anon, authenticated
  USING (is_active = true);
