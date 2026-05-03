create table if not exists public.discovery_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz default now(),
  finished_at timestamptz,
  trigger_type text,
  status text,
  searches_used int default 0,
  fetched int default 0,
  deduped int default 0,
  hard_rejected_before_ai int default 0,
  sent_to_ai int default 0,
  ai_accepted int default 0,
  ai_rejected int default 0,
  final_rejected_after_ai int default 0,
  inserted int default 0,
  duplicates_skipped int default 0,
  quota_exhausted boolean default false,
  error_message text,
  summary jsonb default '{}'::jsonb
);

create table if not exists public.discovery_query_run_stats (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references public.discovery_runs(id) on delete cascade,
  query text,
  group_name text,
  fetched int default 0,
  sent_to_ai int default 0,
  accepted int default 0,
  inserted int default 0,
  duplicates int default 0,
  low_quality_count int default 0,
  reject_reasons jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create index if not exists discovery_runs_started_at_idx on public.discovery_runs (started_at desc);
create index if not exists discovery_query_run_stats_run_id_idx on public.discovery_query_run_stats (run_id);
create index if not exists discovery_query_run_stats_query_idx on public.discovery_query_run_stats (query);
