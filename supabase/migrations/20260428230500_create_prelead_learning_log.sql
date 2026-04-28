create extension if not exists pgcrypto;

create table if not exists public.prelead_learning_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamp with time zone not null default now(),
  source text not null,
  query_used text,
  source_url text not null,
  title text not null,
  snippet text not null,
  initial_score integer not null default 0,
  location_signal text not null default 'unknown',
  classifier_enabled boolean not null default false,
  ai_is_lead boolean,
  ai_confidence numeric,
  ai_reason text,
  rejection_reason text,
  inserted_to_pre_leads boolean not null default false,
  human_label text,
  human_notes text,
  constraint prelead_learning_log_human_label_check check (human_label in ('good', 'bad', 'maybe') or human_label is null)
);

create index if not exists prelead_learning_log_created_at_idx
  on public.prelead_learning_log (created_at desc);

create index if not exists prelead_learning_log_query_used_idx
  on public.prelead_learning_log (query_used);

create index if not exists prelead_learning_log_source_url_idx
  on public.prelead_learning_log (source_url);
