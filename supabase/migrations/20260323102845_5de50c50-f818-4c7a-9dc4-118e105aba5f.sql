
-- 1. Create the unified work_items table
CREATE TABLE public.work_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'open',
  priority text NOT NULL DEFAULT 'medium',
  item_type text NOT NULL DEFAULT 'manual',
  source_type text,
  source_id text,
  assigned_to uuid,
  claimed_by uuid,
  claimed_at timestamptz,
  completed_at timestamptz,
  created_by uuid,
  due_at timestamptz,
  related_order_id uuid REFERENCES public.orders(id),
  related_incident_id uuid REFERENCES public.order_incidents(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Enable RLS
ALTER TABLE public.work_items ENABLE ROW LEVEL SECURITY;

-- 3. RLS policies: staff can read/write, no public access
CREATE POLICY "Staff can read work_items"
  ON public.work_items FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff can insert work_items"
  ON public.work_items FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Staff can update work_items"
  ON public.work_items FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid()));

-- 4. Indexes
CREATE INDEX idx_work_items_status ON public.work_items(status);
CREATE INDEX idx_work_items_priority ON public.work_items(priority);
CREATE INDEX idx_work_items_assigned ON public.work_items(assigned_to);
CREATE INDEX idx_work_items_source ON public.work_items(source_type, source_id);
CREATE INDEX idx_work_items_order ON public.work_items(related_order_id);
CREATE INDEX idx_work_items_type ON public.work_items(item_type);

-- 5. Migrate existing staff_tasks data into work_items
INSERT INTO public.work_items (id, title, description, status, priority, item_type, assigned_to, claimed_by, claimed_at, completed_at, created_by, due_at, related_order_id, related_incident_id, created_at, updated_at, source_type, source_id)
SELECT id, title, description, status, priority, task_type, assigned_to, claimed_by, claimed_at, completed_at, created_by, due_at, related_order_id, related_incident_id, created_at, updated_at,
  CASE WHEN related_incident_id IS NOT NULL THEN 'order_incident' WHEN related_order_id IS NOT NULL THEN 'order' ELSE 'manual' END,
  COALESCE(related_incident_id::text, related_order_id::text)
FROM public.staff_tasks;

-- 6. Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.work_items;

