-- Optional image attachment for bandiTEAM / scam reports
alter table public.scam_alerts
  add column if not exists image_url text;

-- Row level security: allow authenticated users to submit and read (for inbox / review tooling)
alter table public.scam_alerts enable row level security;

drop policy if exists "scam_alerts_insert_authenticated" on public.scam_alerts;
create policy "scam_alerts_insert_authenticated"
  on public.scam_alerts
  for insert
  to authenticated
  with check (true);

drop policy if exists "scam_alerts_select_authenticated" on public.scam_alerts;
create policy "scam_alerts_select_authenticated"
  on public.scam_alerts
  for select
  to authenticated
  using (true);
