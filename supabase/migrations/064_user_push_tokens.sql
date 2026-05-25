-- Expo push tokens per signed-in user/device (OS badges + remote notifications).
create table if not exists public.user_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  expo_push_token text not null,
  platform text,
  device_id text,
  updated_at timestamptz not null default now(),
  unique (user_id, expo_push_token)
);

create index if not exists idx_user_push_tokens_user on public.user_push_tokens (user_id);

alter table public.user_push_tokens enable row level security;

drop policy if exists user_push_tokens_select_own on public.user_push_tokens;
create policy user_push_tokens_select_own on public.user_push_tokens
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists user_push_tokens_insert_own on public.user_push_tokens;
create policy user_push_tokens_insert_own on public.user_push_tokens
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists user_push_tokens_update_own on public.user_push_tokens;
create policy user_push_tokens_update_own on public.user_push_tokens
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists user_push_tokens_delete_own on public.user_push_tokens;
create policy user_push_tokens_delete_own on public.user_push_tokens
  for delete to authenticated
  using (auth.uid() = user_id);
