-- Persistent store for issue appearance history across scan runs.
-- Each row records that a specific issue signature was seen in a specific scan run.
-- The unique constraint on (signature, scan_run_id) makes upserts safe and idempotent.

CREATE TABLE IF NOT EXISTS public.issue_history (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  signature     text        NOT NULL,
  scan_run_id   text        NOT NULL,
  timestamp     bigint      NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT issue_history_signature_scan_run_id_key UNIQUE (signature, scan_run_id)
);

-- Index for the primary query pattern: WHERE signature = ANY(...)
CREATE INDEX IF NOT EXISTS issue_history_signature_idx ON public.issue_history (signature);

-- Enable RLS; admins (authenticated users) may read/insert their own history rows.
ALTER TABLE public.issue_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read issue_history"
  ON public.issue_history FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert issue_history"
  ON public.issue_history FOR INSERT
  TO authenticated
  WITH CHECK (true);
