CREATE TABLE public.product_translation_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  language_code text NOT NULL,
  translated_fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(product_id, language_code)
);

ALTER TABLE public.product_translation_cache ENABLE ROW LEVEL SECURITY;

-- Anyone can read cached translations
CREATE POLICY "Anyone can read translation cache"
  ON public.product_translation_cache FOR SELECT
  TO anon, authenticated
  USING (true);

-- Only service role / edge functions insert/update
CREATE POLICY "Service role can manage translation cache"
  ON public.product_translation_cache FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Trigger to auto-update updated_at
CREATE TRIGGER update_translation_cache_updated_at
  BEFORE UPDATE ON public.product_translation_cache
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();