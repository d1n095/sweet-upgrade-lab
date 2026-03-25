ALTER TABLE public.work_items
  ADD COLUMN IF NOT EXISTS ai_pre_verify_status text,
  ADD COLUMN IF NOT EXISTS ai_pre_verify_result jsonb,
  ADD COLUMN IF NOT EXISTS ai_pre_verify_at timestamptz;