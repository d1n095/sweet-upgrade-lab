
-- Notifications table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  message TEXT NOT NULL,
  related_id UUID,
  related_type TEXT,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Staff can view all notifications" ON public.notifications
  FOR SELECT USING (is_staff(auth.uid()));

CREATE POLICY "System can create notifications" ON public.notifications
  FOR INSERT WITH CHECK (true);

CREATE INDEX idx_notifications_user_unread ON public.notifications (user_id, read) WHERE read = false;

-- Order incidents table with SLA
CREATE TABLE public.order_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  reported_by UUID,
  assigned_to UUID,
  type TEXT NOT NULL DEFAULT 'other',
  priority TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'open',
  title TEXT NOT NULL,
  description TEXT,
  resolution TEXT,
  sla_deadline TIMESTAMP WITH TIME ZONE,
  sla_status TEXT NOT NULL DEFAULT 'ok',
  escalated_at TIMESTAMP WITH TIME ZONE,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.order_incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view all incidents" ON public.order_incidents
  FOR SELECT USING (is_staff(auth.uid()));

CREATE POLICY "Staff can create incidents" ON public.order_incidents
  FOR INSERT WITH CHECK (is_staff(auth.uid()));

CREATE POLICY "Staff can update incidents" ON public.order_incidents
  FOR UPDATE USING (is_staff(auth.uid()));

CREATE POLICY "Admins can delete incidents" ON public.order_incidents
  FOR DELETE USING (is_admin(auth.uid()));

CREATE INDEX idx_incidents_status ON public.order_incidents (status, priority);
CREATE INDEX idx_incidents_sla ON public.order_incidents (sla_status) WHERE status = 'open';

-- Trigger: auto-set SLA deadline based on priority
CREATE OR REPLACE FUNCTION public.set_incident_sla()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.sla_deadline IS NULL THEN
    CASE NEW.priority
      WHEN 'high' THEN NEW.sla_deadline := now() + INTERVAL '4 hours';
      WHEN 'medium' THEN NEW.sla_deadline := now() + INTERVAL '24 hours';
      WHEN 'low' THEN NEW.sla_deadline := now() + INTERVAL '48 hours';
      ELSE NEW.sla_deadline := now() + INTERVAL '24 hours';
    END CASE;
  END IF;
  
  -- Update SLA status
  IF NEW.status IN ('resolved', 'closed') THEN
    NEW.sla_status := 'ok';
  ELSIF NEW.sla_deadline < now() THEN
    NEW.sla_status := 'overdue';
  ELSIF NEW.sla_deadline < now() + INTERVAL '1 hour' THEN
    NEW.sla_status := 'warning';
  ELSE
    NEW.sla_status := 'ok';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_incident_sla_trigger
  BEFORE INSERT OR UPDATE ON public.order_incidents
  FOR EACH ROW EXECUTE FUNCTION public.set_incident_sla();

-- Trigger: auto-create notification on incident creation
CREATE OR REPLACE FUNCTION public.notify_on_incident()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Notify all admins
  INSERT INTO public.notifications (user_id, type, message, related_id, related_type)
  SELECT ur.user_id, 
    CASE WHEN NEW.priority = 'high' THEN 'urgent' ELSE 'info' END,
    'Nytt ärende: ' || NEW.title,
    NEW.id, 'incident'
  FROM public.user_roles ur
  WHERE ur.role IN ('admin', 'founder', 'it');

  -- Notify assigned user if set
  IF NEW.assigned_to IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, message, related_id, related_type)
    VALUES (NEW.assigned_to, 'task', 'Ärende tilldelat dig: ' || NEW.title, NEW.id, 'incident');
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER notify_on_incident_trigger
  AFTER INSERT ON public.order_incidents
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_incident();

-- Trigger: notify on refund request
CREATE OR REPLACE FUNCTION public.notify_on_refund_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'pending' THEN
    INSERT INTO public.notifications (user_id, type, message, related_id, related_type)
    SELECT ur.user_id, 'urgent', 'Ny återbetalningsbegäran', NEW.order_id, 'refund'
    FROM public.user_roles ur
    WHERE ur.role IN ('admin', 'founder');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER notify_on_refund_trigger
  AFTER INSERT ON public.refund_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_refund_request();

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
