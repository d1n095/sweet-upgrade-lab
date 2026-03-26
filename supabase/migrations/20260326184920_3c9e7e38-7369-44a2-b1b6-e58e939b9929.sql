
CREATE TABLE public.runtime_traces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL DEFAULT 'db',
  function_name text NOT NULL,
  endpoint text,
  error_message text,
  payload_snapshot jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.runtime_traces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin read runtime_traces"
  ON public.runtime_traces FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Service insert runtime_traces"
  ON public.runtime_traces FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE INDEX idx_runtime_traces_created_at ON public.runtime_traces(created_at DESC);
CREATE INDEX idx_runtime_traces_function ON public.runtime_traces(function_name);
