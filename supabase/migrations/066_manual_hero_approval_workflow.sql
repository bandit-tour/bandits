-- Manual Hero Approval: one operator-approved hero per venue.
-- Until hero_approved_at is set, the app shows "pending approval" — no Google/stock substitution.

ALTER TABLE public.event
  ADD COLUMN IF NOT EXISTS approved_hero_url text DEFAULT '',
  ADD COLUMN IF NOT EXISTS approved_thumbnail_url text DEFAULT '',
  ADD COLUMN IF NOT EXISTS approved_gallery text DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS hero_approved_at timestamptz;

COMMENT ON COLUMN public.event.approved_hero_url IS 'Single canonical hero — used on Explore, City Guide, profile, My Spots, maps, venue page.';
COMMENT ON COLUMN public.event.approved_thumbnail_url IS 'Optional list-card thumbnail; defaults to approved_hero_url when empty.';
COMMENT ON COLUMN public.event.approved_gallery IS 'JSON array of operator-approved gallery URLs in display order.';
COMMENT ON COLUMN public.event.hero_approved_at IS 'When set, approved hero URLs are live; when null, venue shows pending state everywhere.';

-- Backfill venues that already have distinct curated galleries (migration 049/052/065).
UPDATE public.event
SET
  approved_hero_url = COALESCE(
    NULLIF(trim(image_url), ''),
    NULLIF(trim((image_gallery::jsonb ->> 0)), '')
  ),
  approved_gallery = CASE
    WHEN image_gallery IS NOT NULL AND trim(image_gallery) <> '' AND image_gallery <> '[]' THEN image_gallery
    WHEN trim(coalesce(image_url, '')) <> '' THEN json_build_array(trim(image_url))::text
    ELSE '[]'
  END,
  hero_approved_at = now()
WHERE hero_approved_at IS NULL
  AND (
    (image_gallery IS NOT NULL AND trim(image_gallery) <> '' AND image_gallery <> '[]')
    OR trim(coalesce(image_url, '')) <> ''
  )
  AND (
    image_gallery NOT ILIKE '%pexels.com%'
    AND image_gallery NOT ILIKE '%unsplash.com%'
    AND image_gallery NOT ILIKE '%picsum.photos%'
    AND coalesce(image_url, '') NOT ILIKE '%pexels.com%'
    AND coalesce(image_url, '') NOT ILIKE '%unsplash.com%'
    AND coalesce(image_url, '') NOT ILIKE '%picsum.photos%'
  );

-- Keep legacy columns aligned for any external readers.
UPDATE public.event
SET
  image_url = approved_hero_url,
  image_gallery = approved_gallery
WHERE hero_approved_at IS NOT NULL
  AND trim(coalesce(approved_hero_url, '')) <> '';

UPDATE public.bandit_event
SET recommendation_place_photo_url = NULL
WHERE event_id IN (SELECT id FROM public.event WHERE hero_approved_at IS NOT NULL);
