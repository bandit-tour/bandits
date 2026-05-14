-- Pilot moderation: verify / hide / reject + operator-only update/delete.
-- Public feed visibility: default published; hidden/rejected excluded for non-operators via RLS.

alter table public.scam_alerts add column if not exists admin_verified boolean not null default false;
alter table public.scam_alerts add column if not exists moderation_status text not null default 'published';

alter table public.scam_alerts drop constraint if exists scam_alerts_moderation_status_check;
alter table public.scam_alerts add constraint scam_alerts_moderation_status_check
  check (moderation_status in ('published', 'hidden', 'rejected'));

create or replace function public.is_pilot_operator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    auth.uid() is not null
    and auth.uid() = (
      select case
        when trim(value) = '' then null
        when trim(value) ~ '^[0-9a-fA-F-]{36}$' then trim(value)::uuid
        else null
      end
      from public.app_public_config
      where key = 'operator_user_id'
      limit 1
    ),
    false
  );
$$;

grant execute on function public.is_pilot_operator() to authenticated;

drop policy if exists "scam_alerts_select_authenticated" on public.scam_alerts;
create policy "scam_alerts_select_authenticated"
  on public.scam_alerts
  for select
  to authenticated
  using (moderation_status = 'published' or public.is_pilot_operator());

drop policy if exists "scam_alerts_update_operator" on public.scam_alerts;
create policy "scam_alerts_update_operator"
  on public.scam_alerts
  for update
  to authenticated
  using (public.is_pilot_operator())
  with check (public.is_pilot_operator());

drop policy if exists "scam_alerts_delete_operator" on public.scam_alerts;
create policy "scam_alerts_delete_operator"
  on public.scam_alerts
  for delete
  to authenticated
  using (public.is_pilot_operator());
