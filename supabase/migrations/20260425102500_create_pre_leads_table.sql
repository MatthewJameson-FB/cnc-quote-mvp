create extension if not exists pgcrypto;

create table if not exists public.pre_leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamp with time zone not null default now(),
  source text not null,
  source_url text not null unique,
  source_author text,
  title text not null,
  snippet text not null,
  matched_keywords text[] not null default '{}'::text[],
  detected_materials text[] not null default '{}'::text[],
  lead_score integer not null default 0,
  suggested_reply text not null,
  status text not null default 'new',
  reviewed_at timestamp with time zone,
  contacted_at timestamp with time zone
);
