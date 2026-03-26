CREATE OR REPLACE FUNCTION public.increment_work_item_occurrence(p_work_item_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.work_items
  SET occurrence_count = COALESCE(occurrence_count, 1) + 1,
      last_seen_at = now()
  WHERE id = p_work_item_id;
END;
$$;