-- Replace wrong stock heroes on flagged guide events with distinct per-row Wikimedia URLs.
-- Cards + spot detail both read `image_gallery` / `image_url` via `getEventVenueGalleryOrdered` (gallery[0] first).
-- These are editorial stand-ins until real venue Google/places galleries are attached; every URL below is unique across this batch.

-- Greek Drag Shows (Aggregator) + short title row: Culture, Athens Pride scene (distinct from Sessions)
UPDATE public.event SET
  genre = 'Culture',
  image_url = 'https://upload.wikimedia.org/wikipedia/commons/0/0a/AthensPrideColour.jpg',
  image_gallery = '["https://upload.wikimedia.org/wikipedia/commons/0/0a/AthensPrideColour.jpg"]'::text
WHERE lower(trim(name)) IN (
  lower(trim('Greek Drag Shows (Aggregator)')),
  lower(trim('Greek Drag Shows'))
);

-- ASFA BBQ (festival + school rows): Athens School of Fine Arts — De Chirico Lyceum
UPDATE public.event SET
  image_url = 'https://upload.wikimedia.org/wikipedia/commons/8/85/ASFA_DE_CHIRICO_LYCEUM.jpg',
  image_gallery = '["https://upload.wikimedia.org/wikipedia/commons/8/85/ASFA_DE_CHIRICO_LYCEUM.jpg"]'::text
WHERE lower(trim(name)) IN (
  lower(trim('ASFA BBQ (Athens School of Fine Arts Festival)')),
  lower(trim('ASFA BBQ (Athens School of Fine Arts)'))
);

-- The Agora Project (Impact Hub) + short title: community market / gathering (Athens)
UPDATE public.event SET
  image_url = 'https://upload.wikimedia.org/wikipedia/commons/a/a5/Flea_Market_at_Monastiraki.jpg',
  image_gallery = '["https://upload.wikimedia.org/wikipedia/commons/a/a5/Flea_Market_at_Monastiraki.jpg"]'::text
WHERE lower(trim(name)) IN (
  lower(trim('The Agora Project (Impact Hub)')),
  lower(trim('The Agora Project'))
);

-- Ronit Baranga (Exhibitions): VRT-licensed sculpture photo (artist’s work)
UPDATE public.event SET
  image_url = 'https://upload.wikimedia.org/wikipedia/commons/4/44/Ronit_Baranga_-_Untitled_Feast_01_%282015%29.jpg',
  image_gallery = '["https://upload.wikimedia.org/wikipedia/commons/4/44/Ronit_Baranga_-_Untitled_Feast_01_%282015%29.jpg"]'::text
WHERE lower(trim(name)) = lower(trim('Ronit Baranga (Exhibitions)'));

-- Cultterra (Elefsina): contemporary street / mural context (not generic food)
UPDATE public.event SET
  genre = 'Culture',
  image_url = 'https://upload.wikimedia.org/wikipedia/commons/5/5f/20240314_elefsina_174.jpg',
  image_gallery = '["https://upload.wikimedia.org/wikipedia/commons/5/5f/20240314_elefsina_174.jpg"]'::text
WHERE lower(trim(name)) = lower(trim('Cultterra'));

-- Sessions: Nicosia — not Athens; performance image distinct from Athens Pride (cross-border pick per seed data)
UPDATE public.event SET
  genre = 'Nightlife',
  city = 'Nicosia',
  neighborhood = 'Cyprus',
  address = 'Sapfous 6 (ex‑Drive area), Nicosia, Cyprus — Cyprus listing linked to Athens queer/DIY circles; verify before visiting.',
  image_url = 'https://upload.wikimedia.org/wikipedia/commons/3/3c/Cyprus_Theater_Festival_in_Near_East_University.jpg',
  image_gallery = '["https://upload.wikimedia.org/wikipedia/commons/3/3c/Cyprus_Theater_Festival_in_Near_East_University.jpg"]'::text
