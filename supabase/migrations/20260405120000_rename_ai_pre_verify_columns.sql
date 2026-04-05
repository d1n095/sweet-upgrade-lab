-- Rename ai_pre_verify_* columns to pre_verify_* in work_items
-- Removes AI-prefixed naming from pre-verification columns to reflect rule-based verification

DO $$ BEGIN
  -- work_items: ai_pre_verify_status → pre_verify_status
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'work_items' AND column_name = 'ai_pre_verify_status') THEN
    ALTER TABLE public.work_items RENAME COLUMN ai_pre_verify_status TO pre_verify_status;
  END IF;

  -- work_items: ai_pre_verify_result → pre_verify_result
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'work_items' AND column_name = 'ai_pre_verify_result') THEN
    ALTER TABLE public.work_items RENAME COLUMN ai_pre_verify_result TO pre_verify_result;
  END IF;

  -- work_items: ai_pre_verify_at → pre_verify_at
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'work_items' AND column_name = 'ai_pre_verify_at') THEN
    ALTER TABLE public.work_items RENAME COLUMN ai_pre_verify_at TO pre_verify_at;
  END IF;
END $$;
