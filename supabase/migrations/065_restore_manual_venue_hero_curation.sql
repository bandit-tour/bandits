-- Manual curation mode: restore operator-approved hero + gallery URLs cleared by 053/054.
-- Runtime reads `image_gallery` gallery[0] via `getEventVenueGalleryOrdered` — no automatic Google substitution.
-- Each URL below is distinct per venue row (re-applies 049 + 052 editorial stand-ins).

-- Batch 3 (054) — culture / brunch QA rows from migration 049
UPDATE public.event SET
  image_url = 'https://upload.wikimedia.org/wikipedia/commons/0/0a/AthensPrideColour.jpg',
  image_gallery = '["https://upload.wikimedia.org/wikipedia/commons/0/0a/AthensPrideColour.jpg"]'::text
WHERE lower(trim(name)) IN (
  lower(trim('Greek Drag Shows (Aggregator)')),
  lower(trim('Greek Drag Shows'))
);

UPDATE public.event SET
  image_url = 'https://upload.wikimedia.org/wikipedia/commons/8/85/ASFA_DE_CHIRICO_LYCEUM.jpg',
  image_gallery = '["https://upload.wikimedia.org/wikipedia/commons/8/85/ASFA_DE_CHIRICO_LYCEUM.jpg"]'::text
WHERE lower(trim(name)) IN (
  lower(trim('ASFA BBQ (Athens School of Fine Arts Festival)')),
  lower(trim('ASFA BBQ (Athens School of Fine Arts)'))
);

UPDATE public.event SET
  image_url = 'https://upload.wikimedia.org/wikipedia/commons/4/44/Ronit_Baranga_-_Untitled_Feast_01_%282015%29.jpg',
  image_gallery = '["https://upload.wikimedia.org/wikipedia/commons/4/44/Ronit_Baranga_-_Untitled_Feast_01_%282015%29.jpg"]'::text
WHERE lower(trim(name)) = lower(trim('Ronit Baranga (Exhibitions)'));

UPDATE public.event SET
  image_url = 'https://upload.wikimedia.org/wikipedia/commons/6/65/Gambas_al_ajillo.jpg',
  image_gallery = '["https://upload.wikimedia.org/wikipedia/commons/6/65/Gambas_al_ajillo.jpg"]'::text
WHERE lower(trim(name)) = lower(trim('Zurbaran Athens'));

UPDATE public.event SET
  image_url = 'https://upload.wikimedia.org/wikipedia/commons/a/a0/Loukoumades_Greek_Doughnuts_with_Walnuts_and_Honey.jpg',
  image_gallery = '["https://upload.wikimedia.org/wikipedia/commons/a/a0/Loukoumades_Greek_Doughnuts_with_Walnuts_and_Honey.jpg"]'::text
WHERE lower(trim(name)) = lower(trim('Sugar Killer'));

UPDATE public.event SET
  image_url = 'https://upload.wikimedia.org/wikipedia/commons/c/c8/To_Kafeneio_001.jpg',
  image_gallery = '["https://upload.wikimedia.org/wikipedia/commons/c/c8/To_Kafeneio_001.jpg"]'::text
WHERE lower(trim(name)) IN (lower(trim('Ohh Boy')), lower(trim('Ohh Boy Brunch Café')));

UPDATE public.event SET
  image_url = 'https://upload.wikimedia.org/wikipedia/commons/e/e6/Restaurant_Erotokritos_%28Almyrida%29_-_expresso.jpg',
  image_gallery = '["https://upload.wikimedia.org/wikipedia/commons/e/e6/Restaurant_Erotokritos_%28Almyrida%29_-_expresso.jpg"]'::text
WHERE lower(trim(name)) IN (lower(trim('The Blind Spot Pangrati')), lower(trim('The Blind Spot')));

-- Eutopia: distinct contemporary-art hero (not shared with ASFA school building)
UPDATE public.event SET
  image_url = 'https://upload.wikimedia.org/wikipedia/commons/6/6d/National_Museum_of_Contemporary_Art_Athens.jpg',
  image_gallery = '["https://upload.wikimedia.org/wikipedia/commons/6/6d/National_Museum_of_Contemporary_Art_Athens.jpg"]'::text
WHERE lower(trim(name)) = lower(trim('Eutopia Art Residency'));

-- Batch 2 (053) — shopping / food QA rows from migration 052
UPDATE public.event SET
  image_url = 'https://upload.wikimedia.org/wikipedia/commons/5/5b/Vins_dans_un_restaurant_grec.jpg',
  image_gallery = '["https://upload.wikimedia.org/wikipedia/commons/5/5b/Vins_dans_un_restaurant_grec.jpg"]'::text
WHERE lower(trim(name)) IN (
  lower(trim('aphaia.athens')),
  lower(trim('Aphaia Athens'))
);

