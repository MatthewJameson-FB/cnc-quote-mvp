alter table public.pre_leads
  add column if not exists should_reply boolean not null default false;
