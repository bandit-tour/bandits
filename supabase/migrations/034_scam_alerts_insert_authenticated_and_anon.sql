-- Ensure both JWT roles used by Supabase Auth can insert traveler reports.
-- Replaces stricter 033 checks if those blocked valid inserts (uuid/text drift).

drop policy if exists "scam_alerts_insert_authenticated" on public.scam_alerts;
drop policy if exists "scam_alerts_insert_anon" on public.scam_alerts;

create policy "scam_alerts_insert_authenticated"
  on public.scam_alerts
  for insert
  to authenticated
  with check (auth.uid() is not null);

create policy "scam_alerts_insert_anon"
  on public.scam_alerts
  for insert
  to anon
  with check (auth.uid() is not null);
