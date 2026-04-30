-- Enable true hard-delete for notification rows owned by the signed-in user.
-- Required for Pilot Desk / Inbox deletion to remove DB records, not just hide.

alter table if exists public.notifications enable row level security;

drop policy if exists "notifications_delete_own" on public.notifications;
create policy "notifications_delete_own"
  on public.notifications
  for delete
  to authenticated
  using (auth.uid() = user_id);
-- Enable true hard-delete for notification rows owned by the signed-in user.
-- Required for Pilot Desk / Inbox deletion to remove DB records, not just hide.

alter table if exists public.notifications enable row level security;

drop policy if exists "notifications_delete_own" on public.notifications;
create policy "notifications_delete_own"
  on public.notifications
  for delete
  to authenticated
  using (auth.uid() = user_id);
