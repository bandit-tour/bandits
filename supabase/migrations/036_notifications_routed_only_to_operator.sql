-- Prevent any secondary writer from routing Ask/LocalFriend to non-operator users.
-- Source-of-truth rule: guest sends always create exactly one operator-target request row.

alter table if exists public.notifications enable row level security;

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
        and user_id = (
          select (nullif(trim(value), ''))::uuid
          from public.app_public_config
          where key = 'operator_user_id'
          limit 1
        )
      )
      or (
        type = 'bandit_reply'
        and reference_type in ('operator_reply', 'operator_reply_local_friend', 'operator_reply_bandit_question')
        and reference_id is not null
      )
      or (
        type = 'live_alert'
        and reference_type = 'pilot_live_alert'
      )
      or (
        type = 'pilot_thread_echo'
        and reference_type in ('signal_delivery', 'presence_thread')
        and reference_id is not null
        and user_id = (
          select (nullif(trim(value), ''))::uuid
          from public.app_public_config
          where key = 'operator_user_id'
          limit 1
        )
      )
    )
  );
