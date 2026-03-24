ALTER TABLE public.work_items
ADD COLUMN IF NOT EXISTS ignored boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS ignored_reason text,
ADD COLUMN IF NOT EXISTS ignored_at timestamptz,
ADD COLUMN IF NOT EXISTS ai_root_causes jsonb,
ADD COLUMN IF NOT EXISTS human_selected_cause text,
ADD COLUMN IF NOT EXISTS human_custom_cause text,
ADD COLUMN IF NOT EXISTS human_custom_fix text,
ADD COLUMN IF NOT EXISTS ai_overrides jsonb DEFAULT '[]'::jsonb;