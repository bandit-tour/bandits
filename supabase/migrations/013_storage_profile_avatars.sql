-- Allow authenticated users to upload/update their own files under profile_avatars/{user_id}/ in public bucket profile_avatars.
-- Apply in Supabase SQL editor or via CLI. Bucket must already exist.

drop policy if exists "storage_bandits4_profile_insert_own" on storage.objects;
create policy "storage_bandits4_profile_insert_own"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'profile_avatars'
    and split_part(name, '/', 1) = 'profile_avatars'
    and split_part(name, '/', 2) = (auth.uid())::text
  );

drop policy if exists "storage_bandits4_profile_update_own" on storage.objects;
create policy "storage_bandits4_profile_update_own"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'profile_avatars'
    and split_part(name, '/', 1) = 'profile_avatars'
    and split_part(name, '/', 2) = (auth.uid())::text
  )
  with check (
    bucket_id = 'profile_avatars'
    and split_part(name, '/', 1) = 'profile_avatars'
    and split_part(name, '/', 2) = (auth.uid())::text
  );
