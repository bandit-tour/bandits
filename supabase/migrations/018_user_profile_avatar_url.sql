-- Persist avatar URL when auth user_metadata update is blocked or as backup.
alter table public.user_profile
  add column if not exists avatar_url text;
