alter table public.pre_leads
  add column if not exists thread_context_summary jsonb;
