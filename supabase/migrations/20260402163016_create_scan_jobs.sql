-- scan_jobs: deterministic job tracking table
-- Single source of truth for frontend progress reads.
-- Populated automatically by trigger on scan_runs.

create table if not exists public.scan_jobs (
  id          uuid primary key,
  status      text not null check (status in ('pending', 'running', 'done', 'failed')) default 'pending',
  progress    integer not null default 0 check (progress >= 0 and progress <= 100),
  current_step text not null default '',
  total_steps integer not null default 0,
  error       text,
  started_at  timestamptz,
  updated_at  timestamptz not null default now()
);

-- RLS: admins may read; service role writes via trigger
alter table public.scan_jobs enable row level security;

create policy "admins can read scan_jobs"
  on public.scan_jobs for select
  using (
    exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin', 'founder', 'it', 'support', 'moderator')
    )
  );

-- Enable Realtime for push-based progress updates (no polling required)
alter publication supabase_realtime add table public.scan_jobs;

-- Trigger function: keep scan_jobs in sync with scan_runs
create or replace function public.sync_scan_run_to_job()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.scan_jobs (
    id,
    status,
    progress,
    current_step,
    total_steps,
    error,
    started_at,
    updated_at
  )
  values (
    new.id,
    case
      when new.status = 'done'    then 'done'
      when new.status = 'error'   then 'failed'
      when new.status = 'running' then 'running'
      else 'pending'
    end,
    coalesce(new.progress, 0),
    coalesce(new.current_step_label, ''),
    coalesce(new.total_steps, 0),
    case when new.status = 'error' then new.error_message else null end,
    new.started_at,
    now()
  )
  on conflict (id) do update set
    status      = excluded.status,
    progress    = excluded.progress,
    current_step = excluded.current_step,
    total_steps = excluded.total_steps,
    error       = excluded.error,
    started_at  = excluded.started_at,
    updated_at  = now();

  return new;
end;
$$;

-- Attach trigger to scan_runs
drop trigger if exists trg_sync_scan_job on public.scan_runs;
create trigger trg_sync_scan_job
  after insert or update on public.scan_runs
  for each row execute function public.sync_scan_run_to_job();
