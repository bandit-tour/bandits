-- Live alerts: correlate one send → many recipient rows, so Pilot Desk can delete the whole broadcast.

alter table public.notifications
  add column if not exists live_alert_broadcast_id uuid;

create index if not exists idx_notifications_live_alert_broadcast_id
  on public.notifications (live_alert_broadcast_id)
  where live_alert_broadcast_id is not null;

create or replace function public.list_pilot_live_alert_broadcasts(p_limit int default 50)
returns table (
  broadcast_id uuid,
  title text,
  message text,
  sent_at timestamptz,
  recipient_count bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare lim int;
begin
  if not public.is_pilot_operator() then
    raise exception 'only pilot operator' using errcode = 'P0001';
  end if;
  lim := greatest(1, least(coalesce(p_limit, 50), 100));
  return query
  select
    n.live_alert_broadcast_id as broadcast_id,
    max(n.title)::text as title,
    max(n.message)::text as message,
    max(n.created_at) as sent_at,
    count(*)::bigint as recipient_count
  from public.notifications n
  where n.type = 'live_alert'
    and n.reference_type = 'pilot_live_alert'
    and n.live_alert_broadcast_id is not null
  group by n.live_alert_broadcast_id
  order by max(n.created_at) desc
  limit lim;
end;
$$;

revoke all on function public.list_pilot_live_alert_broadcasts(int) from public;
grant execute on function public.list_pilot_live_alert_broadcasts(int) to authenticated;

create or replace function public.delete_pilot_live_alert_broadcast(p_broadcast_id uuid)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare n bigint;
begin
  if not public.is_pilot_operator() then
    raise exception 'only pilot operator' using errcode = 'P0001';
  end if;
  if p_broadcast_id is null then
    raise exception 'broadcast id required' using errcode = 'P0001';
  end if;
  delete from public.notifications
  where live_alert_broadcast_id = p_broadcast_id
    and type = 'live_alert'
    and reference_type = 'pilot_live_alert';
  get diagnostics n = row_count;
  return coalesce(n, 0);
end;
$$;

revoke all on function public.delete_pilot_live_alert_broadcast(uuid) from public;
grant execute on function public.delete_pilot_live_alert_broadcast(uuid) to authenticated;