UPDATE public.event SET
  image_url = 'https://upload.wikimedia.org/wikipedia/commons/7/72/Ribs_in_a_barbecue_%22pit%22.jpg',
  image_gallery = '["https://upload.wikimedia.org/wikipedia/commons/7/72/Ribs_in_a_barbecue_%22pit%22.jpg"]'::text
WHERE lower(trim(name)) = lower(trim('Fine Mess Smokehouse'));

UPDATE public.event SET
  image_url = 'https://upload.wikimedia.org/wikipedia/commons/4/48/Vintage_clothes_shop_with_a_vintage_shop_front_%288032311036%29.jpg',
  image_gallery = '["https://upload.wikimedia.org/wikipedia/commons/4/48/Vintage_clothes_shop_with_a_vintage_shop_front_%288032311036%29.jpg"]'::text
WHERE lower(trim(name)) = lower(trim('September'));

UPDATE public.event SET
  image_url = 'https://upload.wikimedia.org/wikipedia/commons/d/d6/Vinyl_record_shop_in_Athens.jpeg',
  image_gallery = '["https://upload.wikimedia.org/wikipedia/commons/d/d6/Vinyl_record_shop_in_Athens.jpeg"]'::text
WHERE lower(trim(name)) IN (lower(trim('TromeroPaidi')), lower(trim('Tromero Paidi')));

UPDATE public.event SET
  image_url = 'https://upload.wikimedia.org/wikipedia/commons/a/ac/Avissinias_01.jpg',
  image_gallery = '["https://upload.wikimedia.org/wikipedia/commons/a/ac/Avissinias_01.jpg"]'::text
WHERE lower(trim(name)) = lower(trim('Avyssinias Square Flea Market'));

UPDATE public.event SET
  image_url = 'https://upload.wikimedia.org/wikipedia/commons/2/29/Moussaka.jpg',
  image_gallery = '["https://upload.wikimedia.org/wikipedia/commons/2/29/Moussaka.jpg"]'::text
WHERE lower(trim(name)) = lower(trim('Seychelles Athens'));

UPDATE public.event SET
  image_url = 'https://upload.wikimedia.org/wikipedia/commons/5/51/COW_Vintage_Clothing_Digbeth.JPG',
  image_gallery = '["https://upload.wikimedia.org/wikipedia/commons/5/51/COW_Vintage_Clothing_Digbeth.JPG"]'::text
WHERE lower(trim(name)) = lower(trim('Itsclofie Vintage'));

UPDATE public.event SET
  image_url = 'https://upload.wikimedia.org/wikipedia/commons/2/27/Foxtrot_Vintage_Clothing%2C_Salisbury_-_geograph.org.uk_-_7893942.jpg',
  image_gallery = '["https://upload.wikimedia.org/wikipedia/commons/2/27/Foxtrot_Vintage_Clothing%2C_Salisbury_-_geograph.org.uk_-_7893942.jpg"]'::text
WHERE lower(trim(name)) = lower(trim('Mania Athens'));

UPDATE public.event SET
  image_url = 'https://upload.wikimedia.org/wikipedia/commons/a/ae/Coffee_Shops_%CE%92%CF%81%CE%B9%CE%BB%CE%AE%CF%83%CF%83%CE%B9%CE%B1.jpg',
  image_gallery = '["https://upload.wikimedia.org/wikipedia/commons/a/ae/Coffee_Shops_%CE%92%CF%81%CE%B9%CE%BB%CE%AE%CF%83%CF%83%CE%B9%CE%B1.jpg"]'::text
WHERE lower(trim(name)) IN (
  lower(trim('Minu Concept Store Café')),
  lower(trim('Minu Cafe Concept Store'))
);

UPDATE public.event SET
  image_url = 'https://upload.wikimedia.org/wikipedia/commons/f/fa/Electric_pottery_wheel.jpg',
  image_gallery = '["https://upload.wikimedia.org/wikipedia/commons/f/fa/Electric_pottery_wheel.jpg"]'::text
WHERE lower(trim(name)) = lower(trim('Fabrica Artspace'));

-- Link-level overrides must not trump DB gallery on list cards
UPDATE public.bandit_event
SET recommendation_place_photo_url = NULL
WHERE event_id IN (
  SELECT id FROM public.event
  WHERE lower(trim(name)) IN (
    lower(trim('Greek Drag Shows (Aggregator)')),
    lower(trim('Greek Drag Shows')),
    lower(trim('ASFA BBQ (Athens School of Fine Arts Festival)')),
    lower(trim('ASFA BBQ (Athens School of Fine Arts)')),
    lower(trim('Ronit Baranga (Exhibitions)')),
    lower(trim('Zurbaran Athens')),
    lower(trim('Sugar Killer')),
    lower(trim('Ohh Boy')),
    lower(trim('Ohh Boy Brunch Café')),
    lower(trim('The Blind Spot Pangrati')),
    lower(trim('The Blind Spot')),
    lower(trim('Eutopia Art Residency')),
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
