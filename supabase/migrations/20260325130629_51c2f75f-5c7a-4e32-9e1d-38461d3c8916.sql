
ALTER TABLE public.ai_read_log
  ADD COLUMN IF NOT EXISTS verify_status text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS verify_note text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS verified_by uuid DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ai_suggestion text DEFAULT NULL;
