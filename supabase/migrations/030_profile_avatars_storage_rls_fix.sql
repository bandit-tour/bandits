-- Fix: avatar upload fails with RLS ("new row violates row-level security policy", HTTP 400).
-- Object names are <user_uuid>/filename (bucket = profile_avatars) — not profile_avatars/<uid>/... .
-- This drops legacy policies that require wrong prefixes and recreates a single correct set.

drop policy if exists "storage_bandits4_profile_insert_own" on storage.objects;
drop policy if exists "storage_bandits4_profile_update_own" on storage.objects;
drop policy if exists "storage_bandits4_profile_delete_own" on storage.objects;
drop policy if exists "profile_avatars_insert_own" on storage.objects;
drop policy if exists "profile_avatars_update_own" on storage.objects;
drop policy if exists "profile_avatars_delete_own" on storage.objects;
drop policy if exists "profile_avatars_select_public" on storage.objects;
drop policy if exists "profile_avatars_select_anon_read" on storage.objects;
drop policy if exists "storage_bandits4_scam_insert_own" on storage.objects;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile_avatars',
  'profile_avatars',
  true,
  52428800,
  null
)
on conflict (id) do update
set
  public = true,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "profile_avatars_insert_own"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'profile_avatars'
    and split_part(name, '/', 1) = (auth.uid())::text
  );

create policy "profile_avatars_update_own"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'profile_avatars'
    and split_part(name, '/', 1) = (auth.uid())::text
  )
  with check (
    bucket_id = 'profile_avatars'
    and split_part(name, '/', 1) = (auth.uid())::text
  );

create policy "profile_avatars_delete_own"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'profile_avatars'
    and split_part(name, '/', 1) = (auth.uid())::text
  );

-- Browser loads avatar URL without session on storage; public read on objects in public bucket
create policy "profile_avatars_select_public"
  on storage.objects
  for select
  to public
  using (bucket_id = 'profile_avatars');

-- Scam report images: scam_reports/<userId>/<file>
create policy "storage_bandits4_scam_insert_own"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'profile_avatars'
    and split_part(name, '/', 1) = 'scam_reports'
    and split_part(name, '/', 2) = (auth.uid())::text
  );
