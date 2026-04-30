-- Backend foundation for profile persistence.
-- 1) Ensure public.user_profile exists with required columns.
-- 2) Ensure strict own-row RLS.
-- 3) Ensure profile_avatars storage bucket exists.
-- 4) Ensure authenticated users can manage only their own avatar object path.

create table if not exists public.user_profile (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  city text,
  vibe text,
  avatar_url text,
  updated_at timestamptz not null default now()
);

-- Compatibility with earlier app schema.
alter table public.user_profile add column if not exists name text;
alter table public.user_profile add column if not exists interests text[] not null default '{}';
alter table public.user_profile add column if not exists location_permission boolean not null default false;
alter table public.user_profile add column if not exists hotel_id uuid;
alter table public.user_profile add column if not exists entry_source text;
alter table public.user_profile add column if not exists created_at timestamptz not null default now();
alter table public.user_profile add column if not exists current_signal_id uuid;
alter table public.user_profile add column if not exists last_signal_at timestamptz;
alter table public.user_profile add column if not exists signal_history_ids uuid[] not null default '{}'::uuid[];

update public.user_profile
set display_name = coalesce(nullif(display_name, ''), nullif(name, '')),
    vibe = coalesce(vibe, ''),
    city = coalesce(city, ''),
    updated_at = now()
where true;

alter table public.user_profile enable row level security;

drop policy if exists "user_profile_select_own" on public.user_profile;
drop policy if exists "user_profile_insert_own" on public.user_profile;
drop policy if exists "user_profile_update_own" on public.user_profile;

create policy "user_profile_select_own"
  on public.user_profile
  for select
  to authenticated
  using (auth.uid() = id);

create policy "user_profile_insert_own"
  on public.user_profile
  for insert
  to authenticated
  with check (auth.uid() = id);

create policy "user_profile_update_own"
  on public.user_profile
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Storage bucket for profile avatars (public URLs are used by app).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile_avatars',
  'profile_avatars',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']
)
on conflict (id) do update
set public = excluded.public;

-- Own-path policies in profile_avatars bucket: <uid>/...
drop policy if exists "profile_avatars_insert_own" on storage.objects;
drop policy if exists "profile_avatars_update_own" on storage.objects;
drop policy if exists "profile_avatars_delete_own" on storage.objects;
drop policy if exists "profile_avatars_select_public" on storage.objects;

create policy "profile_avatars_insert_own"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'profile_avatars'
    and name like (auth.uid())::text || '/%'
  );

create policy "profile_avatars_update_own"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'profile_avatars'
    and name like (auth.uid())::text || '/%'
  )
  with check (
    bucket_id = 'profile_avatars'
    and name like (auth.uid())::text || '/%'
  );

create policy "profile_avatars_delete_own"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'profile_avatars'
    and name like (auth.uid())::text || '/%'
  );

create policy "profile_avatars_select_public"
  on storage.objects
  for select
  to public
  using (bucket_id = 'profile_avatars');

-- Backward compatibility: current app uploads to profile_avatars/<uid>/...
drop policy if exists "storage_bandits4_profile_insert_own" on storage.objects;
drop policy if exists "storage_bandits4_profile_update_own" on storage.objects;
drop policy if exists "storage_bandits4_profile_delete_own" on storage.objects;

create policy "storage_bandits4_profile_insert_own"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'profile_avatars'
    and name like 'profile_avatars/' || (auth.uid())::text || '/%'
  );

create policy "storage_bandits4_profile_update_own"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'profile_avatars'
    and name like 'profile_avatars/' || (auth.uid())::text || '/%'
  )
  with check (
    bucket_id = 'profile_avatars'
    and name like 'profile_avatars/' || (auth.uid())::text || '/%'
  );

create policy "storage_bandits4_profile_delete_own"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'profile_avatars'
    and name like 'profile_avatars/' || (auth.uid())::text || '/%'
  );