-- 7. Auto-create work_item from bug_reports
CREATE OR REPLACE FUNCTION public.create_work_item_from_bug()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO public.work_items (title, description, status, priority, item_type, source_type, source_id, created_by)
  VALUES (
    'Bug: ' || LEFT(NEW.description, 80),
    NEW.description,
    'open',
    'medium',
    'bug',
    'bug_report',
    NEW.id::text,
    NEW.user_id
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_bug_to_work_item
  AFTER INSERT ON public.bug_reports
  FOR EACH ROW EXECUTE FUNCTION public.create_work_item_from_bug();

-- 8. Auto-create work_item from order_incidents
CREATE OR REPLACE FUNCTION public.create_work_item_from_incident()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO public.work_items (title, description, status, priority, item_type, source_type, source_id, related_order_id, related_incident_id, assigned_to, due_at, created_by)
  VALUES (
    'Incident: ' || NEW.title,
    NEW.description,
    'open',
    NEW.priority,
    'incident',
    'order_incident',
    NEW.id::text,
    NEW.order_id,
    NEW.id,
    NEW.assigned_to,
    NEW.sla_deadline,
    NEW.reported_by
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_incident_to_work_item
  AFTER INSERT ON public.order_incidents
  FOR EACH ROW EXECUTE FUNCTION public.create_work_item_from_incident();

-- 9. Sync work_item status back to source entities
CREATE OR REPLACE FUNCTION public.sync_work_item_to_source()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF NEW.status = 'done' AND OLD.status IS DISTINCT FROM 'done' THEN
    -- Sync to bug_reports
    IF NEW.source_type = 'bug_report' AND NEW.source_id IS NOT NULL THEN
      UPDATE public.bug_reports SET status = 'resolved', resolved_at = now(), resolved_by = COALESCE(NEW.claimed_by, NEW.assigned_to) WHERE id = NEW.source_id::uuid;
    END IF;
    -- Sync to order_incidents
    IF NEW.source_type = 'order_incident' AND NEW.source_id IS NOT NULL THEN
      UPDATE public.order_incidents SET status = 'resolved', resolved_at = now(), updated_at = now() WHERE id = NEW.source_id::uuid;
    END IF;
  END IF;
  
  IF NEW.status = 'in_progress' AND OLD.status IS DISTINCT FROM 'in_progress' THEN
    IF NEW.source_type = 'order_incident' AND NEW.source_id IS NOT NULL THEN
      UPDATE public.order_incidents SET status = 'in_progress', updated_at = now() WHERE id = NEW.source_id::uuid;
    END IF;
  END IF;
  
  IF NEW.status = 'escalated' AND OLD.status IS DISTINCT FROM 'escalated' THEN
    IF NEW.source_type = 'order_incident' AND NEW.source_id IS NOT NULL THEN
      UPDATE public.order_incidents SET status = 'escalated', escalated_at = now(), updated_at = now() WHERE id = NEW.source_id::uuid;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_work_item
  AFTER UPDATE ON public.work_items
  FOR EACH ROW EXECUTE FUNCTION public.sync_work_item_to_source();

-- 10. Update auto_assign_task to work with work_items
CREATE OR REPLACE FUNCTION public.auto_assign_work_item(p_item_type text)
RETURNS uuid
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_best_user uuid;
  v_role_filter text[];
BEGIN
  CASE p_item_type
    WHEN 'packing' THEN v_role_filter := ARRAY['warehouse', 'admin', 'founder', 'moderator'];
    WHEN 'pack_order' THEN v_role_filter := ARRAY['warehouse', 'admin', 'founder', 'moderator'];
    WHEN 'shipping' THEN v_role_filter := ARRAY['warehouse', 'admin', 'founder', 'moderator'];
    WHEN 'support' THEN v_role_filter := ARRAY['support', 'moderator', 'admin', 'founder'];
    WHEN 'support_case' THEN v_role_filter := ARRAY['support', 'moderator', 'admin', 'founder'];
    WHEN 'bug' THEN v_role_filter := ARRAY['it', 'admin', 'founder'];
    WHEN 'incident' THEN v_role_filter := ARRAY['support', 'admin', 'founder'];
    WHEN 'refund' THEN v_role_filter := ARRAY['finance', 'admin', 'founder'];
    WHEN 'refund_request' THEN v_role_filter := ARRAY['finance', 'admin', 'founder'];
    ELSE v_role_filter := ARRAY['admin', 'founder', 'moderator', 'warehouse', 'support'];
  END CASE;

  SELECT ur.user_id INTO v_best_user
  FROM public.user_roles ur
  WHERE ur.role::text = ANY(v_role_filter)
  GROUP BY ur.user_id
  ORDER BY (
    SELECT COUNT(*) FROM public.work_items wi
    WHERE (wi.assigned_to = ur.user_id OR wi.claimed_by = ur.user_id)
      AND wi.status IN ('open', 'claimed', 'in_progress')
  ) ASC
  LIMIT 1;

  RETURN v_best_user;
END;
$$;

-- 11. Update staff performance trigger to work with work_items
CREATE OR REPLACE FUNCTION public.update_staff_performance_from_work_items()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_user uuid;
  v_seconds bigint;
  v_sla_ok boolean;
  v_start timestamptz;
  v_end timestamptz;
BEGIN
  IF NEW.status = 'done' AND (OLD.status IS DISTINCT FROM 'done') THEN
    v_user := COALESCE(NEW.claimed_by, NEW.assigned_to);
    IF v_user IS NULL THEN RETURN NEW; END IF;
    v_start := COALESCE(NEW.claimed_at, NEW.created_at);
    v_end := COALESCE(NEW.completed_at, now());
    v_seconds := GREATEST(1, EXTRACT(EPOCH FROM (v_end - v_start))::bigint);
    v_sla_ok := TRUE;
    IF NEW.due_at IS NOT NULL AND v_end > NEW.due_at THEN v_sla_ok := FALSE; END IF;

    INSERT INTO public.staff_performance (user_id, tasks_completed, total_completion_seconds, avg_completion_seconds, sla_hits, sla_misses, points)
    VALUES (
      v_user, 1, v_seconds, v_seconds,
      CASE WHEN v_sla_ok THEN 1 ELSE 0 END,
      CASE WHEN v_sla_ok THEN 0 ELSE 1 END,
      CASE WHEN v_sla_ok AND v_seconds < 3600 THEN 3 WHEN v_sla_ok THEN 1 ELSE -1 END
    )
    ON CONFLICT (user_id) DO UPDATE SET
      tasks_completed = staff_performance.tasks_completed + 1,
      total_completion_seconds = staff_performance.total_completion_seconds + v_seconds,
      avg_completion_seconds = (staff_performance.total_completion_seconds + v_seconds) / (staff_performance.tasks_completed + 1),
      sla_hits = staff_performance.sla_hits + (CASE WHEN v_sla_ok THEN 1 ELSE 0 END),
      sla_misses = staff_performance.sla_misses + (CASE WHEN v_sla_ok THEN 0 ELSE 1 END),
      points = staff_performance.points + CASE WHEN v_sla_ok AND v_seconds < 3600 THEN 3 WHEN v_sla_ok THEN 1 ELSE -1 END,
      updated_at = now();

    UPDATE public.staff_performance SET
      tasks_active = (SELECT COUNT(*) FROM public.work_items WHERE (assigned_to = v_user OR claimed_by = v_user) AND status IN ('open','claimed','in_progress'))
    WHERE user_id = v_user;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_work_items_performance
  AFTER UPDATE ON public.work_items
  FOR EACH ROW EXECUTE FUNCTION public.update_staff_performance_from_work_items();
