-- City Guide QA batch 2: replace wrong stock burgers / shopping clichés with distinct Wikimedia stand-ins.
-- Spot cards and detail screens both treat `image_gallery` gallery[0] as the verified hero (`getEventVenueGalleryOrdered`).
-- Editorial until real venue/Google galleries are attached; each URL below is distinct across this migration.

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
WHERE lower(trim(name)) = lower(trim('TromeroPaidi'));

UPDATE public.event SET
  image_url = 'https://upload.wikimedia.org/wikipedia/commons/a/ac/Avissinias_01.jpg',
  image_gallery = '["https://upload.wikimedia.org/wikipedia/commons/a/ac/Avissinias_01.jpg"]'::text
WHERE lower(trim(name)) = lower(trim('Avyssinias Square Flea Market'));

-- Distinct Greek taverna-style dish plate (replacing migration 049 stock); editorial until Places gallery is wired
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
