create table if not exists public.discovery_optimisation_reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  run_id uuid references public.discovery_runs(id) on delete set null,
  status text default 'draft',
  summary text,
  winning_patterns jsonb default '[]'::jsonb,
  weak_queries jsonb default '[]'::jsonb,
  duplicate_heavy_queries jsonb default '[]'::jsonb,
  recommended_queries jsonb default '[]'::jsonb,
  recommended_disabled_queries jsonb default '[]'::jsonb,
  reasoning jsonb default '{}'::jsonb,
  applied_at timestamptz
);

create index if not exists discovery_optimisation_reports_created_at_idx on public.discovery_optimisation_reports (created_at desc);
create index if not exists discovery_optimisation_reports_run_id_idx on public.discovery_optimisation_reports (run_id);
