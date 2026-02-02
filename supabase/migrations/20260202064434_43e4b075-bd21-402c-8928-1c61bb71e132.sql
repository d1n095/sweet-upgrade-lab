-- Create site_updates table for "Nytt hos oss" page
CREATE TABLE public.site_updates (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    update_type TEXT NOT NULL DEFAULT 'general', -- 'product', 'category', 'feature', 'general'
    title_sv TEXT NOT NULL,
    title_en TEXT,
    description_sv TEXT,
    description_en TEXT,
    related_product_id TEXT, -- Shopify product ID if applicable
    related_category TEXT, -- Category ID if applicable
    image_url TEXT,
    is_published BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.site_updates ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view published updates"
ON public.site_updates
FOR SELECT
USING (is_published = true);

CREATE POLICY "Admins can view all updates"
ON public.site_updates
FOR SELECT
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can create updates"
ON public.site_updates
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update updates"
ON public.site_updates
FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete updates"
ON public.site_updates
FOR DELETE
USING (has_role(auth.uid(), 'admin'));

-- Add anonymous_id to donations for public display
ALTER TABLE public.donations ADD COLUMN IF NOT EXISTS anonymous_id TEXT;

-- Create function to generate anonymous IDs for donations
CREATE OR REPLACE FUNCTION generate_donation_anonymous_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.anonymous_id IS NULL THEN
    NEW.anonymous_id := 'DON-' || UPPER(SUBSTRING(gen_random_uuid()::TEXT, 1, 8));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for anonymous_id
DROP TRIGGER IF EXISTS set_donation_anonymous_id ON public.donations;
CREATE TRIGGER set_donation_anonymous_id
BEFORE INSERT ON public.donations
FOR EACH ROW
EXECUTE FUNCTION generate_donation_anonymous_id();

-- Update existing donations with anonymous IDs
UPDATE public.donations SET anonymous_id = 'DON-' || UPPER(SUBSTRING(gen_random_uuid()::TEXT, 1, 8)) WHERE anonymous_id IS NULL;

-- Enable realtime for site_updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.site_updates;