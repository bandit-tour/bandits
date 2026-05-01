-- Replaces scam_alerts_notify_operator only: reported_by → text via rb_txt; never call safe_uuid_from_text(NEW.reported_by::text).

create or replace function public.scam_alerts_notify_operator()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_op uuid;
  v_rb uuid;
  v_name text;
  v_from text;
  rmsg text;
  rb_txt text;
begin
  select public.safe_uuid_from_text(c.value)
    into v_op
  from public.app_public_config c
  where c.key = 'operator_user_id'
  limit 1;
  if v_op is null then
    v_op := 'e6d8cb02-6f1a-40c0-96c4-b96961878407'::uuid;
  end if;

  v_from := 'Traveler';
  v_rb := null;
  rb_txt := case
    when NEW.reported_by is null then null
    else nullif(btrim(cast(NEW.reported_by as text)), '')
  end;
  if rb_txt is not null then
    v_rb := public.safe_uuid_from_text(rb_txt);
  end if;
  if v_rb is not null then
    begin
      select nullif(trim(up.name), '') into v_name
      from public.user_profile up
      where up.id = v_rb
      limit 1;
    exception
      when undefined_table then
        v_name := null;
    end;
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
