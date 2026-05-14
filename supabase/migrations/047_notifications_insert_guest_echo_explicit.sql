-- Ensure travelers can always insert Ask Me / Local Friend mirror rows onto their own user_id,
-- even if `notifications_insert_own` drifted or was tightened in a remote branch.

alter table if exists public.notifications enable row level security;

drop policy if exists "notifications_insert_guest_mirror" on public.notifications;
create policy "notifications_insert_guest_mirror"
  on public.notifications
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and (
      (
        type = 'bandit_question'
        and reference_type = 'bandit_question_guest_echo'
        and reference_id is not null
        and btrim(reference_id) <> ''
      )
      or (
        type = 'local_friend'
        and reference_type = 'local_friend_guest_echo'
        and reference_id is not null
        and btrim(reference_id) <> ''
      )
    )
  );
