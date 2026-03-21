
DROP FUNCTION IF EXISTS public.move_to_dlq(text, text, bigint, jsonb);

CREATE OR REPLACE FUNCTION public.move_to_dlq(source_queue text, dlq_name text, message_id bigint, payload jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pgmq
AS $$
BEGIN
  PERFORM pgmq.send(dlq_name, payload, 0);
  PERFORM pgmq.delete(source_queue, message_id);
END;
$$;
