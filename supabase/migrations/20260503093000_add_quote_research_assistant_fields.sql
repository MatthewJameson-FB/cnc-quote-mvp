alter table public.quotes
  add column if not exists research_summary text,
  add column if not exists possible_part_numbers text,
  add column if not exists useful_links jsonb,
  add column if not exists missing_requirements text,
  add column if not exists suggested_next_action text,
  add column if not exists research_status text,
  add column if not exists researched_at timestamptz;
