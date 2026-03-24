ALTER TABLE public.bug_reports
ADD COLUMN IF NOT EXISTS ai_summary text,
ADD COLUMN IF NOT EXISTS ai_category text,
ADD COLUMN IF NOT EXISTS ai_severity text,
ADD COLUMN IF NOT EXISTS ai_tags text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS ai_clean_prompt text,
ADD COLUMN IF NOT EXISTS ai_processed_at timestamptz,
ADD COLUMN IF NOT EXISTS ai_approved boolean DEFAULT false;