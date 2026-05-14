-- Ask Me / Local Friend: notifications_insert_routed must resolve operator_user_id even when
-- app_public_config SELECT is blocked for the inserting role (subquery in RLS returned NULL → RLS fail).

create or replace function public.pilot_operator_user_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select public.safe_uuid_from_text(value)
      from public.app_public_config
      where key = 'operator_user_id'
      limit 1
    ),
    'e6d8cb02-6f1a-40c0-96c4-b96961878407'::uuid
  );
$$;

grant execute on function public.pilot_operator_user_id() to anon, authenticated, service_role;

insert into public.app_public_config (key, value)
values ('operator_user_id', 'e6d8cb02-6f1a-40c0-96c4-b96961878407')
on conflict (key) do update
  set value = excluded.value,
      updated_at = now();

alter table if exists public.app_public_config enable row level security;

drop policy if exists "app_public_config_select_all" on public.app_public_config;
create policy "app_public_config_select_all"
  on public.app_public_config
  for select
  to anon, authenticated
  using (true);

grant select on public.app_public_config to anon, authenticated;

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
        and user_id = public.pilot_operator_user_id()
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
        and user_id = public.pilot_operator_user_id()
      )
    )
  );

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
