-- Never cast blank config / reference_id text to uuid (avoids ''::uuid and invalid uuid text).

create or replace function public.is_pilot_operator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    auth.uid() is not null
    and auth.uid() = (
      select case
        when trim(value) = '' then null
        when trim(value) ~ '^[0-9a-fA-F-]{36}$' then trim(value)::uuid
        else null
      end
      from public.app_public_config
      where key = 'operator_user_id'
      limit 1
    ),
    false
  );
$$;

grant execute on function public.is_pilot_operator() to authenticated;

-- Aligns with migration 025 (safe text→uuid for operator + reference_id).
create or replace function public.sync_pilot_thread_identity_from_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_operator uuid;
  v_recipient uuid;
  v_bandit_id uuid;
  v_name text;
  v_avatar text;
  v_opening text;
  v_sender uuid;
  v_delivery_id uuid;
begin
  select case
    when trim(value) = '' then null
    when trim(value) ~ '^[0-9a-fA-F-]{36}$' then trim(value)::uuid
    else null
  end into v_operator
  from public.app_public_config
  where key = 'operator_user_id'
  limit 1;

  v_opening := coalesce(nullif(trim(NEW.message), ''), '');

  -- Pilot desk anchor rows: local friend / ask question to operator
  if NEW.type in ('local_friend', 'bandit_question')
     and v_operator is not null
     and NEW.user_id = v_operator
     and NEW.reference_id is not null
     and trim(NEW.reference_id) ~ '^[0-9a-fA-F-]{36}$' then
    v_recipient := case
      when trim(NEW.reference_id) = '' then null
      when trim(NEW.reference_id) ~ '^[0-9a-fA-F-]{36}$' then trim(NEW.reference_id)::uuid
      else null
    end;

    if NEW.type = 'bandit_question' and NEW.ask_target_bandit_id is not null then
      select b.id, b.name, coalesce(nullif(trim(b.face_image_url), ''), nullif(trim(b.image_url), ''), '')
        into v_bandit_id, v_name, v_avatar
      from public.bandit b
      where b.id = NEW.ask_target_bandit_id
      limit 1;
    else
      select b.id, b.name, coalesce(nullif(trim(b.face_image_url), ''), nullif(trim(b.image_url), ''), '')
        into v_bandit_id, v_name, v_avatar
      from public.user_bandit ub
      join public.bandit b on b.id = ub.bandit_id
      where ub.user_id = v_recipient
      limit 1;
    end if;

    if v_bandit_id is null then
      select b.id, b.name, coalesce(nullif(trim(b.face_image_url), ''), nullif(trim(b.image_url), ''), '')
        into v_bandit_id, v_name, v_avatar
      from public.bandit b
      where b.name ilike 'Neo'
      limit 1;
    end if;

    if v_name is null or trim(v_name) = '' then
      v_name := 'Neo';
    end if;

    insert into public.pilot_thread_identity (
      thread_root_notification_id,
      recipient_user_id,
      sender_persona_bandit_id,
      sender_persona_display_name,
      sender_persona_avatar_url,
      opening_message
    ) values (
      NEW.id,
      v_recipient,
      v_bandit_id,
      v_name,
      coalesce(v_avatar, ''),
      v_opening
    )
    on conflict (thread_root_notification_id) do update set
      recipient_user_id = excluded.recipient_user_id,
      sender_persona_bandit_id = excluded.sender_persona_bandit_id,
      sender_persona_display_name = excluded.sender_persona_display_name,
      sender_persona_avatar_url = excluded.sender_persona_avatar_url,
      opening_message = excluded.opening_message,
      updated_at = now();

    return NEW;
  end if;

  -- Guest arrival / bottle inbox row
  if NEW.type = 'signal_peer_delivery'
     and NEW.reference_type in ('signal_delivery', 'signal_delivery_peer')
     and NEW.reference_id is not null
     and trim(NEW.reference_id) ~ '^[0-9a-fA-F-]{36}$' then
    v_delivery_id := case
      when trim(NEW.reference_id) = '' then null
      when trim(NEW.reference_id) ~ '^[0-9a-fA-F-]{36}$' then trim(NEW.reference_id)::uuid
      else null
    end;
    v_recipient := NEW.user_id;

    select sd.sender_user_id into v_sender
    from public.signal_delivery sd
    where sd.id = v_delivery_id
    limit 1;

    if v_sender is not null then
      select b.id, b.name, coalesce(nullif(trim(b.face_image_url), ''), nullif(trim(b.image_url), ''), '')
        into v_bandit_id, v_name, v_avatar
      from public.user_bandit ub
      join public.bandit b on b.id = ub.bandit_id
      where ub.user_id = v_sender
      limit 1;
      if v_name is null or trim(v_name) = '' then
        select up.name into v_name from public.user_profile up where up.id = v_sender limit 1;
        v_avatar := '';
        v_bandit_id := null;
      end if;
    end if;

    if v_name is null or trim(v_name) = '' then
      select b.id, b.name, coalesce(nullif(trim(b.face_image_url), ''), nullif(trim(b.image_url), ''), '')
        into v_bandit_id, v_name, v_avatar
      from public.bandit b
      where b.name ilike '%smaragda%'
      limit 1;
    end if;

    if v_name is null or trim(v_name) = '' then
      select b.id, b.name, coalesce(nullif(trim(b.face_image_url), ''), nullif(trim(b.image_url), ''), '')
        into v_bandit_id, v_name, v_avatar
      from public.bandit b
      where b.name ilike 'Neo'
      limit 1;
    end if;

    if v_name is null or trim(v_name) = '' then
      v_name := 'Smaragda';
    end if;

    insert into public.pilot_thread_identity (
      thread_root_notification_id,
      recipient_user_id,
      sender_persona_bandit_id,
      sender_persona_display_name,
      sender_persona_avatar_url,
      opening_message
    ) values (
      NEW.id,
      v_recipient,
      v_bandit_id,
      v_name,
      coalesce(v_avatar, ''),
      v_opening
    )
    on conflict (thread_root_notification_id) do update set
      recipient_user_id = excluded.recipient_user_id,
      sender_persona_bandit_id = excluded.sender_persona_bandit_id,
      sender_persona_display_name = excluded.sender_persona_display_name,
      sender_persona_avatar_url = excluded.sender_persona_avatar_url,
      opening_message = excluded.opening_message,
      updated_at = now();
  end if;

  return NEW;
end;
$$;

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
