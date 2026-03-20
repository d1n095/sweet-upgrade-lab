
-- Staff tasks for workboard
CREATE TABLE public.staff_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'claimed', 'in_progress', 'done')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  assigned_to UUID,
  claimed_by UUID,
  related_order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  related_incident_id UUID REFERENCES public.order_incidents(id) ON DELETE SET NULL,
  task_type TEXT NOT NULL DEFAULT 'general' CHECK (task_type IN ('general', 'packing', 'shipping', 'support', 'review', 'refund', 'other')),
  due_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.staff_tasks ENABLE ROW LEVEL SECURITY;

-- Staff can view all tasks
CREATE POLICY "Staff can view all tasks"
  ON public.staff_tasks FOR SELECT
  TO authenticated
  USING (is_staff(auth.uid()));

-- Staff can create tasks
CREATE POLICY "Staff can create tasks"
  ON public.staff_tasks FOR INSERT
  TO authenticated
  WITH CHECK (is_staff(auth.uid()));

-- Staff can update tasks (claim, move status)
CREATE POLICY "Staff can update tasks"
  ON public.staff_tasks FOR UPDATE
  TO authenticated
  USING (is_staff(auth.uid()));

-- Admins can delete tasks
CREATE POLICY "Admins can delete tasks"
  ON public.staff_tasks FOR DELETE
  TO authenticated
  USING (is_admin(auth.uid()));

-- Auto-update updated_at
CREATE TRIGGER update_staff_tasks_updated_at
  BEFORE UPDATE ON public.staff_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.staff_tasks;
