-- Batch 2 + Seychelles: remove editorial/Wikimedia/non-Places rows from `image_url` / `image_gallery`.
-- Aligns recommendation cards with /spot/[id]: both use Places-backed heroes when google_place_id resolves.
-- Applied after optional 052 Wikimedia edits; safe to run on clean rows (no-op).

UPDATE public.event
SET
  image_url = '',
  image_gallery = '[]'::text
WHERE lower(trim(name)) IN (
  lower(trim('aphaia.athens')),
  lower(trim('Aphaia Athens')),
  lower(trim('Fine Mess Smokehouse')),
  lower(trim('September')),
  lower(trim('TromeroPaidi')),
  lower(trim('Avyssinias Square Flea Market')),
  lower(trim('Seychelles Athens')),
  lower(trim('Itsclofie Vintage')),
  lower(trim('Mania Athens')),
  lower(trim('Minu Concept Store Café')),
  lower(trim('Minu Cafe Concept Store')),
  lower(trim('Fabrica Artspace'))
);
