-- Denormalized hero URL for City Guide rows (same canonical photo as event.image_url after Places backfill).
alter table public.bandit_event
  add column if not exists recommendation_place_photo_url text;

comment on column public.bandit_event.recommendation_place_photo_url is
  'Google Places (New) media URL or other verified venue hero; mirrors event.image_url for link-level reads.';