WHERE lower(trim(name)) IN (
  lower(trim('Sessions (sesSSSions)')),
  lower(trim('Sessions'))
);

-- Zurbaran Athens: Spanish plating mood (stands in until venue shots)
UPDATE public.event SET
  image_url = 'https://upload.wikimedia.org/wikipedia/commons/6/65/Gambas_al_ajillo.jpg',
  image_gallery = '["https://upload.wikimedia.org/wikipedia/commons/6/65/Gambas_al_ajillo.jpg"]'::text
WHERE lower(trim(name)) = lower(trim('Zurbaran Athens'));

-- Sugar Killer: Greek sweets stand-in
UPDATE public.event SET
  image_url = 'https://upload.wikimedia.org/wikipedia/commons/a/a0/Loukoumades_Greek_Doughnuts_with_Walnuts_and_Honey.jpg',
  image_gallery = '["https://upload.wikimedia.org/wikipedia/commons/a/a0/Loukoumades_Greek_Doughnuts_with_Walnuts_and_Honey.jpg"]'::text
WHERE lower(trim(name)) = lower(trim('Sugar Killer'));

-- Astir Beach: Astir,Vouliagmeni shoreline
UPDATE public.event SET
  image_url = 'https://upload.wikimedia.org/wikipedia/commons/f/f1/Beach_Huts%2C_Astir_Beach%2C_Vouliagmeni%2C_Athens%2C_Greece%2C_2009.jpg',
  image_gallery = '["https://upload.wikimedia.org/wikipedia/commons/f/f1/Beach_Huts%2C_Astir_Beach%2C_Vouliagmeni%2C_Athens%2C_Greece%2C_2009.jpg"]'::text
WHERE lower(trim(name)) = lower(trim('Astir Beach'));

-- Psarakia Thalassina: Greek grilled octopus dish photo
UPDATE public.event SET
  image_url = 'https://upload.wikimedia.org/wikipedia/commons/4/4d/Greek-style_grilled_octopus_with_olive_oil%2C_lemon%2C_butter_and_parsley.jpg',
  image_gallery = '["https://upload.wikimedia.org/wikipedia/commons/4/4d/Greek-style_grilled_octopus_with_olive_oil%2C_lemon%2C_butter_and_parsley.jpg"]'::text
WHERE lower(trim(name)) = lower(trim('Psarakia Thalassina'));

-- Ohh Boy — Athens café exterior stand-in (not Ohh Boy itself)
UPDATE public.event SET
  image_url = 'https://upload.wikimedia.org/wikipedia/commons/c/c8/To_Kafeneio_001.jpg',
  image_gallery = '["https://upload.wikimedia.org/wikipedia/commons/c/c8/To_Kafeneio_001.jpg"]'::text
WHERE lower(trim(name)) IN (lower(trim('Ohh Boy')), lower(trim('Ohh Boy Brunch Café')));

-- The Blind Spot — specialty coffee presentation (Crete taverna stand-in)
UPDATE public.event SET
  image_url = 'https://upload.wikimedia.org/wikipedia/commons/e/e6/Restaurant_Erotokritos_%28Almyrida%29_-_expresso.jpg',
  image_gallery = '["https://upload.wikimedia.org/wikipedia/commons/e/e6/Restaurant_Erotokritos_%28Almyrida%29_-_expresso.jpg"]'::text
WHERE lower(trim(name)) IN (lower(trim('The Blind Spot Pangrati')), lower(trim('The Blind Spot')));

-- Seychelles Athens — Greek restaurant spread stand-in
UPDATE public.event SET
  image_url = 'https://upload.wikimedia.org/wikipedia/commons/3/3c/Typical_Greek_food_in_the_restaurant.jpg',
  image_gallery = '["https://upload.wikimedia.org/wikipedia/commons/3/3c/Typical_Greek_food_in_the_restaurant.jpg"]'::text
WHERE lower(trim(name)) = lower(trim('Seychelles Athens'));
