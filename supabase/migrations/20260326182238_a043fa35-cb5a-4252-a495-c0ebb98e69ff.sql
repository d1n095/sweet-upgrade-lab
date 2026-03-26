CREATE TABLE public.scan_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  total_scanners integer NOT NULL DEFAULT 0,
  total_detected integer NOT NULL DEFAULT 0,
  total_filtered integer NOT NULL DEFAULT 0,
  total_created integer NOT NULL DEFAULT 0,
  total_skipped integer NOT NULL DEFAULT 0,
  high_attention_count integer NOT NULL DEFAULT 0,
  dead_scanners_count integer NOT NULL DEFAULT 0,
  blind_scanners_count integer NOT NULL DEFAULT 0,
  payload jsonb DEFAULT '{}'::jsonb
);

ALTER TABLE public.scan_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read scan_snapshots" ON public.scan_snapshots FOR SELECT TO authenticated USING (is_staff(auth.uid()));
CREATE POLICY "Service role full access on scan_snapshots" ON public.scan_snapshots FOR ALL TO service_role USING (true) WITH CHECK (true);