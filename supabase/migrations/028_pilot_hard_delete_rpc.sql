-- Hard-delete RPCs for Pilot Desk / Inbox. PostgREST DELETE can return 200/204 with 0
-- rows when RLS filters everything out, which looks like a "successful" no-op. These
-- functions use SECURITY DEFINER to bypass RLS while still enforcing auth in SQL.

-- Own notification row: must be the recipient (user_id = auth.uid()).
create or replace function public.delete_notification_if_owner(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
  uid uuid;
begin
  uid := auth.uid();
  if uid is null then
    raise exception 'not authenticated' using errcode = 'P0001';
  end if;
  delete from public.notifications
  where id = p_id and user_id = uid;
  get diagnostics n = row_count;
  if n = 0 then
    raise exception 'notification not found or not deletable' using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function public.delete_notification_if_owner(uuid) from public;
grant execute on function public.delete_notification_if_owner(uuid) to authenticated;

-- Scam report: only configured pilot operator (reuses is_pilot_operator() from 024).
create or replace function public.delete_scam_alert_if_operator(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  if not public.is_pilot_operator() then
    raise exception 'only pilot operator can delete reports' using errcode = 'P0001';
  end if;
  delete from public.scam_alerts
  where id = p_id;
  get diagnostics n = row_count;
  if n = 0 then
    raise exception 'scam alert not found' using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function public.delete_scam_alert_if_operator(uuid) from public;
grant execute on function public.delete_scam_alert_if_operator(uuid) to authenticated;
