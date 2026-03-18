CREATE TABLE public.store_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value boolean NOT NULL DEFAULT true,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;

-- Everyone can read settings (needed to show maintenance page, disable checkout)
CREATE POLICY "Anyone can read store settings" ON public.store_settings
  FOR SELECT TO public USING (true);

-- Only admins can update
CREATE POLICY "Admins can update store settings" ON public.store_settings
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Only admins can insert
CREATE POLICY "Admins can insert store settings" ON public.store_settings
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Seed default values
INSERT INTO public.store_settings (key, value) VALUES
  ('site_active', true),
  ('checkout_enabled', true);

-- Enable realtime for instant sync
ALTER PUBLICATION supabase_realtime ADD TABLE public.store_settings;