-- Pilot quick profile (anonymous or OAuth users). No email/phone stored here.
create table if not exists public.user_profile (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '',
  interests text[] not null default '{}',
  city text not null default '',
  location_permission boolean not null default false,
  hotel_id uuid null,
  entry_source text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_profile_hotel_id on public.user_profile (hotel_id) where hotel_id is not null;

alter table public.user_profile enable row level security;

drop policy if exists "user_profile_select_own" on public.user_profile;
create policy "user_profile_select_own"
  on public.user_profile for select
  using (auth.uid() = id);

drop policy if exists "user_profile_insert_own" on public.user_profile;
create policy "user_profile_insert_own"
  on public.user_profile for insert
  with check (auth.uid() = id);

drop policy if exists "user_profile_update_own" on public.user_profile;
create policy "user_profile_update_own"
  on public.user_profile for update
  using (auth.uid() = id)
  with check (auth.uid() = id);
