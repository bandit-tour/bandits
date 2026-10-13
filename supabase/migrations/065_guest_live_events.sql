-- Guest Live Events — Workspaces publish; Guest App subscribes (GUEST-ALIVE-001).
-- Realtime enabled so inserts appear instantly on Guest surfaces.

create table if not exists public.guest_live_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  workspace text not null,
  title text not null,
  detail text,
  entity_id text,
  property_slug text,
  destination text,
  payload jsonb not null default '{}'::jsonb,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_guest_live_events_published_at
  on public.guest_live_events (published_at desc);

create index if not exists idx_guest_live_events_type
  on public.guest_live_events (event_type);

alter table public.guest_live_events enable row level security;

-- Guests may read live events for the destination experience.
drop policy if exists guest_live_events_select_authenticated on public.guest_live_events;
create policy guest_live_events_select_authenticated
  on public.guest_live_events
  for select
  to authenticated
  using (true);

drop policy if exists guest_live_events_select_anon on public.guest_live_events;
create policy guest_live_events_select_anon
  on public.guest_live_events
  for select
  to anon
  using (true);

-- Service / operators insert via service role or authenticated publishers.
drop policy if exists guest_live_events_insert_authenticated on public.guest_live_events;
create policy guest_live_events_insert_authenticated
  on public.guest_live_events
  for insert
  to authenticated
  with check (true);

-- Realtime
do $$
begin
  begin
    alter publication supabase_realtime add table public.guest_live_events;
  exception
    when duplicate_object then null;
    when undefined_object then null;
  end;
end $$;

comment on table public.guest_live_events is
  'Workspace→Guest live bus. Guest App subscribes; surfaces update without refresh.';
