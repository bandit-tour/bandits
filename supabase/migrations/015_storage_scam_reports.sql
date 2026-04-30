-- Authenticated uploads to scam_reports/{user_id}/ in profile_avatars (bandiTEAM images).

drop policy if exists "storage_bandits4_scam_insert_own" on storage.objects;
create policy "storage_bandits4_scam_insert_own"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'profile_avatars'
    and split_part(name, '/', 1) = 'scam_reports'
    and split_part(name, '/', 2) = (auth.uid())::text
  );
