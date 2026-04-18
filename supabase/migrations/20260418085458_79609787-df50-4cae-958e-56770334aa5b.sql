-- Create security_events table
CREATE TABLE public.security_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('auth','data','api','anomaly')),
  severity TEXT NOT NULL CHECK (severity IN ('low','medium','high','critical')),
  message TEXT NOT NULL,
  endpoint TEXT,
  user_id UUID,
  ip TEXT,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes for fast querying
CREATE INDEX idx_security_events_timestamp ON public.security_events (timestamp DESC);
CREATE INDEX idx_security_events_type ON public.security_events (type);
CREATE INDEX idx_security_events_severity ON public.security_events (severity);
CREATE INDEX idx_security_events_user_id ON public.security_events (user_id);

-- Enable RLS
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

-- Only staff (admin/founder/it/support/moderator) can read security events
CREATE POLICY "Staff can view security events"
ON public.security_events
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('admin','founder','it','support','moderator')
  )
);

-- Only admin/founder can delete (for cleanup)
CREATE POLICY "Admins can delete security events"
ON public.security_events
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('admin','founder')
  )
);

-- Inserts come from edge functions (service role bypasses RLS); no client INSERT policy needed.