alter table public.pre_leads
  add column if not exists reviewed_at timestamp with time zone,
  add column if not exists contacted_at timestamp with time zone;

alter table public.pre_leads
  alter column status set default 'new';
