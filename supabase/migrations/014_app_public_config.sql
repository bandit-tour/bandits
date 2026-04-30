-- Public read of pilot routing values (e.g. operator Supabase Auth user id for notifications inbox).
-- Insert/update only via SQL editor or service role — not from the mobile client.

create table if not exists public.app_public_config (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table public.app_public_config enable row level security;

drop policy if exists "app_public_config_select_all" on public.app_public_config;
create policy "app_public_config_select_all"
  on public.app_public_config
  for select
  to anon, authenticated
  using (true);

-- Example (replace with your real Auth user UUID for the operator / pilot inbox):
-- insert into public.app_public_config (key, value)
-- values ('operator_user_id', '00000000-0000-0000-0000-000000000000')
-- on conflict (key) do update set value = excluded.value, updated_at = now();
