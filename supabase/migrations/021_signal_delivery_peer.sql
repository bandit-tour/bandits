-- Peer signal delivery: links a receiver (guest) to a real sender's network_signal row,
-- with reveal + optional peer thread messages. Inserts inbox rows for both parties when applicable.

create table if not exists public.signal_delivery (
  id uuid primary key default gen_random_uuid(),
  sender_user_id uuid references auth.users (id) on delete set null,
  receiver_user_id uuid not null references auth.users (id) on delete cascade,
  signal_id uuid not null references public.network_signal (id) on delete restrict,
  hotel_slug text not null default '',
  assigned_at timestamptz not null default now(),
  reveal_status text not null default 'hidden'
    constraint signal_delivery_reveal_check check (reveal_status in ('hidden', 'revealed')),
  revealed_at timestamptz,
  delivery_status text not null default 'pending'
    constraint signal_delivery_status_check check (delivery_status in ('pending', 'delivered', 'failed', 'fallback')),
  thread_notification_id uuid references public.notifications (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_signal_delivery_receiver_assigned
  on public.signal_delivery (receiver_user_id, assigned_at desc);

create index if not exists idx_signal_delivery_sender
  on public.signal_delivery (sender_user_id)
  where sender_user_id is not null;

create index if not exists idx_signal_delivery_receiver_hotel
  on public.signal_delivery (receiver_user_id, hotel_slug, assigned_at desc);

create table if not exists public.signal_thread_message (
  id uuid primary key default gen_random_uuid(),
  signal_delivery_id uuid not null references public.signal_delivery (id) on delete cascade,
  author_user_id uuid not null references auth.users (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_signal_thread_message_delivery
  on public.signal_thread_message (signal_delivery_id, created_at asc);

alter table public.signal_delivery enable row level security;
alter table public.signal_thread_message enable row level security;

drop policy if exists "signal_delivery_select_participant" on public.signal_delivery;
create policy "signal_delivery_select_participant"
  on public.signal_delivery for select to authenticated
  using (
    receiver_user_id = auth.uid()
    or sender_user_id = auth.uid()
  );

drop policy if exists "signal_delivery_update_receiver_reveal" on public.signal_delivery;
create policy "signal_delivery_update_receiver_reveal"
  on public.signal_delivery for update to authenticated
  using (receiver_user_id = auth.uid())
  with check (receiver_user_id = auth.uid());

drop policy if exists "signal_thread_message_select_participant" on public.signal_thread_message;
create policy "signal_thread_message_select_participant"
  on public.signal_thread_message for select to authenticated
  using (
    exists (
      select 1 from public.signal_delivery d
      where d.id = signal_thread_message.signal_delivery_id
        and (d.receiver_user_id = auth.uid() or d.sender_user_id = auth.uid())
    )
  );

drop policy if exists "signal_thread_message_insert_participant" on public.signal_thread_message;
create policy "signal_thread_message_insert_participant"
  on public.signal_thread_message for insert to authenticated
  with check (
    author_user_id = auth.uid()
    and exists (
      select 1 from public.signal_delivery d
      where d.id = signal_delivery_id
        and (d.receiver_user_id = auth.uid() or d.sender_user_id = auth.uid())
        and d.sender_user_id is not null
    )
  );

-- Receiver may post even when sender is null (fallback): loosen insert for receiver-only fallback threads.
drop policy if exists "signal_thread_message_insert_participant" on public.signal_thread_message;
create policy "signal_thread_message_insert_participant"
  on public.signal_thread_message for insert to authenticated
  with check (
    author_user_id = auth.uid()
    and exists (
      select 1 from public.signal_delivery d
      where d.id = signal_delivery_id
        and (d.receiver_user_id = auth.uid() or d.sender_user_id = auth.uid())
    )
  );

-- After reveal, receiver may read sender profile (minimal peer visibility).
drop policy if exists "user_profile_select_signal_peer_revealed" on public.user_profile;
create policy "user_profile_select_signal_peer_revealed"
  on public.user_profile for select to authenticated
  using (
    exists (
      select 1 from public.signal_delivery d
      where d.sender_user_id = user_profile.id
        and d.receiver_user_id = auth.uid()
        and d.reveal_status = 'revealed'
        and d.sender_user_id is not null
    )
  );

-- Assign one delivery per receiver per hotel per UTC day; reuse if already exists.
create or replace function public.assign_signal_delivery(p_hotel_slug text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_receiver uuid := auth.uid();
  v_existing public.signal_delivery%rowtype;
  v_sender uuid;
  v_signal uuid;
  v_body text;
  v_fallback boolean := false;
  v_delivery_id uuid;
  v_notif_receiver uuid;
  v_notif_sender uuid;
begin
  if v_receiver is null then
    raise exception 'not authenticated';
  end if;

  select * into v_existing
  from public.signal_delivery
  where receiver_user_id = v_receiver
    and hotel_slug = coalesce(nullif(trim(p_hotel_slug), ''), '')
    and date((assigned_at at time zone 'utc')) = date((now() at time zone 'utc'))
  limit 1;

  if v_existing.id is not null then
    select body into v_body from public.network_signal where id = v_existing.signal_id;
    return json_build_object(
      'delivery_id', v_existing.id,
      'signal_id', v_existing.signal_id,
      'body', coalesce(v_body, ''),
      'sender_user_id', v_existing.sender_user_id,
      'delivery_status', v_existing.delivery_status,
      'reveal_status', v_existing.reveal_status
    );
  end if;

  select up.id, up.current_signal_id
    into v_sender, v_signal
  from public.user_profile up
  inner join public.network_signal ns on ns.id = up.current_signal_id and ns.is_active = true
  where up.id is distinct from v_receiver
    and up.current_signal_id is not null
  order by random()
  limit 1;

  if v_sender is null or v_signal is null then
    v_fallback := true;
    select id, body into v_signal, v_body
    from public.network_signal
    where is_active = true
    order by random()
    limit 1;
    if v_signal is null then
      raise exception 'no active signals';
    end if;

    insert into public.signal_delivery (
      sender_user_id, receiver_user_id, signal_id, hotel_slug,
      delivery_status, reveal_status, updated_at
    ) values (
      null, v_receiver, v_signal, coalesce(nullif(trim(p_hotel_slug), ''), ''),
      'fallback', 'hidden', now()
    )
    returning id into v_delivery_id;

    insert into public.notifications (user_id, type, title, message, reference_id, reference_type)
    values (
      v_receiver,
      'signal_peer_delivery',
      'Your arrival signal',
      left(v_body, 200),
      v_delivery_id::text,
      'signal_delivery'
    )
    returning id into v_notif_receiver;

    update public.signal_delivery
    set thread_notification_id = v_notif_receiver,
        delivery_status = 'delivered',
        updated_at = now()
    where id = v_delivery_id;

    return json_build_object(
      'delivery_id', v_delivery_id,
      'signal_id', v_signal,
      'body', v_body,
      'sender_user_id', null,
      'delivery_status', 'fallback',
      'reveal_status', 'hidden'
    );
  end if;

  select body into v_body from public.network_signal where id = v_signal;

  insert into public.signal_delivery (
    sender_user_id, receiver_user_id, signal_id, hotel_slug,
    delivery_status, reveal_status, updated_at
  ) values (
    v_sender, v_receiver, v_signal, coalesce(nullif(trim(p_hotel_slug), ''), ''),
    'delivered', 'hidden', now()
  )
  returning id into v_delivery_id;

  insert into public.notifications (user_id, type, title, message, reference_id, reference_type)
  values (
    v_receiver,
    'signal_peer_delivery',
    'Your arrival signal',
    left(coalesce(v_body, ''), 200),
    v_delivery_id::text,
    'signal_delivery'
  )
  returning id into v_notif_receiver;

  insert into public.notifications (user_id, type, title, message, reference_id, reference_type)
  values (
    v_sender,
    'signal_peer_delivery',
    'Your signal reached someone',
    'A guest just received your line from the network.',
    v_delivery_id::text,
    'signal_delivery_peer'
  )
  returning id into v_notif_sender;

  update public.signal_delivery
  set thread_notification_id = v_notif_receiver,
      updated_at = now()
  where id = v_delivery_id;

  return json_build_object(
    'delivery_id', v_delivery_id,
    'signal_id', v_signal,
    'body', coalesce(v_body, ''),
    'sender_user_id', v_sender,
    'delivery_status', 'delivered',
    'reveal_status', 'hidden'
  );
end;
$$;

grant execute on function public.assign_signal_delivery(text) to authenticated;

create or replace function public.reveal_signal_delivery(p_delivery_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.signal_delivery%rowtype;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select * into v_row from public.signal_delivery where id = p_delivery_id;
  if not found then
    raise exception 'delivery not found';
  end if;
  if v_row.receiver_user_id is distinct from v_uid then
    raise exception 'forbidden';
  end if;

  update public.signal_delivery
  set reveal_status = 'revealed',
      revealed_at = now(),
      updated_at = now()
  where id = p_delivery_id;

  return json_build_object('ok', true, 'delivery_id', p_delivery_id, 'sender_user_id', v_row.sender_user_id);
end;
$$;

grant execute on function public.reveal_signal_delivery(uuid) to authenticated;
