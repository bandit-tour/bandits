create table if not exists public.scam_alerts (
  id uuid primary key default gen_random_uuid(),
  city text not null,
  location text not null,
  title text not null,
  description text not null,
  reported_by text,
  created_at timestamptz not null default now()
);

