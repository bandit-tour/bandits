-- Remove seed Pexels/Unsplash/Picsum heroes from flagged City Guide rows so the app uses
-- Places-backed photos (same fetch path as spot detail) or non-stock DB galleries (migration 049).
-- `getEventVenueGalleryOrdered` already ignores these hosts; clearing them avoids stale duplicates in raw columns.
-- Names match the QA batch (Greek Drag, ASFA BBQ, Agora, Ronit, Cultterra, Sessions, Zurbarán, Sugar Killer,
-- Astir, Psarakía, Ohh Boy, Blind Spot, Seychelles, plus brunch extras from a parallel review).

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
  lower(trim('The Brunchers')),
  lower(trim('Sofis Eatery')),
  lower(trim('Ohh Boy')),
  lower(trim('Ohh Boy Brunch Café')),
  lower(trim('The Blind Spot Pangrati')),
  lower(trim('The Blind Spot')),
  lower(trim('Ronit Baranga (Exhibitions)')),
  lower(trim('Greek Drag Shows (Aggregator)')),
  lower(trim('Greek Drag Shows')),
  lower(trim('Eutopia Art Residency')),
  lower(trim('ASFA BBQ (Athens School of Fine Arts Festival)')),
  lower(trim('ASFA BBQ (Athens School of Fine Arts)')),
  lower(trim('Kinono')),
  lower(trim('Zurbaran Athens')),
  lower(trim('Sugar Killer')),
  lower(trim('The Agora Project (Impact Hub)')),
  lower(trim('The Agora Project')),
  lower(trim('Cultterra')),
  lower(trim('Sessions (sesSSSions)')),
  lower(trim('Sessions')),
  lower(trim('Astir Beach')),
  lower(trim('Psarakia Thalassina')),
  lower(trim('Seychelles Athens'))
);
