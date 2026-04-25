alter table public.pre_leads
  add column if not exists location_signal text not null default 'unknown';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'pre_leads_location_signal_check'
  ) then
    alter table public.pre_leads
      add constraint pre_leads_location_signal_check
      check (location_signal in ('uk', 'unknown', 'outside_uk'));
  end if;
end $$;
