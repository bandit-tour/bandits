-- Personal travel Moments (journal) — private by default; owned media in storage.
-- Distinct from guest_moment (daily bottle quote).

create table if not exists public.guest_personal_moments (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default '',
  story text not null default '',
  city text not null default '',
  place_label text,
  occurred_at timestamptz not null default now(),
  media jsonb not null default '[]'::jsonb,
  visibility text not null default 'private'
    check (visibility in ('private', 'shared')),
  bottle_share_opt_in boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_guest_personal_moments_user
  on public.guest_personal_moments (user_id, occurred_at desc);

alter table public.guest_personal_moments enable row level security;

drop policy if exists "guest_personal_moments_select_own" on public.guest_personal_moments;
create policy "guest_personal_moments_select_own"
  on public.guest_personal_moments for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "guest_personal_moments_insert_own" on public.guest_personal_moments;
create policy "guest_personal_moments_insert_own"
  on public.guest_personal_moments for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "guest_personal_moments_update_own" on public.guest_personal_moments;
create policy "guest_personal_moments_update_own"
  on public.guest_personal_moments for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "guest_personal_moments_delete_own" on public.guest_personal_moments;
create policy "guest_personal_moments_delete_own"
  on public.guest_personal_moments for delete to authenticated
  using (auth.uid() = user_id);

-- Storage bucket for owned Moment media (private; signed URLs from client).
insert into storage.buckets (id, name, public)
values ('guest_travel_memory', 'guest_travel_memory', false)
on conflict (id) do nothing;

drop policy if exists "guest_travel_memory_select_own" on storage.objects;
create policy "guest_travel_memory_select_own"
  on storage.objects for select to authenticated
  using (bucket_id = 'guest_travel_memory' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "guest_travel_memory_insert_own" on storage.objects;
create policy "guest_travel_memory_insert_own"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'guest_travel_memory' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "guest_travel_memory_update_own" on storage.objects;
create policy "guest_travel_memory_update_own"
  on storage.objects for update to authenticated
  using (bucket_id = 'guest_travel_memory' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "guest_travel_memory_delete_own" on storage.objects;
create policy "guest_travel_memory_delete_own"
  on storage.objects for delete to authenticated
  using (bucket_id = 'guest_travel_memory' and (storage.foldername(name))[1] = auth.uid()::text);
