alter table public.quotes
  add column if not exists overall_width text,
  add column if not exists overall_height text,
  add column if not exists depth_thickness text,
  add column if not exists hole_spacing text,
  add column if not exists clip_spacing text,
  add column if not exists scale_reference_photo text,
  add column if not exists fitment_notes text;
