
-- Role templates: define default module access per role
CREATE TABLE public.role_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_key TEXT NOT NULL UNIQUE,
  name_sv TEXT NOT NULL,
  description_sv TEXT,
  default_modules TEXT[] NOT NULL DEFAULT '{}',
  is_locked BOOLEAN NOT NULL DEFAULT false,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.role_templates ENABLE ROW LEVEL SECURITY;

-- Only founders can manage templates
CREATE POLICY "Founders can manage role templates"
  ON public.role_templates FOR ALL
  TO authenticated
  USING (is_founder(auth.uid()))
  WITH CHECK (is_founder(auth.uid()));

-- Staff can view templates
CREATE POLICY "Staff can view role templates"
  ON public.role_templates FOR SELECT
  TO authenticated
  USING (is_staff(auth.uid()));

-- Seed default templates
INSERT INTO public.role_templates (role_key, name_sv, description_sv, default_modules, is_locked) VALUES
  ('founder', 'Grundare', 'Full kontroll över allt. Kan inte ändras eller tas bort.', 
   ARRAY['dashboard','orders','products','categories','reviews','members','partners','finance','content','campaigns','shipping','seo','visibility','legal','logs','settings','stats','staff','incidents'], true),
  ('admin', 'Admin', 'Full åtkomst till adminpanelen.', 
   ARRAY['dashboard','orders','products','categories','reviews','members','partners','finance','content','campaigns','shipping','seo','visibility','legal','logs','settings','stats','incidents'], true),
  ('it', 'IT', 'Full åtkomst + teknisk hantering.', 
   ARRAY['dashboard','orders','products','categories','reviews','members','partners','finance','content','campaigns','shipping','seo','visibility','legal','logs','settings','stats','incidents'], false),
  ('manager', 'Manager', 'Teamledare med utökade rättigheter.', 
   ARRAY['dashboard','orders','products','categories','reviews','members','partners','content','campaigns','shipping','incidents'], false),
  ('moderator', 'Anställd', 'Begränsad åtkomst till daglig drift.', 
   ARRAY['dashboard','orders','products','reviews','incidents'], false),
  ('support', 'Support', 'Kundtjänst och orderhantering.', 
   ARRAY['dashboard','orders','reviews','members','incidents'], false),
  ('marketing', 'Marknadsföring', 'Kampanjer, SEO och innehåll.', 
   ARRAY['dashboard','content','campaigns','seo','partners','stats'], false),
  ('finance', 'Ekonomi', 'Betalningar och ekonomisk data.', 
   ARRAY['dashboard','orders','finance','stats'], false),
  ('warehouse', 'Lager', 'Lager och frakthantering.', 
   ARRAY['dashboard','orders','products','shipping'], false);

-- Trigger for updated_at
CREATE TRIGGER update_role_templates_updated_at
  BEFORE UPDATE ON public.role_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
