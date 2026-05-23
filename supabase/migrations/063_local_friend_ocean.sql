-- Travel in a Bottle (pilot MVP): Local Friend messages float in an ocean queue for QR discovery.
-- Operator / Pilot Desk routing is unchanged; this is additive.

create table if not exists public.local_friend_ocean_float (
  id uuid primary key default gen_random_uuid(),
  thread_root_notification_id uuid not null references public.notifications (id) on delete cascade,
  sender_user_id uuid not null references auth.users (id) on delete cascade,
  message_body text not null,
  sender_persona_name text not null default 'Traveler',
  status text not null default 'floating'
    constraint local_friend_ocean_float_status_check check (status in ('floating', 'claimed')),
  claimed_by_user_id uuid references auth.users (id) on delete set null,
  claimed_at timestamptz,
  claim_notification_id uuid references public.notifications (id) on delete set null,
  reveal_status text not null default 'hidden'
    constraint local_friend_ocean_float_reveal_check check (reveal_status in ('hidden', 'revealed')),
  revealed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_local_friend_ocean_float_floating
  on public.local_friend_ocean_float (created_at asc)
  where status = 'floating';

create index if not exists idx_local_friend_ocean_float_sender
  on public.local_friend_ocean_float (sender_user_id, created_at desc);

create index if not exists idx_local_friend_ocean_float_claimed_receiver
  on public.local_friend_ocean_float (claimed_by_user_id, claimed_at desc)
  where claimed_by_user_id is not null;

create table if not exists public.local_friend_ocean_message (
  id uuid primary key default gen_random_uuid(),
  ocean_float_id uuid not null references public.local_friend_ocean_float (id) on delete cascade,
  author_user_id uuid not null references auth.users (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_local_friend_ocean_message_float
  on public.local_friend_ocean_message (ocean_float_id, created_at asc);

alter table public.local_friend_ocean_float enable row level security;
alter table public.local_friend_ocean_message enable row level security;

drop policy if exists "local_friend_ocean_float_select_participant" on public.local_friend_ocean_float;
create policy "local_friend_ocean_float_select_participant"
  on public.local_friend_ocean_float for select to authenticated
  using (
    sender_user_id = auth.uid()
    or claimed_by_user_id = auth.uid()
  );

drop policy if exists "local_friend_ocean_float_insert_sender" on public.local_friend_ocean_float;
create policy "local_friend_ocean_float_insert_sender"
  on public.local_friend_ocean_float for insert to authenticated
  with check (
    sender_user_id = auth.uid()
    and status = 'floating'
  );

drop policy if exists "local_friend_ocean_message_select_participant" on public.local_friend_ocean_message;
create policy "local_friend_ocean_message_select_participant"
  on public.local_friend_ocean_message for select to authenticated
  using (
    exists (
      select 1 from public.local_friend_ocean_float f
      where f.id = local_friend_ocean_message.ocean_float_id
        and (f.sender_user_id = auth.uid() or f.claimed_by_user_id = auth.uid())
    )
  );

drop policy if exists "local_friend_ocean_message_insert_participant" on public.local_friend_ocean_message;
create policy "local_friend_ocean_message_insert_participant"
  on public.local_friend_ocean_message for insert to authenticated
  with check (
    author_user_id = auth.uid()
    and exists (
      select 1 from public.local_friend_ocean_float f
      where f.id = ocean_float_id
        and f.status = 'claimed'
        and (f.sender_user_id = auth.uid() or f.claimed_by_user_id = auth.uid())
    )
  );

-- Receiver may read sender profile after reveal (peer Local Friend bottle threads).
-- Skip if user_profile was never migrated on this project.
do $outer$
begin
  if to_regclass('public.user_profile') is not null then
    execute $exec$
      drop policy if exists "user_profile_select_local_friend_ocean_revealed" on public.user_profile;
      create policy "user_profile_select_local_friend_ocean_revealed"
        on public.user_profile for select to authenticated
        using (
          exists (
            select 1 from public.local_friend_ocean_float f
            where f.sender_user_id = user_profile.id
              and f.claimed_by_user_id = auth.uid()
              and f.reveal_status = 'revealed'
          )
        );
    $exec$;
  end if;
end;
$outer$;

create or replace function public.enqueue_local_friend_ocean_float(
  p_thread_root_id uuid,
  p_sender_user_id uuid,
  p_message_body text,
  p_sender_persona_name text default 'Traveler'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_thread_root_id is null or p_sender_user_id is null then
    raise exception 'thread root and sender required';
  end if;
  if btrim(coalesce(p_message_body, '')) = '' then
    raise exception 'message required';
  end if;

  insert into public.local_friend_ocean_float (
    thread_root_notification_id,
    sender_user_id,
    message_body,
    sender_persona_name,
    status,
    reveal_status
  )
  values (
    p_thread_root_id,
    p_sender_user_id,
    left(btrim(p_message_body), 4000),
    left(btrim(coalesce(p_sender_persona_name, 'Traveler')), 500),
    'floating',
    'hidden'
  )
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.enqueue_local_friend_ocean_float(uuid, uuid, text, text) to authenticated;
grant execute on function public.enqueue_local_friend_ocean_float(uuid, uuid, text, text) to service_role;

create or replace function public.claim_local_friend_ocean_float()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.local_friend_ocean_float%rowtype;
  v_notif_id uuid;
  v_sender_notif_id uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select * into v_row
  from public.local_friend_ocean_float
  where status = 'floating'
    and sender_user_id is distinct from v_uid
  order by created_at asc
  limit 1
  for update skip locked;

  if not found then
    return json_build_object('ok', false, 'reason', 'no_floating_message');
  end if;

  v_notif_id := gen_random_uuid();

  insert into public.notifications (
    id,
    user_id,
    type,
    title,
    message,
    reference_id,
    reference_type,
    is_read
  )
  values (
    v_notif_id,
    v_uid,
    'local_friend_bottle',
    'Message in a bottle',
    v_row.message_body,
    v_row.id::text,
    'local_friend_ocean_claim',
    false
  );

  v_sender_notif_id := gen_random_uuid();

  insert into public.notifications (
    id,
    user_id,
    type,
    title,
    message,
    reference_id,
    reference_type,
    is_read
  )
  values (
    v_sender_notif_id,
    v_row.sender_user_id,
    'local_friend_bottle',
    'Someone found your bottle',
    left(v_row.message_body, 500),
    v_row.id::text,
    'local_friend_ocean_found',
    false
  );

  update public.local_friend_ocean_float
  set status = 'claimed',
      claimed_by_user_id = v_uid,
      claimed_at = now(),
      claim_notification_id = v_notif_id
  where id = v_row.id;

  return json_build_object(
    'ok', true,
    'float_id', v_row.id,
    'message', v_row.message_body,
    'notification_id', v_notif_id,
    'sender_notification_id', v_sender_notif_id
  );
end;
$$;

grant execute on function public.claim_local_friend_ocean_float() to authenticated;

create or replace function public.reveal_local_friend_ocean_float(p_float_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.local_friend_ocean_float%rowtype;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select * into v_row from public.local_friend_ocean_float where id = p_float_id;
  if not found then
    raise exception 'float not found';
  end if;
  if v_row.claimed_by_user_id is distinct from v_uid and v_row.sender_user_id is distinct from v_uid then
    raise exception 'forbidden';
  end if;
  if v_row.claimed_by_user_id is distinct from v_uid then
    raise exception 'only receiver may reveal sender';
  end if;

  update public.local_friend_ocean_float
  set reveal_status = 'revealed',
      revealed_at = now()
  where id = p_float_id;

  if v_row.claim_notification_id is not null then
    update public.notifications
    set title = left(btrim(coalesce(v_row.sender_persona_name, 'Traveler')), 500)
    where id = v_row.claim_notification_id
      and user_id = v_uid;
  end if;

  return json_build_object(
    'ok', true,
    'float_id', p_float_id,
    'sender_user_id', v_row.sender_user_id,
    'sender_persona_name', v_row.sender_persona_name
  );
end;
$$;

grant execute on function public.reveal_local_friend_ocean_float(uuid) to authenticated;
