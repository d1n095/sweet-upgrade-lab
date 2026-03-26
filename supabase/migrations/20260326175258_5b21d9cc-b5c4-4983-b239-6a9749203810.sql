CREATE OR REPLACE FUNCTION public.increment_structure_map_scan(p_entity_type TEXT, p_entity_name TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.system_structure_map
  SET scan_count = scan_count + 1,
      last_seen_at = now()
  WHERE entity_type = p_entity_type
    AND entity_name = p_entity_name;
END;
$$;