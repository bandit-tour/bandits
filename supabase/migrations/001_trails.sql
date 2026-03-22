-- Trails table
create table if not exists public.trails (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  mood text not null,
  duration text not null,
  bandit_id uuid not null references public.bandit(id) on delete cascade
);

create index if not exists idx_trails_bandit_id on public.trails(bandit_id);

-- Trail stops table (spot_id nullable for stops without matching spots)
create table if not exists public.trail_stops (
  id uuid primary key default gen_random_uuid(),
  trail_id uuid not null references public.trails(id) on delete cascade,
  spot_id uuid references public.spots(id) on delete set null,
  position int not null,
  note text,
  stop_name text not null
);

create index if not exists idx_trail_stops_trail_id on public.trail_stops(trail_id);
