-- Fix HTTP 400 on getPublicUrl() for profile_avatars: bucket must be public, and
-- unauthenticated (anon) must be allowed to read objects so browser <img> requests work.

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
  name = excluded.name;

-- Browser loads avatar URL without a Supabase session; that request uses the anon role.
drop policy if exists "profile_avatars_select_anon_read" on storage.objects;
create policy "profile_avatars_select_anon_read"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'profile_avatars');
