create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null references auth.users(id) on delete set null,
  event_name text not null,
  reference_type text null,
  reference_id text null,
  created_at timestamptz not null default now()
);

create index if not exists idx_analytics_events_created_at
  on public.analytics_events(created_at desc);

create index if not exists idx_analytics_events_event_name
  on public.analytics_events(event_name);

create index if not exists idx_analytics_events_user_id_created
  on public.analytics_events(user_id, created_at desc);

alter table public.analytics_events enable row level security;

drop policy if exists "analytics_insert_authenticated" on public.analytics_events;
create policy "analytics_insert_authenticated"
  on public.analytics_events
  for insert
  to authenticated
  with check (auth.uid() = user_id or user_id is null);

drop policy if exists "analytics_select_own" on public.analytics_events;
create policy "analytics_select_own"
  on public.analytics_events
  for select
  to authenticated
  using (auth.uid() = user_id);
