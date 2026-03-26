
-- Create work_item_history table
CREATE TABLE public.work_item_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_item_id UUID NOT NULL REFERENCES public.work_items(id) ON DELETE CASCADE,
  action TEXT NOT NULL DEFAULT 'updated',
  old_value JSONB,
  new_value JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_work_item_history_work_item_id ON public.work_item_history(work_item_id);
CREATE INDEX idx_work_item_history_created_at ON public.work_item_history(created_at DESC);

-- Enable RLS
ALTER TABLE public.work_item_history ENABLE ROW LEVEL SECURITY;

-- Read-only policy for staff
CREATE POLICY "Staff can read work_item_history"
  ON public.work_item_history
  FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()));

-- Insert policy for service role and triggers
CREATE POLICY "System can insert work_item_history"
  ON public.work_item_history
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));

-- Trigger function for INSERT
CREATE OR REPLACE FUNCTION public.log_work_item_created()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.work_item_history (work_item_id, action, old_value, new_value)
  VALUES (
    NEW.id,
    'created',
    NULL,
    jsonb_build_object(
      'title', NEW.title,
      'status', NEW.status,
      'priority', NEW.priority,
      'item_type', NEW.item_type,
      'source_type', NEW.source_type,
      'source_id', NEW.source_id,
      'created_by', NEW.created_by
    )
  );
  RETURN NEW;
END;
$$;

-- Trigger function for UPDATE
CREATE OR REPLACE FUNCTION public.log_work_item_updated()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_action text := 'updated';
BEGIN
  -- Detect status change specifically
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    v_action := 'status_changed';
  END IF;

  INSERT INTO public.work_item_history (work_item_id, action, old_value, new_value)
  VALUES (
    NEW.id,
    v_action,
    jsonb_build_object(
      'title', OLD.title,
      'status', OLD.status,
      'priority', OLD.priority,
      'assigned_to', OLD.assigned_to,
      'claimed_by', OLD.claimed_by,
      'ignored', OLD.ignored
    ),
    jsonb_build_object(
      'title', NEW.title,
      'status', NEW.status,
      'priority', NEW.priority,
      'assigned_to', NEW.assigned_to,
      'claimed_by', NEW.claimed_by,
      'ignored', NEW.ignored
    )
  );
  RETURN NEW;
END;
$$;

-- Attach triggers
CREATE TRIGGER trg_work_item_created
  AFTER INSERT ON public.work_items
  FOR EACH ROW
  EXECUTE FUNCTION public.log_work_item_created();

CREATE TRIGGER trg_work_item_updated
  AFTER UPDATE ON public.work_items
  FOR EACH ROW
  EXECUTE FUNCTION public.log_work_item_updated();
