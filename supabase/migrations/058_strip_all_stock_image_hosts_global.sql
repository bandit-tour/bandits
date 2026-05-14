-- Global, policy-level cleanup: strip every stock-host URL from venue image columns.
--
-- The runtime card pipeline (`lib/eventVenueGallery.ts` + `lib/recommendationImages.ts`)
-- already rejects Pexels / Unsplash / Picsum / Wikimedia hosts and renders a
-- category-specific neutral placeholder instead. This migration brings the database
-- in line with that policy so audit queries do not surface stale stock URLs and so
-- that any code path that ever inspects `event.image_url` directly (e.g. external
-- scripts) cannot accidentally re-surface a wrong-for-the-venue stock photo.
--
-- Hosts treated as untrusted "stock" for venue heroes:
--   - images.pexels.com / pexels.com
--   - images.unsplash.com / unsplash.com
--   - picsum.photos
--
-- Wikimedia URLs were used historically as editorial stand-ins. They are NOT cleared
-- here: a Wikimedia photo of an Acropolis-view bar is still arguably more truthful
-- than a stock cocktail-glass photo. Operators can clear those per-row via the
-- existing 049/052 migrations if needed.

BEGIN;

-- event.image_url --------------------------------------------------------------
UPDATE public.event
SET image_url = ''
WHERE trim(coalesce(image_url, '')) <> ''
  AND (
    image_url ILIKE '%images.pexels.com%'
    OR image_url ILIKE '%pexels.com/photos%'
    OR image_url ILIKE '%images.unsplash.com%'
    OR image_url ILIKE '%unsplash.com/photos%'
    OR image_url ILIKE '%picsum.photos%'
  );

-- event.image_gallery (JSON array or CSV) --------------------------------------
UPDATE public.event
SET image_gallery = '[]'
WHERE image_gallery IS NOT NULL
  AND (
    image_gallery ILIKE '%images.pexels.com%'
    OR image_gallery ILIKE '%pexels.com/photos%'
    OR image_gallery ILIKE '%images.unsplash.com%'
    OR image_gallery ILIKE '%unsplash.com/photos%'
    OR image_gallery ILIKE '%picsum.photos%'
  );

-- spots.image_url (user-curated spots can also store URLs) ---------------------
UPDATE public.spots
SET image_url = NULL
WHERE image_url IS NOT NULL
  AND (
    image_url ILIKE '%images.pexels.com%'
    OR image_url ILIKE '%pexels.com/photos%'
    OR image_url ILIKE '%images.unsplash.com%'
    OR image_url ILIKE '%unsplash.com/photos%'
    OR image_url ILIKE '%picsum.photos%'
  );

UPDATE public.spots
SET image_gallery = NULL
WHERE image_gallery IS NOT NULL
  AND (
    image_gallery ILIKE '%images.pexels.com%'
    OR image_gallery ILIKE '%pexels.com/photos%'
    OR image_gallery ILIKE '%images.unsplash.com%'
    OR image_gallery ILIKE '%unsplash.com/photos%'
    OR image_gallery ILIKE '%picsum.photos%'
  );

-- bandit_event.recommendation_place_photo_url (link-level denormalized hero) ---
UPDATE public.bandit_event
SET recommendation_place_photo_url = NULL
WHERE recommendation_place_photo_url IS NOT NULL
  AND (
    recommendation_place_photo_url ILIKE '%images.pexels.com%'
    OR recommendation_place_photo_url ILIKE '%pexels.com/photos%'
    OR recommendation_place_photo_url ILIKE '%images.unsplash.com%'
    OR recommendation_place_photo_url ILIKE '%unsplash.com/photos%'
    OR recommendation_place_photo_url ILIKE '%picsum.photos%'
  );

COMMIT;
