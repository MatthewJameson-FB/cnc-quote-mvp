alter table public.quotes
  add column if not exists introduced boolean not null default false,
  add column if not exists introduced_at timestamp with time zone,
  add column if not exists partner_email text,
  add column if not exists partner_name text;
