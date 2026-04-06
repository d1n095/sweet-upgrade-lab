-- Finalize AI naming cleanup
-- Ensures system_history uses review_* names (not ai_review_*)
-- All bug_reports and work_items ai_* columns were already dropped in 20260401000000

DO $$ BEGIN
  -- system_history: rename ai_review_status → review_status
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'system_history' AND column_name = 'ai_review_status'
  ) THEN
    ALTER TABLE public.system_history RENAME COLUMN ai_review_status TO review_status;
  END IF;

  -- system_history: rename ai_review_result → review_result
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'system_history' AND column_name = 'ai_review_result'
  ) THEN
    ALTER TABLE public.system_history RENAME COLUMN ai_review_result TO review_result;
  END IF;

  -- system_history: rename ai_review_at → review_at
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'system_history' AND column_name = 'ai_review_at'
  ) THEN
    ALTER TABLE public.system_history RENAME COLUMN ai_review_at TO review_at;
  END IF;

  -- work_items: rename ai_review_status → review_status (if not already dropped)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'work_items' AND column_name = 'ai_review_status'
  ) THEN
    ALTER TABLE public.work_items RENAME COLUMN ai_review_status TO review_status;
  END IF;

  -- work_items: rename ai_review_result → review_result (if not already dropped)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'work_items' AND column_name = 'ai_review_result'
  ) THEN
    ALTER TABLE public.work_items RENAME COLUMN ai_review_result TO review_result;
  END IF;

  -- work_items: rename ai_review_at → review_at (if not already dropped)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'work_items' AND column_name = 'ai_review_at'
  ) THEN
    ALTER TABLE public.work_items RENAME COLUMN ai_review_at TO review_at;
  END IF;
END $$;

-- Drop legacy AI tables if still present
DROP TABLE IF EXISTS public.ai_chat_messages;
DROP TABLE IF EXISTS public.ai_read_log;
