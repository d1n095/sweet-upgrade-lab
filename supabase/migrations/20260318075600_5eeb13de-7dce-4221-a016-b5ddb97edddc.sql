
CREATE TABLE public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  log_type text NOT NULL DEFAULT 'info',
  category text NOT NULL DEFAULT 'system',
  message text NOT NULL,
  details jsonb DEFAULT '{}',
  user_id uuid,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL
);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all logs"
  ON public.activity_logs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can insert logs"
  ON public.activity_logs FOR INSERT
  TO public
  WITH CHECK (true);

CREATE INDEX idx_activity_logs_created_at ON public.activity_logs (created_at DESC);
CREATE INDEX idx_activity_logs_category ON public.activity_logs (category);
CREATE INDEX idx_activity_logs_log_type ON public.activity_logs (log_type);
