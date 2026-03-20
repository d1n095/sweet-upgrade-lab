
-- Database function that finds the best staff member for a task based on workload
-- Returns the user_id of the least busy staff member with the matching role
CREATE OR REPLACE FUNCTION public.auto_assign_task(p_task_type text)
RETURNS uuid
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_best_user uuid;
  v_role_filter text[];
BEGIN
  -- Map task_type to relevant roles
  CASE p_task_type
    WHEN 'packing' THEN v_role_filter := ARRAY['warehouse', 'admin', 'founder', 'moderator'];
    WHEN 'shipping' THEN v_role_filter := ARRAY['warehouse', 'admin', 'founder', 'moderator'];
    WHEN 'support' THEN v_role_filter := ARRAY['support', 'moderator', 'admin', 'founder'];
    WHEN 'refund' THEN v_role_filter := ARRAY['finance', 'admin', 'founder'];
    ELSE v_role_filter := ARRAY['admin', 'founder', 'moderator', 'warehouse', 'support'];
  END CASE;

  -- Find staff with matching role and fewest active (non-done) tasks
  SELECT ur.user_id INTO v_best_user
  FROM public.user_roles ur
  WHERE ur.role::text = ANY(v_role_filter)
  GROUP BY ur.user_id
  ORDER BY (
    SELECT COUNT(*) FROM public.staff_tasks st
    WHERE st.assigned_to = ur.user_id
      AND st.status IN ('open', 'claimed', 'in_progress')
  ) ASC
  LIMIT 1;

  RETURN v_best_user;
END;
$$;
