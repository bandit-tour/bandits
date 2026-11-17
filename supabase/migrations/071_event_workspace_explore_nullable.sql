-- Workspace-authored Explore records (e.g. Piraeus gallery district) may have no verified rating,
-- event window or licensed hero image. Never invent them: allow NULL. Idempotent; review before applying.
do $$
declare c text;
begin
  foreach c in array array['rating','image_url','start_time','end_time'] loop
    if exists (select 1 from information_schema.columns
               where table_schema = 'public' and table_name = 'event' and column_name = c) then
      execute format('alter table public.event alter column %I drop not null', c);
    end if;
  end loop;
end $$;

alter table public.event add column if not exists workspace_record_id text;
create unique index if not exists event_workspace_record_id_uidx
  on public.event (workspace_record_id) where workspace_record_id is not null;
comment on column public.event.workspace_record_id is
  'banDiTour Workspace canonicalVenueId — set only for authorized, editorially approved Workspace records.';
