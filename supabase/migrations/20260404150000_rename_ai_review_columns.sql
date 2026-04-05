
-- Rename ai_review_* columns to review_* in work_items and system_history
-- Removes AI-prefixed naming from review columns to reflect rule-based implementation

DO $$ BEGIN
  -- work_items
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'work_items' AND column_name = 'ai_review_status') THEN
    ALTER TABLE public.work_items RENAME COLUMN ai_review_status TO review_status;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'work_items' AND column_name = 'ai_review_result') THEN
    ALTER TABLE public.work_items RENAME COLUMN ai_review_result TO review_result;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'work_items' AND column_name = 'ai_review_at') THEN
    ALTER TABLE public.work_items RENAME COLUMN ai_review_at TO review_at;
  END IF;

  -- system_history
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'system_history' AND column_name = 'ai_review_status') THEN
    ALTER TABLE public.system_history RENAME COLUMN ai_review_status TO review_status;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'system_history' AND column_name = 'ai_review_result') THEN
    ALTER TABLE public.system_history RENAME COLUMN ai_review_result TO review_result;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'system_history' AND column_name = 'ai_review_at') THEN
    ALTER TABLE public.system_history RENAME COLUMN ai_review_at TO review_at;
  END IF;
END $$;
