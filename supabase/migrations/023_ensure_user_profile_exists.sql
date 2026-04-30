-- Pilot recovery: ensure public.user_profile exists when the app was pointed at a
-- Supabase project that never applied earlier migrations (PostgREST: relation does not exist).

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

alter table public.user_profile add column if not exists avatar_url text;
alter table public.user_profile add column if not exists current_signal_id uuid;
alter table public.user_profile add column if not exists last_signal_at timestamptz;
alter table public.user_profile
  add column if not exists signal_history_ids uuid[] not null default '{}'::uuid[];

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

-- Optional peer-read policy (requires signal_delivery from migration 021).
do $outer$
begin
  if to_regclass('public.signal_delivery') is not null then
    execute $exec$
      drop policy if exists "user_profile_select_signal_peer_revealed" on public.user_profile;
      create policy "user_profile_select_signal_peer_revealed"
        on public.user_profile for select to authenticated
        using (
          exists (
            select 1 from public.signal_delivery d
            where d.sender_user_id = user_profile.id
              and d.receiver_user_id = auth.uid()
              and d.reveal_status = 'revealed'
              and d.sender_user_id is not null
          )
        );
    $exec$;
  end if;
end
$outer$;
