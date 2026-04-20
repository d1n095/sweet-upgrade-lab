-- Event type enum (deterministic, no free-form strings)
DO $$ BEGIN
  CREATE TYPE public.ecommerce_event_type AS ENUM (
    'product_view',
    'product_no_sales',
    'low_stock',
    'high_stock',
    'price_drop_needed',
    'campaign_trigger'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.ecommerce_event_severity AS ENUM ('info', 'warning', 'critical');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Append-only event log
CREATE TABLE IF NOT EXISTS public.ecommerce_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type public.ecommerce_event_type NOT NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  variant_id uuid,
  severity public.ecommerce_event_severity NOT NULL DEFAULT 'info',
  source text NOT NULL DEFAULT 'system',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  emitted_by uuid,
  emitted_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  processed_by_rule text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ecommerce_events_type_time
  ON public.ecommerce_events(event_type, emitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_ecommerce_events_product
  ON public.ecommerce_events(product_id, emitted_at DESC) WHERE product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ecommerce_events_unprocessed
  ON public.ecommerce_events(emitted_at DESC) WHERE processed_at IS NULL;

ALTER TABLE public.ecommerce_events ENABLE ROW LEVEL SECURITY;

-- Public read (transparency, mirrors price_history pattern)
CREATE POLICY "ecommerce_events readable by everyone"
  ON public.ecommerce_events FOR SELECT
  USING (true);

-- Authenticated users can emit events (filtered by source/payload validation in app layer)
CREATE POLICY "ecommerce_events insert by authenticated"
  ON public.ecommerce_events FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- Admins can mark events processed
CREATE POLICY "ecommerce_events update by admins"
  ON public.ecommerce_events FOR UPDATE
  TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- Admins can prune events
CREATE POLICY "ecommerce_events delete by admins"
  ON public.ecommerce_events FOR DELETE
  TO authenticated
  USING (is_admin(auth.uid()));

-- Helper function: emit_ecommerce_event (callable from edge functions / triggers)
CREATE OR REPLACE FUNCTION public.emit_ecommerce_event(
  p_event_type public.ecommerce_event_type,
  p_product_id uuid DEFAULT NULL,
  p_variant_id uuid DEFAULT NULL,
  p_severity public.ecommerce_event_severity DEFAULT 'info',
  p_source text DEFAULT 'system',
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.ecommerce_events (
    event_type, product_id, variant_id, severity, source, payload, emitted_by
  ) VALUES (
    p_event_type, p_product_id, p_variant_id, p_severity, p_source, p_payload, auth.uid()
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;