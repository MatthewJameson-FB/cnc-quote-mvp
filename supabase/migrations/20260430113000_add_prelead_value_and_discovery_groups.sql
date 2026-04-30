alter table public.pre_leads
  add column if not exists value_tier text not null default 'low',
  add column if not exists value_score integer not null default 0,
  add column if not exists value_reason text not null default 'baseline';

create table if not exists public.discovery_groups (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('facebook', 'instagram')),
  name text not null,
  url text not null,
  location text default 'UK',
  category text,
  priority int default 3,
  notes text,
  active boolean default true,
  last_checked_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists discovery_groups_source_idx
on public.discovery_groups(source);

create index if not exists discovery_groups_active_idx
on public.discovery_groups(active);

create table if not exists public.discovery_group_events (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.discovery_groups(id) on delete cascade,
  search_query text,
  opened_at timestamptz default now(),
  resulted_in_manual_lead boolean default false,
  manual_lead_id uuid,
  notes text
);

insert into public.discovery_groups (source, name, url, location, category, priority, active)
select * from (
  values
    ('facebook', 'UK DIY, Interior and Exterior, Help, Advice and Chat', 'https://www.facebook.com/groups/216979228896969/', 'UK', 'DIY', 3, true),
    ('facebook', 'DIY Home Repairs Forum, help and advice', 'https://www.facebook.com/groups/289146638443109/', 'UK', 'DIY / home repair', 3, true),
    ('facebook', 'Building, Construction, DIY and Interior Design UK', 'https://www.facebook.com/groups/155364951462919/', 'UK', 'DIY / construction', 2, true),
    ('facebook', 'Caravan Motorhome & Camper Spares for Sale/Wanted UK', 'https://www.facebook.com/groups/285841038905268/', 'UK', 'caravan / spares', 5, true),
    ('facebook', 'Cheap camper/motorhome parts UK', 'https://www.facebook.com/groups/322434968574917/', 'UK', 'caravan / parts', 5, true)
) as seed(source, name, url, location, category, priority, active)
where not exists (
  select 1 from public.discovery_groups existing where existing.url = seed.url
);
