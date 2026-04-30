alter table public.quotes
  add column if not exists status text default 'active',
  add column if not exists dismissed_reason text,
  add column if not exists dismissed_at timestamptz,
  add column if not exists contacted_at timestamptz,
  add column if not exists converted_at timestamptz;

alter table public.quotes
  alter column status set default 'active';
