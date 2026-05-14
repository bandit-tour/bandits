-- Guest presence chat lines (Send Signal) + pilot echo for operator inbox.

create table if not exists public.presence_thread_message (
  id uuid primary key default gen_random_uuid(),
  root_notification_id uuid not null references public.notifications (id) on delete cascade,
  author_user_id uuid not null references auth.users (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_presence_thread_message_root
  on public.presence_thread_message (root_notification_id, created_at asc);

alter table public.presence_thread_message enable row level security;

drop policy if exists "presence_thread_message_select" on public.presence_thread_message;
create policy "presence_thread_message_select"
  on public.presence_thread_message
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.notifications n
      where n.id = root_notification_id
        and n.user_id = auth.uid()
    )
    or exists (
      select 1
      from public.app_public_config c
      where c.key = 'operator_user_id'
        and trim(c.value) = auth.uid()::text
    )
  );

drop policy if exists "presence_thread_message_insert" on public.presence_thread_message;
create policy "presence_thread_message_insert"
  on public.presence_thread_message
  for insert
  to authenticated
  with check (
    author_user_id = auth.uid()
    and exists (
      select 1
      from public.notifications n
      where n.id = root_notification_id
        and n.user_id = auth.uid()
        and n.type = 'presence_reply'
    )
  );

-- Guest may route a read receipt / echo to operator (pilot sees every line).
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
      or (
        type = 'pilot_thread_echo'
        and reference_type in ('signal_delivery', 'presence_thread')
        and reference_id is not null
        and user_id = (
          select case
            when trim(value) = '' then null
            when trim(value) ~ '^[0-9a-fA-F-]{36}$' then trim(value)::uuid
            else null
          end
          from public.app_public_config
          where key = 'operator_user_id'
          limit 1
        )
      )
    )
  );

-- Allow guests to correct their own arrival row text (keeps DB in sync with network_signal).
drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own"
  on public.notifications
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
