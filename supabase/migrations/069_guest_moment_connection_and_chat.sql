-- Guest Moment connection requests + chat participant RLS + fair pick (anti-repeat).
-- Mode A bottle discovery → Chat delivery → connection accept/decline/block.

create table if not exists public.guest_moment_connection (
  id uuid primary key default gen_random_uuid(),
  thread_id text not null,
  moment_id uuid references public.guest_moment (id) on delete set null,
  requester_user_id uuid not null references auth.users (id) on delete cascade,
  sender_user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending'
    constraint guest_moment_connection_status_check
      check (status in ('pending', 'accepted', 'declined', 'blocked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint guest_moment_connection_thread_req unique (thread_id, requester_user_id)
);

create index if not exists idx_guest_moment_connection_sender
  on public.guest_moment_connection (sender_user_id, status, updated_at desc);

create index if not exists idx_guest_moment_connection_requester
  on public.guest_moment_connection (requester_user_id, status, updated_at desc);

alter table public.guest_moment_connection enable row level security;

drop policy if exists "guest_moment_connection_select_party" on public.guest_moment_connection;
create policy "guest_moment_connection_select_party"
  on public.guest_moment_connection for select to authenticated
  using (auth.uid() = requester_user_id or auth.uid() = sender_user_id);

drop policy if exists "guest_moment_connection_insert_requester" on public.guest_moment_connection;
create policy "guest_moment_connection_insert_requester"
  on public.guest_moment_connection for insert to authenticated
  with check (auth.uid() = requester_user_id);

drop policy if exists "guest_moment_connection_update_party" on public.guest_moment_connection;
create policy "guest_moment_connection_update_party"
  on public.guest_moment_connection for update to authenticated
  using (auth.uid() = requester_user_id or auth.uid() = sender_user_id)
  with check (auth.uid() = requester_user_id or auth.uid() = sender_user_id);

-- Chat messages: participants on the connection (or authors) may read/write.
drop policy if exists "guest_moment_chat_participant" on public.guest_moment_chat_message;
create policy "guest_moment_chat_participant"
  on public.guest_moment_chat_message for all to authenticated
  using (
    auth.uid() = author_user_id
    or exists (
      select 1 from public.guest_moment_connection c
      where c.thread_id = guest_moment_chat_message.thread_id
        and c.status = 'accepted'
        and (c.requester_user_id = auth.uid() or c.sender_user_id = auth.uid())
    )
  )
  with check (
    auth.uid() = author_user_id
    and (
      exists (
        select 1 from public.guest_moment_connection c
        where c.thread_id = guest_moment_chat_message.thread_id
          and c.status = 'accepted'
          and (c.requester_user_id = auth.uid() or c.sender_user_id = auth.uid())
      )
      or not exists (
        select 1 from public.guest_moment_connection c
        where c.thread_id = guest_moment_chat_message.thread_id
      )
    )
  );

-- Fair pick: exclude moments this receiver already discovered today.
create or replace function public.pick_eligible_guest_moment()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_day date := (timezone('utc', now()))::date;
  v_row public.guest_moment%rowtype;
begin
  if v_uid is null then
    return json_build_object('ok', false, 'error', 'auth_required');
  end if;

  select gm.* into v_row
  from public.guest_moment gm
  where gm.bottle_eligible = true
    and gm.day_key = v_day
    and gm.guest_user_id is distinct from v_uid
    and char_length(trim(gm.text)) >= 8
    and not exists (
      select 1 from public.guest_moment_discovery d
      where d.receiver_user_id = v_uid
        and d.moment_id = gm.id
    )
  order by random()
  limit 1;

  if not found then
    return json_build_object('ok', false);
  end if;

  return json_build_object(
    'ok', true,
    'id', v_row.id,
    'text', v_row.text,
    'day_key', v_row.day_key,
    'updated_at', v_row.updated_at,
    'bottle_eligible', v_row.bottle_eligible,
    'display_name', v_row.display_name,
    'city', v_row.city,
    'stay_hint', v_row.stay_hint,
    'guest_user_id', v_row.guest_user_id
  );
end;
$$;

grant execute on function public.pick_eligible_guest_moment() to authenticated;
