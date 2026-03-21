
CREATE OR REPLACE FUNCTION public.enqueue_email(queue_name text, payload jsonb)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pgmq
AS $$
DECLARE
  msg_id bigint;
  enriched jsonb;
BEGIN
  enriched := payload || jsonb_build_object('queued_at', now()::text);
  SELECT pgmq.send(queue_name, enriched, 0) INTO msg_id;
  RETURN msg_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.read_emails(queue_name text, batch_size integer DEFAULT 10, visibility_timeout integer DEFAULT 30)
RETURNS TABLE(msg_id bigint, read_ct integer, message jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pgmq
AS $$
BEGIN
  RETURN QUERY
  SELECT r.msg_id, r.read_ct, r.message
  FROM pgmq.read(queue_name, visibility_timeout, batch_size) r;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_email(queue_name text, message_id bigint)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pgmq
AS $$
DECLARE
  result boolean;
BEGIN
  SELECT pgmq.delete(queue_name, message_id) INTO result;
  RETURN result;
END;
$$;
