CREATE TABLE public.prompt_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  goal TEXT,
  implementation TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'pending',
  source_type TEXT DEFAULT 'manual',
  source_id UUID,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.prompt_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage prompt queue" ON public.prompt_queue FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Staff can view prompt queue" ON public.prompt_queue FOR SELECT TO authenticated USING (is_staff(auth.uid()));