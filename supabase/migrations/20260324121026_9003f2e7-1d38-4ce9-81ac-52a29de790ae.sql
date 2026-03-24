
-- System history table for completed work items
CREATE TABLE public.system_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_item_id text NOT NULL,
  title text NOT NULL,
  description text,
  item_type text NOT NULL DEFAULT 'general',
  source_type text,
  source_id text,
  priority text NOT NULL DEFAULT 'medium',
  assigned_to uuid,
  claimed_by uuid,
  created_by uuid,
  resolution_notes text,
  ai_review_status text DEFAULT 'pending',
  ai_review_result jsonb,
  ai_review_at timestamptz,
  work_item_created_at timestamptz,
  completed_at timestamptz,
  archived_at timestamptz DEFAULT now(),
  related_order_id uuid,
  snapshot_data jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.system_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read system_history" ON public.system_history
  FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff can insert system_history" ON public.system_history
  FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));

-- Add ai_review fields to work_items if not exist
DO $$ BEGIN
  ALTER TABLE public.work_items ADD COLUMN IF NOT EXISTS ai_review_status text DEFAULT 'pending';
  ALTER TABLE public.work_items ADD COLUMN IF NOT EXISTS ai_review_result jsonb;
  ALTER TABLE public.work_items ADD COLUMN IF NOT EXISTS ai_review_at timestamptz;
  ALTER TABLE public.work_items ADD COLUMN IF NOT EXISTS resolution_notes text;
EXCEPTION WHEN others THEN NULL;
END $$;

-- Index for fast queries
CREATE INDEX IF NOT EXISTS idx_system_history_archived_at ON public.system_history (archived_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_history_item_type ON public.system_history (item_type);
CREATE INDEX IF NOT EXISTS idx_system_history_work_item_id ON public.system_history (work_item_id);
