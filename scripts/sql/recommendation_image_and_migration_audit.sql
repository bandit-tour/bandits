-- Run in Supabase SQL Editor against the project your mobile app uses (same EXPO_PUBLIC_SUPABASE_URL).
-- 1) Confirm recent migrations were applied (version string format depends on Supabase CLI; look for your filenames or timestamps).
select version
from supabase_migrations.schema_migrations
order by version desc
limit 50;

-- 2) Batch 2 + Seychelles: place id + whether stock URLs still sit on the row (migrations 053–055 should clear images; 051 strips Pexels).
select
  e.id,
  e.name,
  case
    when trim(coalesce(e.google_place_id, '')) = '' then false
    else true
  end as has_google_place_id,
  left(trim(coalesce(e.image_url, '')), 72) as image_url_prefix,
  case
    when coalesce(e.image_url, '') ilike '%pexels.com%' then true
    when coalesce(e.image_gallery::text, '') ilike '%pexels.com%' then true
    else false
  end as still_has_pexels,
  case
    when trim(coalesce(e.image_url, '')) = '' and (e.image_gallery is null or trim(e.image_gallery::text) in ('', '[]', 'null'))
    then true
    else false
  end as images_cleared_like_post_053
from public.event e
where lower(trim(e.name)) in (
  lower(trim('aphaia.athens')),
  lower(trim('Aphaia Athens')),
  lower(trim('Fine Mess Smokehouse')),
  lower(trim('September')),
  lower(trim('TromeroPaidi')),
  lower(trim('Tromero Paidi')),
  lower(trim('Avyssinias Square Flea Market')),
  lower(trim('Seychelles Athens')),
  lower(trim('Itsclofie Vintage')),
  lower(trim('Mania Athens')),
  lower(trim('Minu Concept Store Café')),
  lower(trim('Minu Cafe Concept Store')),
  lower(trim('Fabrica Artspace'))
)
order by e.name;

-- 3) bandit_event: link-level photo override (055 should null these for batch 2 names)
select
  e.name,
  be.bandit_id,
  left(trim(coalesce(be.recommendation_place_photo_url, '')), 72) as recommendation_place_photo_url_prefix
from public.bandit_event be
join public.event e on e.id = be.event_id
where lower(trim(e.name)) in (
  lower(trim('aphaia.athens')),
  lower(trim('Aphaia Athens')),
  lower(trim('Fine Mess Smokehouse')),
  lower(trim('September')),
  lower(trim('TromeroPaidi')),
  lower(trim('Tromero Paidi')),
  lower(trim('Avyssinias Square Flea Market')),
  lower(trim('Seychelles Athens')),
  lower(trim('Itsclofie Vintage')),
  lower(trim('Mania Athens')),
  lower(trim('Minu Concept Store Café')),
  lower(trim('Minu Cafe Concept Store')),
  lower(trim('Fabrica Artspace'))
)
  and be.recommendation_place_photo_url is not null
  and trim(be.recommendation_place_photo_url) <> '';
