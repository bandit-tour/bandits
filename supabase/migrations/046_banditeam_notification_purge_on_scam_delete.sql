-- bandiTEAM_report inbox rows: delete when the scam_alert is deleted (shared helper + RPCs).
-- Notifications link: type = 'bandiTEAM_report', reference_id ~ scam_alerts.id::text (see scam_alerts_notify_operator).

create or replace function public.purge_banditeam_report_notifications_for_scam(p_scam_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.notifications
  where type = 'bandiTEAM_report'
    and (
      public.safe_uuid_from_text(reference_id) = p_scam_id
      or lower(trim(both from coalesce(reference_id, ''))) = lower(trim(both from p_scam_id::text))
    );
end;
$$;

alter function public.purge_banditeam_report_notifications_for_scam(uuid) owner to postgres;

revoke all on function public.purge_banditeam_report_notifications_for_scam(uuid) from public;
grant execute on function public.purge_banditeam_report_notifications_for_scam(uuid) to service_role;

create or replace function public.purge_banditeam_report_notifications_if_operator(p_scam_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_pilot_operator() then
    raise exception 'only pilot operator can purge report notifications' using errcode = 'P0001';
  end if;
  perform public.purge_banditeam_report_notifications_for_scam(p_scam_id);
end;
$$;

alter function public.purge_banditeam_report_notifications_if_operator(uuid) owner to postgres;

revoke all on function public.purge_banditeam_report_notifications_if_operator(uuid) from public;
grant execute on function public.purge_banditeam_report_notifications_if_operator(uuid) to authenticated;

create or replace function public.scam_alerts_delete_linked_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.purge_banditeam_report_notifications_for_scam(OLD.id);
  return OLD;
end;
$$;

alter function public.scam_alerts_delete_linked_notifications() owner to postgres;

drop trigger if exists tr_scam_alerts_delete_notify on public.scam_alerts;
create trigger tr_scam_alerts_delete_notify
  after delete on public.scam_alerts
  for each row
  execute function public.scam_alerts_delete_linked_notifications();

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

  perform public.purge_banditeam_report_notifications_for_scam(p_id);

  delete from public.scam_alerts
  where id = p_id;
  get diagnostics n = row_count;
  if n = 0 then
    raise exception 'scam alert not found' using errcode = 'P0001';
  end if;
end;
$$;

alter function public.delete_scam_alert_if_operator(uuid) owner to postgres;

revoke all on function public.delete_scam_alert_if_operator(uuid) from public;
grant execute on function public.delete_scam_alert_if_operator(uuid) to authenticated;
