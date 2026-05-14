-- Ensure `public.event` can store Google Place IDs for Places-backed gallery + backfill scripts.
-- The app reads `google_place_id` for `fetchGooglePlacePhotoUrl` / strict recommendation resolution.
-- Safe idempotent add; does not set values (use `npm run backfill:recommendation-places` or manual updates).

alter table public.event add column if not exists google_place_id text;

comment on column public.event.google_place_id is
  'Google Place id (ChIJ… or places/ChIJ…) used for Places (New) photos; optional until backfilled.';
