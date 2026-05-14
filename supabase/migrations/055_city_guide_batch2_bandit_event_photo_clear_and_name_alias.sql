-- Batch 2 follow-up: remove `bandit_event.recommendation_place_photo_url` overrides for the same QA rows as 053.
-- Matches migration 054 pattern for batch 3 — link-level URLs were still able to confuse some read paths.
-- Also clears image columns for common alternate spelling `Tromero Paidi` (053 only matched `TromeroPaidi`).

UPDATE public.event
SET
  image_url = '',
  image_gallery = '[]'::text
WHERE lower(trim(name)) = lower(trim('Tromero Paidi'));

UPDATE public.bandit_event
SET recommendation_place_photo_url = NULL
WHERE event_id IN (
  SELECT id
  FROM public.event
  WHERE lower(trim(name)) IN (
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
);
