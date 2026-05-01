-- Never evaluate ''::uuid. Parse operator_user_id config and free-form UUID text safely.

create or replace function public.safe_uuid_from_text(t text)
returns uuid
language sql
immutable
set search_path = public
as $$
  select case
    when t is null then null
    when trim(t) = '' then null
    when trim(t) ~ '^[0-9a-fA-F-]{36}$' then trim(t)::uuid
    else null
  end;
$$;

grant execute on function public.safe_uuid_from_text(text) to anon, authenticated, service_role;

-- Pilot moderation helper (SELECT policies).
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
      select public.safe_uuid_from_text(value)
      from public.app_public_config
      where key = 'operator_user_id'
      limit 1
    ),
    false
  );
$$;

grant execute on function public.is_pilot_operator() to authenticated;

-- Notifications → pilot_thread_identity sync (runs on every notifications insert).
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
  select public.safe_uuid_from_text(value) into v_operator
  from public.app_public_config
  where key = 'operator_user_id'
  limit 1;

  v_opening := coalesce(nullif(trim(NEW.message), ''), '');

  if NEW.type in ('local_friend', 'bandit_question')
     and v_operator is not null
     and NEW.user_id = v_operator
     and public.safe_uuid_from_text(NEW.reference_id) is not null then
    v_recipient := public.safe_uuid_from_text(NEW.reference_id);

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

  if NEW.type = 'signal_peer_delivery'
     and NEW.reference_type in ('signal_delivery', 'signal_delivery_peer')
     and public.safe_uuid_from_text(NEW.reference_id) is not null then
    v_delivery_id := public.safe_uuid_from_text(NEW.reference_id);
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

-- bandiTEAM insert → operator notification.
create or replace function public.scam_alerts_notify_operator()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_op uuid;
  v_rb uuid;
  v_name text;
  v_from text;
  rmsg text;
  rb_txt text;
begin
  select public.safe_uuid_from_text(c.value)
    into v_op
  from public.app_public_config c
  where c.key = 'operator_user_id'
  limit 1;
  if v_op is null then
    v_op := 'e6d8cb02-6f1a-40c0-96c4-b96961878407'::uuid;
  end if;

  v_from := 'Traveler';
  v_rb := null;
  rb_txt := case
    when NEW.reported_by is null then null
    else nullif(btrim(cast(NEW.reported_by as text)), '')
  end;
  if rb_txt is not null then
    v_rb := public.safe_uuid_from_text(rb_txt);
  end if;
  if v_rb is not null then
    begin
      select nullif(trim(up.name), '') into v_name
      from public.user_profile up
      where up.id = v_rb
      limit 1;
    exception
      when undefined_table then
        v_name := null;
    end;
    if v_name is not null and btrim(v_name) <> '' then
      v_from := v_name;
    end if;
  end if;

  rmsg := coalesce(NEW.title, '(untitled)') || E'\n\nFrom: ' || v_from || E'\n\n' || coalesce(NEW.location, '') || ' · ' || coalesce(NEW.city, '');

  begin
    insert into public.notifications (user_id, type, title, message, reference_id, reference_type, is_read)
    values (v_op, 'bandiTEAM_report', 'New bandiTEAM report', left(rmsg, 2000), NEW.id::text, 'scam_alert', false);
  exception
    when others then
      raise warning 'scam_alerts_notify_operator insert skipped: %', sqlerrm;
  end;
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
          select public.safe_uuid_from_text(value)
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
          select public.safe_uuid_from_text(value)
          from public.app_public_config
          where key = 'operator_user_id'
          limit 1
        )
      )
    )
  );
