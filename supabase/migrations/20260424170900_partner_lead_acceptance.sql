alter table public.quotes
  add column if not exists partner_accept_token text,
  add column if not exists partner_accepted boolean not null default false,
  add column if not exists accepted_at timestamp with time zone,
  add column if not exists partner_email text,
  add column if not exists partner_name text,
  add column if not exists introduced boolean not null default false,
  add column if not exists introduced_at timestamp with time zone;

alter table public.quotes
  alter column status set default 'new';
