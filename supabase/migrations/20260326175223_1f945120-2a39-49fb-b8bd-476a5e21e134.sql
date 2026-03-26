CREATE TABLE public.system_structure_map (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_name TEXT NOT NULL,
  source_path TEXT,
  last_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  scan_count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(entity_type, entity_name)
);

ALTER TABLE public.system_structure_map ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on system_structure_map"
  ON public.system_structure_map
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admins can read system_structure_map"
  ON public.system_structure_map
  FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));