
-- Staff performance stats table (auto-updated by trigger)
CREATE TABLE public.staff_performance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  tasks_completed integer NOT NULL DEFAULT 0,
  tasks_active integer NOT NULL DEFAULT 0,
  total_completion_seconds bigint NOT NULL DEFAULT 0,
  avg_completion_seconds integer NOT NULL DEFAULT 0,
  sla_hits integer NOT NULL DEFAULT 0,
  sla_misses integer NOT NULL DEFAULT 0,
  points integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.staff_performance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view all performance" ON public.staff_performance
  FOR SELECT TO authenticated USING (is_staff(auth.uid()));

CREATE POLICY "System can manage performance" ON public.staff_performance
  FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

-- Trigger function: when a task moves to 'done', update performance
CREATE OR REPLACE FUNCTION public.update_staff_performance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user uuid;
  v_seconds bigint;
  v_sla_ok boolean;
BEGIN
  -- Only fire when status changes to 'done'
  IF NEW.status = 'done' AND (OLD.status IS DISTINCT FROM 'done') THEN
    v_user := COALESCE(NEW.claimed_by, NEW.assigned_to);
    IF v_user IS NULL THEN RETURN NEW; END IF;

    -- Completion time in seconds
    v_seconds := EXTRACT(EPOCH FROM (COALESCE(NEW.completed_at, now()) - NEW.created_at))::bigint;

    -- SLA check: if due_at exists, check if completed before deadline
    v_sla_ok := TRUE;
    IF NEW.due_at IS NOT NULL AND COALESCE(NEW.completed_at, now()) > NEW.due_at THEN
      v_sla_ok := FALSE;
    END IF;

    -- Upsert performance row
    INSERT INTO public.staff_performance (user_id, tasks_completed, total_completion_seconds, sla_hits, sla_misses, points)
    VALUES (
      v_user,
      1,
      v_seconds,
      CASE WHEN v_sla_ok THEN 1 ELSE 0 END,
      CASE WHEN v_sla_ok THEN 0 ELSE 1 END,
      CASE
        WHEN v_sla_ok AND v_seconds < 3600 THEN 3  -- bonus for fast
        WHEN v_sla_ok THEN 1
        ELSE -1
      END
    )
    ON CONFLICT (user_id) DO UPDATE SET
      tasks_completed = staff_performance.tasks_completed + 1,
      total_completion_seconds = staff_performance.total_completion_seconds + v_seconds,
      avg_completion_seconds = (staff_performance.total_completion_seconds + v_seconds) / (staff_performance.tasks_completed + 1),
      sla_hits = staff_performance.sla_hits + (CASE WHEN v_sla_ok THEN 1 ELSE 0 END),
      sla_misses = staff_performance.sla_misses + (CASE WHEN v_sla_ok THEN 0 ELSE 1 END),
      points = staff_performance.points + CASE
        WHEN v_sla_ok AND v_seconds < 3600 THEN 3
        WHEN v_sla_ok THEN 1
        ELSE -1
      END,
      updated_at = now();

    -- Also update active task count for this user
    UPDATE public.staff_performance SET
      tasks_active = (SELECT COUNT(*) FROM public.staff_tasks WHERE (assigned_to = v_user OR claimed_by = v_user) AND status IN ('open','claimed','in_progress'))
    WHERE user_id = v_user;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_staff_performance_on_task_done
  AFTER UPDATE ON public.staff_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_staff_performance();
