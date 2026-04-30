-- Client submits reports from anonymous Auth sessions; JWT role may be `anon` or `authenticated`.
-- Keeps insert gated on a real auth.uid() so rows stay attributable.

drop policy if exists "scam_alerts_insert_authenticated" on public.scam_alerts;
create policy "scam_alerts_insert_authenticated"
  on public.scam_alerts
  for insert
  to authenticated
  with check (
    auth.uid() is not null
    and coalesce(nullif(trim(reported_by), ''), auth.uid()::text) = auth.uid()::text
  );

drop policy if exists "scam_alerts_insert_anon" on public.scam_alerts;
create policy "scam_alerts_insert_anon"
  on public.scam_alerts
  for insert
  to anon
  with check (
    auth.uid() is not null
    and coalesce(nullif(trim(reported_by), ''), auth.uid()::text) = auth.uid()::text
  );
