-- Optional coordinates for pilot "Around You" proximity (nullable; backfill when known)
alter table public.spots add column if not exists location_lat double precision;
alter table public.spots add column if not exists location_lng double precision;

alter table public.scam_alerts add column if not exists location_lat double precision;
alter table public.scam_alerts add column if not exists location_lng double precision;
