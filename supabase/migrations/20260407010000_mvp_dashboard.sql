-- MVP Dashboard: user-scoped data access
--
-- 1. Add user_id to issue_history so rows are tied to the user who recorded them.
-- 2. Allow authenticated users to read / insert their OWN scan_runs.
-- 3. Allow authenticated users to read their OWN work_items.
--    (Existing "Staff can …" policies remain unchanged — these are additive.)

-- ── issue_history.user_id ──────────────────────────────────────────────────
ALTER TABLE public.issue_history
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS issue_history_user_id_idx ON public.issue_history (user_id);

-- Tighten existing SELECT policy: user sees rows they own (or un-owned legacy rows)
DROP POLICY IF EXISTS "Authenticated users can read issue_history" ON public.issue_history;
CREATE POLICY "Users can read own issue_history"
  ON public.issue_history FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR user_id IS NULL);

-- Tighten INSERT policy: new rows must carry the caller's uid
DROP POLICY IF EXISTS "Authenticated users can insert issue_history" ON public.issue_history;
CREATE POLICY "Users can insert own issue_history"
  ON public.issue_history FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- ── scan_runs: self-read ───────────────────────────────────────────────────
-- Staff policy already exists; add a second policy so non-staff users can
-- read their own runs (started_by = auth.uid()).
CREATE POLICY IF NOT EXISTS "Users can read own scan_runs"
  ON public.scan_runs FOR SELECT
  TO authenticated
  USING (started_by = auth.uid());

-- ── work_items: self-read ─────────────────────────────────────────────────
-- Staff policy already exists; add a second policy so users can read items
-- they created (created_by = auth.uid()).
CREATE POLICY IF NOT EXISTS "Users can read own work_items"
  ON public.work_items FOR SELECT
  TO authenticated
  USING (created_by = auth.uid());
