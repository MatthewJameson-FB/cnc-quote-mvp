alter table public.quotes
  add column if not exists description text,
  add column if not exists quote_message text,
  add column if not exists quote_sent_at timestamptz;
