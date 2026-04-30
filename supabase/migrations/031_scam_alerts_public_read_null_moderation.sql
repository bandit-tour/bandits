-- Treat NULL moderation_status as public (legacy / safe default) for non-operators.
-- Before: (moderation_status = 'published') failed for NULL rows, hiding valid reports in the feed.

drop policy if exists "scam_alerts_select_authenticated" on public.scam_alerts;
create policy "scam_alerts_select_authenticated"
  on public.scam_alerts
  for select
  to authenticated
  using (
    public.is_pilot_operator()
    or coalesce(moderation_status, 'published') = 'published'
  );
