CREATE TABLE public.system_expectations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('route', 'component', 'flow', 'data')),
  entity_name text NOT NULL,
  required boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entity_type, entity_name)
);

ALTER TABLE public.system_expectations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read system_expectations"
  ON public.system_expectations FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()));

INSERT INTO public.system_expectations (entity_type, entity_name, required) VALUES
  ('route', '/checkout', true),
  ('flow', 'checkout_flow', true),
  ('data', 'orders', true),
  ('route', '/shop', true),
  ('route', '/product', true),
  ('data', 'products', true),
  ('data', 'profiles', true),
  ('flow', 'order_flow', true),
  ('component', 'Header', true),
  ('component', 'Footer', true);