alter table public.pre_leads
  add column if not exists status text default 'active',
  add column if not exists dismissed_reason text,
  add column if not exists dismissed_at timestamptz;

alter table public.pre_leads
  alter column status set default 'active';
