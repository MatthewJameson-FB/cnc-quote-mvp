alter table public.pre_leads
  add column if not exists vehicle_make text,
  add column if not exists vehicle_model text,
  add column if not exists vehicle_year text,
  add column if not exists model_specifics text,
  add column if not exists issue_type text,
  add column if not exists size_estimate text,
  add column if not exists search_context text;

alter table public.quotes
  add column if not exists vehicle_make text,
  add column if not exists vehicle_model text,
  add column if not exists vehicle_year text,
  add column if not exists model_specifics text,
  add column if not exists issue_type text,
  add column if not exists size_estimate text,
  add column if not exists search_context text;
