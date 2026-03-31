-- system_memory: stores scan/fix cycle results to prevent duplicate fixes
-- and increase confidence over time.

create table if not exists public.system_memory (
  id           uuid primary key default gen_random_uuid(),
  issue_hash   text not null,
  root_cause   text,
  fix          text,
  result       text,          -- 'success' | 'partial' | 'failure'
  success_rate integer,       -- 0–100
  created_at   timestamptz not null default now()
);

-- Index for deduplication lookups
create index if not exists system_memory_issue_hash_idx
  on public.system_memory (issue_hash);

-- RLS: only admins can read/write
alter table public.system_memory enable row level security;

create policy "Admins can manage system_memory"
  on public.system_memory
  for all
  using (
    exists (
      select 1 from public.user_roles
      where user_id = auth.uid()
        and role in ('admin', 'founder')
    )
  );
