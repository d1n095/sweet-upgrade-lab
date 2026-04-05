-- Drop the scan_jobs mirror table and its sync trigger.
-- scan_runs is the single source of truth for scan state.

drop trigger if exists trg_sync_scan_job on public.scan_runs;
drop function if exists public.fn_sync_scan_job();
drop table if exists public.scan_jobs;
