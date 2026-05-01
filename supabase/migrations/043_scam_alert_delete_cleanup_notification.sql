-- When a bandiTEAM report row is deleted, remove the operator inbox notification created on insert.
-- Link: notifications.reference_id = scam_alerts.id::text, reference_type = 'scam_alert', type = 'bandiTEAM_report'.

create or replace function public.scam_alerts_delete_linked_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.notifications
  where type = 'bandiTEAM_report'
    and coalesce(reference_type, '') = 'scam_alert'
    and reference_id = OLD.id::text;
  return OLD;
end;
$$;

drop trigger if exists tr_scam_alerts_delete_notify on public.scam_alerts;
create trigger tr_scam_alerts_delete_notify
  after delete on public.scam_alerts
  for each row
  execute function public.scam_alerts_delete_linked_notifications();
