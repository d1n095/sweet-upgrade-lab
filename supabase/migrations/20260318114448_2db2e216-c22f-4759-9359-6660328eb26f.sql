
-- Create page_sections table for CMS-editable page content
CREATE TABLE public.page_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page text NOT NULL,
  section_key text NOT NULL,
  title_sv text DEFAULT '',
  title_en text DEFAULT '',
  content_sv text DEFAULT '',
  content_en text DEFAULT '',
  icon text DEFAULT NULL,
  is_visible boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(page, section_key)
);

ALTER TABLE public.page_sections ENABLE ROW LEVEL SECURITY;

-- Anyone can read visible sections
CREATE POLICY "Anyone can view visible sections"
  ON public.page_sections
  FOR SELECT
  USING (is_visible = true);

-- Admins can view all (including hidden)
CREATE POLICY "Admins can view all sections"
  ON public.page_sections
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can manage sections
CREATE POLICY "Admins can insert sections"
  ON public.page_sections
  FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update sections"
  ON public.page_sections
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete sections"
  ON public.page_sections
  FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Updated_at trigger
CREATE TRIGGER update_page_sections_updated_at
  BEFORE UPDATE ON public.page_sections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
