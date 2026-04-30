-- When any bandiTEAM report row is created (client or /api/scam-report), notify the pilot operator.
-- Prevents "silent" submissions when the client path bypasses the Vercel API.

create or replace function public.scam_alerts_notify_operator()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_op uuid;
  v_name text;
  v_from text;
  rmsg text;
begin
  select (nullif(trim(c.value), ''))::uuid
    into v_op
  from public.app_public_config c
  where c.key = 'operator_user_id'
  limit 1;
  if v_op is null then
    v_op := 'e6d8cb02-6f1a-40c0-96c4-b96961878407'::uuid;
  end if;

  v_from := 'Traveler';
  if coalesce(NEW.reported_by, '') ~* '^[0-9a-f-]{36}$' then
    select nullif(trim(up.name), '') into v_name
    from public.user_profile up
    where up.id = (NEW.reported_by)::uuid
    limit 1;
    if v_name is not null and btrim(v_name) <> '' then
      v_from := v_name;
    end if;
  end if;

  rmsg := coalesce(NEW.title, '(untitled)') || E'\n\nFrom: ' || v_from || E'\n\n' || coalesce(NEW.location, '') || ' · ' || coalesce(NEW.city, '');

  begin
    insert into public.notifications (user_id, type, title, message, reference_id, reference_type, is_read)
    values (v_op, 'bandiTEAM_report', 'New bandiTEAM report', left(rmsg, 2000), NEW.id::text, 'scam_alert', false);
  exception
    when others then
      raise warning 'scam_alerts_notify_operator insert skipped: %', sqlerrm;
  end;
  return NEW;
end;
$$;

drop trigger if exists tr_scam_alerts_notify_operator on public.scam_alerts;
create trigger tr_scam_alerts_notify_operator
  after insert on public.scam_alerts
  for each row
  execute function public.scam_alerts_notify_operator();
