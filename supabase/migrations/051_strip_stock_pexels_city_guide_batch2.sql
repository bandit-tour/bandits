-- Strip seed Pexels/Unsplash/Picsum from City Guide batch 2 venue rows (see migration 052).
-- Kept separate from 050 so environments that already applied 050 still clear stale stock heroes.

UPDATE public.event
SET
  image_url = CASE
    WHEN trim(coalesce(image_url, '')) <> ''
      AND (
        image_url ILIKE '%pexels.com%'
        OR image_url ILIKE '%unsplash.com%'
        OR image_url ILIKE '%picsum.photos%'
      )
    THEN ''
    ELSE coalesce(image_url, '')
  END,
  image_gallery = CASE
    WHEN image_gallery IS NOT NULL
      AND (
        image_gallery ILIKE '%pexels.com%'
        OR image_gallery ILIKE '%unsplash.com%'
        OR image_gallery ILIKE '%picsum.photos%'
      )
    THEN '[]'
    ELSE image_gallery
  END
WHERE lower(trim(name)) IN (
  lower(trim('aphaia.athens')),
  lower(trim('Aphaia Athens')),
  lower(trim('Fine Mess Smokehouse')),
  lower(trim('September')),
  lower(trim('TromeroPaidi')),
  lower(trim('Avyssinias Square Flea Market')),
  lower(trim('Itsclofie Vintage')),
  lower(trim('Mania Athens')),
  lower(trim('Minu Concept Store Café')),
  lower(trim('Minu Cafe Concept Store')),
  lower(trim('Fabrica Artspace'))
);
