-- Pilot operator inbox: Avishay Ben Eli (blonje@gmail.com)
-- Routes Ask Me + Local Friend notifications to the operator account.

insert into public.app_public_config (key, value)
values ('operator_user_id', 'e6d8cb02-6f1a-40c0-96c4-b96961878407')
on conflict (key) do update
  set value = excluded.value,
      updated_at = now();

-- Mobile clients use the anon key — must read operator_user_id for inbox routing.
alter table public.app_public_config enable row level security;

drop policy if exists "app_public_config_select_all" on public.app_public_config;
create policy "app_public_config_select_all"
  on public.app_public_config
  for select
  to anon, authenticated
  using (true);

grant select on public.app_public_config to anon, authenticated;
