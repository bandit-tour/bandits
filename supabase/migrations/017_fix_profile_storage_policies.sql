-- Fix profile avatar uploads: path check must match storage object names reliably.
-- Run in Supabase SQL Editor if earlier 013 policies still block uploads.

drop policy if exists "storage_bandits4_profile_insert_own" on storage.objects;
drop policy if exists "storage_bandits4_profile_update_own" on storage.objects;
drop policy if exists "storage_bandits4_profile_delete_own" on storage.objects;

-- INSERT: own folder only (path prefix profile_avatars/<uid>/)
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
