-- Align notifications with Supabase auth and enforce per-user access.
alter table if exists public.notifications
  drop constraint if exists notifications_user_id_fkey;

alter table if exists public.notifications
  add constraint notifications_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

alter table if exists public.notifications enable row level security;

drop policy if exists "notifications_insert_own" on public.notifications;
create policy "notifications_insert_own"
  on public.notifications
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own"
  on public.notifications
  for select
  to authenticated
  using (auth.uid() = user_id);
