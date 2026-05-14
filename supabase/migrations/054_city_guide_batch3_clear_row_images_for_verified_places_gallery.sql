-- QA batch (brunch/burger, duplicated coffee, sunset pier / mixed stock rows):
-- clear non–Places-linked heroes so recommendation cards match /spot/[id] Places fetch + gallery rules.
-- `getEventVenueGalleryOrdered` only trusts Places-derived URLs on the row; wiping columns removes Wikimedia + seed junk.
-- Applies to event rows and denormalized `bandit_event.recommendation_place_photo_url` overrides.

UPDATE public.event
SET
  image_url = '',
  image_gallery = '[]'::text
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
  lower(trim('Sugar Killer'))
);

UPDATE public.bandit_event
SET recommendation_place_photo_url = NULL
WHERE event_id IN (
  SELECT id
  FROM public.event
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
    lower(trim('Sugar Killer'))
  )
);
