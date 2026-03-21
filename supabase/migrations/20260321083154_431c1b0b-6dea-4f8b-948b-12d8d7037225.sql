
-- Bug reports table
CREATE TABLE public.bug_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  page_url TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.bug_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view all bug reports" ON public.bug_reports FOR SELECT TO authenticated USING (is_staff(auth.uid()));
CREATE POLICY "Staff can create bug reports" ON public.bug_reports FOR INSERT TO authenticated WITH CHECK (is_staff(auth.uid()) AND auth.uid() = user_id);
CREATE POLICY "Admins can update bug reports" ON public.bug_reports FOR UPDATE TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "Admins can delete bug reports" ON public.bug_reports FOR DELETE TO authenticated USING (is_admin(auth.uid()));
