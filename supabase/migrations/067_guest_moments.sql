-- Guest Moments — daily personal status for bottle discovery (Mode A).
-- Distinct from Local Friend ocean floats (Mode B). Chat continues the thread.

create table if not exists public.guest_moment (
  id uuid primary key default gen_random_uuid(),
  guest_user_id uuid not null references auth.users (id) on delete cascade,
  text text not null,
  day_key date not null,
  bottle_eligible boolean not null default true,
  display_name text not null default 'Traveler',
  city text,
  stay_hint text,
  updated_at timestamptz not null default now(),
  constraint guest_moment_text_len check (char_length(trim(text)) >= 8 and char_length(text) <= 280),
  constraint guest_moment_user_day unique (guest_user_id, day_key)
);

create index if not exists idx_guest_moment_eligible_day
  on public.guest_moment (day_key, updated_at desc)
  where bottle_eligible = true;

create table if not exists public.guest_moment_discovery (
  id uuid primary key default gen_random_uuid(),
  moment_id uuid references public.guest_moment (id) on delete set null,
  receiver_user_id uuid not null references auth.users (id) on delete cascade,
  mode text not null default 'moment'
    constraint guest_moment_discovery_mode_check check (mode in ('moment', 'local_friend')),
  quote text not null,
  sender_display_name text,
  sender_kind text not null default 'guest',
  revealed boolean not null default false,
  replied boolean not null default false,
  chat_thread_id text,
  float_id text,
  notification_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists idx_guest_moment_discovery_receiver
  on public.guest_moment_discovery (receiver_user_id, created_at desc);

create table if not exists public.guest_moment_chat_message (
  id uuid primary key default gen_random_uuid(),
  thread_id text not null,
  author_user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'user'
    constraint guest_moment_chat_role_check check (role in ('user', 'peer')),
  body text not null,
  created_at timestamptz not null default now(),
  constraint guest_moment_chat_body_len check (char_length(trim(body)) >= 1 and char_length(body) <= 4000)
);

create index if not exists idx_guest_moment_chat_thread
  on public.guest_moment_chat_message (thread_id, created_at asc);

alter table public.guest_moment enable row level security;
alter table public.guest_moment_discovery enable row level security;
alter table public.guest_moment_chat_message enable row level security;

drop policy if exists "guest_moment_select_own" on public.guest_moment;
create policy "guest_moment_select_own"
  on public.guest_moment for select to authenticated
  using (auth.uid() = guest_user_id);

drop policy if exists "guest_moment_select_eligible" on public.guest_moment;
create policy "guest_moment_select_eligible"
  on public.guest_moment for select to authenticated
  using (
    bottle_eligible = true
    and day_key = (timezone('utc', now()))::date
    and guest_user_id is distinct from auth.uid()
  );

drop policy if exists "guest_moment_insert_own" on public.guest_moment;
create policy "guest_moment_insert_own"
  on public.guest_moment for insert to authenticated
  with check (auth.uid() = guest_user_id);

drop policy if exists "guest_moment_update_own" on public.guest_moment;
create policy "guest_moment_update_own"
  on public.guest_moment for update to authenticated
  using (auth.uid() = guest_user_id)
  with check (auth.uid() = guest_user_id);

drop policy if exists "guest_moment_discovery_own" on public.guest_moment_discovery;
create policy "guest_moment_discovery_own"
  on public.guest_moment_discovery for all to authenticated
  using (auth.uid() = receiver_user_id)
  with check (auth.uid() = receiver_user_id);

drop policy if exists "guest_moment_chat_participant" on public.guest_moment_chat_message;
create policy "guest_moment_chat_participant"
  on public.guest_moment_chat_message for all to authenticated
  using (auth.uid() = author_user_id)
  with check (auth.uid() = author_user_id);

create or replace function public.publish_guest_moment(
  p_text text,
  p_bottle_eligible boolean default true,
  p_display_name text default 'Traveler',
  p_city text default null,
  p_stay_hint text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_day date := (timezone('utc', now()))::date;
  v_text text := trim(both from coalesce(p_text, ''));
  v_row public.guest_moment%rowtype;
begin
  if v_uid is null then
    return json_build_object('ok', false, 'error', 'auth_required');
  end if;
  if char_length(v_text) < 8 then
    return json_build_object('ok', false, 'error', 'text_too_short');
  end if;
  if char_length(v_text) > 280 then
    v_text := left(v_text, 280);
  end if;

  insert into public.guest_moment (
    guest_user_id, text, day_key, bottle_eligible, display_name, city, stay_hint, updated_at
  ) values (
    v_uid, v_text, v_day, coalesce(p_bottle_eligible, true),
    coalesce(nullif(trim(p_display_name), ''), 'Traveler'),
    nullif(trim(coalesce(p_city, '')), ''),
    nullif(trim(coalesce(p_stay_hint, '')), ''),
    now()
  )
  on conflict (guest_user_id, day_key) do update set
    text = excluded.text,
    bottle_eligible = excluded.bottle_eligible,
    display_name = excluded.display_name,
    city = excluded.city,
    stay_hint = excluded.stay_hint,
    updated_at = now()
  returning * into v_row;

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

grant execute on function public.publish_guest_moment(text, boolean, text, text, text) to authenticated;

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

  select * into v_row
  from public.guest_moment
  where bottle_eligible = true
    and day_key = v_day
    and guest_user_id is distinct from v_uid
    and char_length(trim(text)) >= 8
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
