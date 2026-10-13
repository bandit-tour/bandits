-- Guest trip lifecycle — checkout is a STATE SHIFT, not EXIT.
-- Account + membership stay alive; only access level changes.

-- ---------------------------------------------------------------------------
-- Enum-like text constraints (portable; no PG ENUM migration pain)
-- States: PRE_TRIP | ACTIVE_STAY | AFTER_TRIP | NEXT_TRIP_PLANNING | REACTIVATED
-- Access: FULL_STAY | AFTER_TRIP | PRE_TRIP | LOCAL_AT_HOME | PLANNING
-- ---------------------------------------------------------------------------

create table if not exists public.guest_stays (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  hotel_id text,
  hotel_slug text,
  hotel_name text,
  city text not null default '',
  room_number text,
  booking_number text not null,
  booking_source text default 'manual',
  status text not null default 'confirmed'
    check (status in ('confirmed', 'checked_in', 'checked_out', 'cancelled', 'upcoming')),
  check_in_at timestamptz,
  check_out_at timestamptz,
  planned_check_in_at timestamptz,
  planned_check_out_at timestamptz,
  is_active boolean not null default false,
  reactivated_from_stay_id uuid null references public.guest_stays (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_guest_stays_user on public.guest_stays (user_id);
create index if not exists idx_guest_stays_booking on public.guest_stays (booking_number);
create index if not exists idx_guest_stays_hotel_slug on public.guest_stays (hotel_slug);
create index if not exists idx_guest_stays_active on public.guest_stays (user_id, is_active) where is_active = true;

create unique index if not exists idx_guest_stays_user_booking
  on public.guest_stays (user_id, booking_number);

-- One lifecycle row per guest (current mode + access)
create table if not exists public.guest_lifecycle (
  user_id uuid primary key references auth.users (id) on delete cascade,
  state text not null default 'PRE_TRIP'
    check (state in ('PRE_TRIP', 'ACTIVE_STAY', 'AFTER_TRIP', 'NEXT_TRIP_PLANNING', 'REACTIVATED')),
  access_level text not null default 'PRE_TRIP'
    check (access_level in ('FULL_STAY', 'AFTER_TRIP', 'PRE_TRIP', 'LOCAL_AT_HOME', 'PLANNING')),
  mode text not null default 'PRE_TRIP_MODE'
    check (mode in ('PRE_TRIP_MODE', 'DURING_TRIP_MODE', 'AFTER_TRIP_MODE', 'PLANNING_MODE', 'REACTIVATED_FULL_MODE')),
  active_stay_id uuid null references public.guest_stays (id) on delete set null,
  last_city text,
  last_hotel_slug text,
  last_hotel_name text,
  next_trip_intent text,
  next_destination text,
  last_checked_out_at timestamptz,
  last_reactivated_at timestamptz,
  last_activation_at timestamptz,
  concierge_entitled boolean not null default false,
  taste_summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_guest_lifecycle_state on public.guest_lifecycle (state);
create index if not exists idx_guest_lifecycle_hotel on public.guest_lifecycle (last_hotel_slug);

-- Persistent City Memory / taste graph (survives months)
create table if not exists public.guest_city_memory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  city text not null,
  kind text not null
    check (kind in (
      'saved_place', 'liked_place', 'neighborhood', 'followed_bandit',
      'guide', 'experience', 'smarttraveler', 'bottle_journey',
      'category', 'destination_visited', 'spot'
    )),
  entity_id text,
  title text not null default '',
  subtitle text,
  category text,
  neighborhood text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_guest_city_memory_user on public.guest_city_memory (user_id);
create index if not exists idx_guest_city_memory_city on public.guest_city_memory (user_id, city);
create index if not exists idx_guest_city_memory_kind on public.guest_city_memory (user_id, kind);
create unique index if not exists idx_guest_city_memory_unique
  on public.guest_city_memory (user_id, city, kind, (coalesce(entity_id, '')));

-- Lifecycle event log (analytics / CRM / automation)
create table if not exists public.guest_lifecycle_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  event_type text not null,
  stay_id uuid null references public.guest_stays (id) on delete set null,
  from_state text,
  to_state text,
  access_level text,
  city text,
  hotel_slug text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_guest_lifecycle_events_user
  on public.guest_lifecycle_events (user_id, created_at desc);
create index if not exists idx_guest_lifecycle_events_type
  on public.guest_lifecycle_events (event_type, created_at desc);

-- RLS
alter table public.guest_stays enable row level security;
alter table public.guest_lifecycle enable row level security;
alter table public.guest_city_memory enable row level security;
alter table public.guest_lifecycle_events enable row level security;

drop policy if exists guest_stays_select_own on public.guest_stays;
create policy guest_stays_select_own on public.guest_stays
  for select using (auth.uid() = user_id);

drop policy if exists guest_stays_insert_own on public.guest_stays;
create policy guest_stays_insert_own on public.guest_stays
  for insert with check (auth.uid() = user_id);

drop policy if exists guest_stays_update_own on public.guest_stays;
create policy guest_stays_update_own on public.guest_stays
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists guest_lifecycle_select_own on public.guest_lifecycle;
create policy guest_lifecycle_select_own on public.guest_lifecycle
  for select using (auth.uid() = user_id);

drop policy if exists guest_lifecycle_insert_own on public.guest_lifecycle;
create policy guest_lifecycle_insert_own on public.guest_lifecycle
  for insert with check (auth.uid() = user_id);

drop policy if exists guest_lifecycle_update_own on public.guest_lifecycle;
create policy guest_lifecycle_update_own on public.guest_lifecycle
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists guest_city_memory_select_own on public.guest_city_memory;
create policy guest_city_memory_select_own on public.guest_city_memory
  for select using (auth.uid() = user_id);

drop policy if exists guest_city_memory_insert_own on public.guest_city_memory;
create policy guest_city_memory_insert_own on public.guest_city_memory
  for insert with check (auth.uid() = user_id);

drop policy if exists guest_city_memory_update_own on public.guest_city_memory;
create policy guest_city_memory_update_own on public.guest_city_memory
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists guest_city_memory_delete_own on public.guest_city_memory;
create policy guest_city_memory_delete_own on public.guest_city_memory
  for delete using (auth.uid() = user_id);

drop policy if exists guest_lifecycle_events_select_own on public.guest_lifecycle_events;
create policy guest_lifecycle_events_select_own on public.guest_lifecycle_events
  for select using (auth.uid() = user_id);

drop policy if exists guest_lifecycle_events_insert_own on public.guest_lifecycle_events;
create policy guest_lifecycle_events_insert_own on public.guest_lifecycle_events
  for insert with check (auth.uid() = user_id);

comment on table public.guest_lifecycle is
  'Persisted trip OS state. Checkout → AFTER_TRIP (memory+discovery+planning). New booking → REACTIVATED.';
comment on table public.guest_stays is
  'Guest hotel stays attached to the same account. New stays are ADDED, never reset memory.';
comment on table public.guest_city_memory is
  'Personal city taste graph — survives months after checkout.';
