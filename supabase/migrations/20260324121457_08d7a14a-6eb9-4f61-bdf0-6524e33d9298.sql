ALTER TABLE public.work_items
  ADD COLUMN IF NOT EXISTS depends_on text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS blocks text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS duplicate_of uuid,
  ADD COLUMN IF NOT EXISTS conflict_flag boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS execution_order integer DEFAULT 999,
  ADD COLUMN IF NOT EXISTS orchestrator_result jsonb DEFAULT '{}';