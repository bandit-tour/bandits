-- Enable pilot operator-routing for notifications without disabling existing own-user RLS.
-- Keep own insert/select policy and add a scoped routed insert policy.

alter table if exists public.notifications enable row level security;

drop policy if exists "notifications_insert_own" on public.notifications;
create policy "notifications_insert_own"
  on public.notifications
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "notifications_insert_routed" on public.notifications;
create policy "notifications_insert_routed"
  on public.notifications
  for insert
  to authenticated
  with check (
    auth.uid() <> user_id
    and (
      (
        type in ('local_friend', 'bandit_question')
        and reference_type in ('local_friend_request', 'bandit_question_request')
        and reference_id = auth.uid()::text
      )
      or (
        type = 'bandit_reply'
        and reference_type = 'operator_reply'
        and reference_id is not null
      )
      or (
        type = 'live_alert'
        and reference_type = 'pilot_live_alert'
      )
    )
  );
