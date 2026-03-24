
ALTER TABLE public.work_items
  ADD COLUMN IF NOT EXISTS ai_confidence text DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS ai_detected boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_resolution_notes text,
  ADD COLUMN IF NOT EXISTS ai_category text,
  ADD COLUMN IF NOT EXISTS ai_assigned boolean DEFAULT false;
