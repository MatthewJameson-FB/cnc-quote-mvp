alter table public.pre_leads
  add column if not exists manual_notes text;
