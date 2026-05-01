alter table public.quotes
  add column if not exists part_type text,
  add column if not exists manufacturable text,
  add column if not exists cad_required text,
  add column if not exists internal_notes text,
  add column if not exists research_notes text,
  add column if not exists cad_cost_min numeric,
  add column if not exists cad_cost_max numeric,
  add column if not exists manufacturing_cost_min numeric,
  add column if not exists manufacturing_cost_max numeric,
  add column if not exists total_estimate_min numeric,
  add column if not exists total_estimate_max numeric,
  add column if not exists estimate_confidence text;
