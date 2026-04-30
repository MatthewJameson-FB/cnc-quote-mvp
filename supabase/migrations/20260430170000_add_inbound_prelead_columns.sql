alter table public.pre_leads
  add column if not exists post_text text,
  add column if not exists image_url text,
  add column if not exists contact_email text,
  add column if not exists value_score integer,
  add column if not exists value_tier text,
  add column if not exists value_reason text;
