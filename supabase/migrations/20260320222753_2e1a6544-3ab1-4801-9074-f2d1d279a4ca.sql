
-- Add claimed_at to staff_tasks for accurate work-time tracking
ALTER TABLE public.staff_tasks ADD COLUMN IF NOT EXISTS claimed_at timestamptz;

-- Update the performance trigger to use claimed_at (real work start) instead of created_at
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
  v_start timestamptz;
  v_end timestamptz;
BEGIN
  -- Only fire when status changes to 'done'
  IF NEW.status = 'done' AND (OLD.status IS DISTINCT FROM 'done') THEN
    v_user := COALESCE(NEW.claimed_by, NEW.assigned_to);
    IF v_user IS NULL THEN RETURN NEW; END IF;

    -- Use claimed_at as real work start, fall back to created_at
    v_start := COALESCE(NEW.claimed_at, NEW.created_at);
    v_end := COALESCE(NEW.completed_at, now());
    v_seconds := GREATEST(1, EXTRACT(EPOCH FROM (v_end - v_start))::bigint);

    -- SLA check
    v_sla_ok := TRUE;
    IF NEW.due_at IS NOT NULL AND v_end > NEW.due_at THEN
      v_sla_ok := FALSE;
    END IF;

    -- Upsert performance row
    INSERT INTO public.staff_performance (user_id, tasks_completed, total_completion_seconds, avg_completion_seconds, sla_hits, sla_misses, points)
    VALUES (
      v_user, 1, v_seconds, v_seconds,
      CASE WHEN v_sla_ok THEN 1 ELSE 0 END,
      CASE WHEN v_sla_ok THEN 0 ELSE 1 END,
      CASE
        WHEN v_sla_ok AND v_seconds < 3600 THEN 3
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

    -- Update active task count
    UPDATE public.staff_performance SET
      tasks_active = (SELECT COUNT(*) FROM public.staff_tasks WHERE (assigned_to = v_user OR claimed_by = v_user) AND status IN ('open','claimed','in_progress'))
    WHERE user_id = v_user;
  END IF;

  RETURN NEW;
END;
$$;
