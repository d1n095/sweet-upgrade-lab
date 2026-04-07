-- Clear stuck running scans that pre-date this fix.
-- Any scan that has been running for more than 10 minutes is considered stuck
-- (previously caused by the structure_map ReferenceError in the finalize handler).
UPDATE public.scan_runs
SET
  status        = 'error',
  error_message = 'Cleared by migration: scan was stuck due to finalize handler bug',
  completed_at  = now()
WHERE
  status = 'running'
  AND started_at < now() - interval '10 minutes';
