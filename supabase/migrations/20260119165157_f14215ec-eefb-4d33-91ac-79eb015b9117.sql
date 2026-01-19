-- Create email templates table
CREATE TABLE public.email_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_type TEXT NOT NULL UNIQUE,
  subject_sv TEXT NOT NULL,
  subject_en TEXT NOT NULL,
  greeting_sv TEXT NOT NULL,
  greeting_en TEXT NOT NULL,
  intro_sv TEXT NOT NULL,
  intro_en TEXT NOT NULL,
  benefits_sv TEXT[] NOT NULL DEFAULT '{}',
  benefits_en TEXT[] NOT NULL DEFAULT '{}',
  cta_text_sv TEXT NOT NULL,
  cta_text_en TEXT NOT NULL,
  footer_sv TEXT NOT NULL,
  footer_en TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

-- Allow everyone to read (edge function needs this)
CREATE POLICY "Email templates are readable by everyone"
ON public.email_templates
FOR SELECT
USING (true);

-- Only admins can update
CREATE POLICY "Only admins can update email templates"
ON public.email_templates
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- Only admins can insert
CREATE POLICY "Only admins can insert email templates"
ON public.email_templates
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Create trigger for updated_at
CREATE TRIGGER update_email_templates_updated_at
BEFORE UPDATE ON public.email_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default welcome email template
INSERT INTO public.email_templates (
  template_type,
  subject_sv,
  subject_en,
  greeting_sv,
  greeting_en,
  intro_sv,
  intro_en,
  benefits_sv,
  benefits_en,
  cta_text_sv,
  cta_text_en,
  footer_sv,
  footer_en
) VALUES (
  'welcome',
  'Välkommen till 4thepeople! 🌿',
  'Welcome to 4thepeople! 🌿',
  'Välkommen till familjen!',
  'Welcome to the family!',
  'Tack för att du registrerade dig hos oss. Du är nu medlem och har tillgång till exklusiva fördelar.',
  'Thank you for signing up with us. You are now a member with access to exclusive benefits.',
  ARRAY['💰 Exklusiva medlemspriser på alla produkter', '📦 Automatiska mängdrabatter', '🎁 Tillgång till paketpriser och erbjudanden', '⭐ Möjlighet att skriva recensioner och få rabatter'],
  ARRAY['💰 Exclusive member prices on all products', '📦 Automatic volume discounts', '🎁 Access to bundle pricing and offers', '⭐ Ability to write reviews and earn discounts'],
  'Börja handla',
  'Start shopping',
  'Vi är glada att ha dig med oss! 💚',
  'We''re happy to have you with us! 💚'
);