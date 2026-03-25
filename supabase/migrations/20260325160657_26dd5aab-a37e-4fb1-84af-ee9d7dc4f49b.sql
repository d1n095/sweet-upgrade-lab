
CREATE TABLE public.scan_focus_memory (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  focus_key TEXT NOT NULL UNIQUE,
  focus_type TEXT NOT NULL DEFAULT 'component',
  label TEXT NOT NULL,
  issue_count INTEGER NOT NULL DEFAULT 1,
  last_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  first_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  severity TEXT NOT NULL DEFAULT 'medium',
  scan_count INTEGER NOT NULL DEFAULT 1,
  related_scan_types TEXT[] NOT NULL DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.scan_focus_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read focus memory" ON public.scan_focus_memory
  FOR SELECT TO authenticated USING (is_staff(auth.uid()));

CREATE POLICY "Service role can manage focus memory" ON public.scan_focus_memory
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Admins can manage focus memory" ON public.scan_focus_memory
  FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
