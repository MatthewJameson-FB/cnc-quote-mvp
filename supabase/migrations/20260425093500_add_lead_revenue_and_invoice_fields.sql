alter table public.quotes
  add column if not exists job_value numeric,
  add column if not exists quoted_at timestamp with time zone,
  add column if not exists won_at timestamp with time zone,
  add column if not exists lost_at timestamp with time zone,
  add column if not exists invoice_status text not null default 'unbilled',
  add column if not exists invoice_notes text,
  add column if not exists invoiced_at timestamp with time zone,
  add column if not exists paid_at timestamp with time zone;

alter table public.quotes
  alter column status set default 'new';

alter table public.quotes
  alter column invoice_status set default 'unbilled';
