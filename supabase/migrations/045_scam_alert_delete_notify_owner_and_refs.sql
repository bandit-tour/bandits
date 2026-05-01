-- bandiTEAM report deleted -> remove operator inbox row(s).
-- Match on notifications.type = 'bandiTEAM_report' and reference_id <-> scam_alerts.id only.
-- Do NOT filter by reference_type: historical rows may be NULL, '', or 'scam_alert' (current trigger insert).

create or replace function public.scam_alerts_delete_linked_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.notifications
  where type = 'bandiTEAM_report'
    and (
      public.safe_uuid_from_text(reference_id) = OLD.id
      or lower(trim(both from coalesce(reference_id, ''))) = lower(trim(both from OLD.id::text))
    );
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

  delete from public.notifications
  where type = 'bandiTEAM_report'
    and (
      public.safe_uuid_from_text(reference_id) = p_id
      or lower(trim(both from coalesce(reference_id, ''))) = lower(trim(both from p_id::text))
    );

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
