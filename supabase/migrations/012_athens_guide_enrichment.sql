-- Athens city guide enrichment (generated). Idempotent: skips existing event names.
begin;

-- Veganaki → Joanna (Food)
with ins as (
  insert into public.event (
    name, genre, start_time, end_time, timing_info, location_lat, location_lng, address, city, neighborhood, description, rating, image_url, link
  )
  select
    'Veganaki',
    'Food',
    '2025-06-01T18:00:00+03:00',
    '2025-06-01T23:59:00+03:00',
    'Mon–Sun: 12:00 – 22:00',
    37.97623,
    23.724701,
    'Athanasiou Diakou 38, Athens',
    'Athens',
    'Athens',
    'Cozy plant‑based spot serving hearty, feel‑good dishes — a fresh, green twist on Athenian comfort food.

Because even hardcore meat‑lovers leave full and happy.',
    4,
    'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=1200&h=900&fit=crop',
    'https://www.google.com/maps/search/?api=1&query=Veganaki%20Athanasiou%20Diakou%2038%2C%20Athens'
  where not exists (
    select 1 from public.event e where lower(trim(e.name)) = lower(trim('Veganaki'))
  )
  returning id
)
insert into public.bandit_event (bandit_id, event_id, personal_tip)
select
  (select id from public.bandit where name ilike 'Joanna' limit 1),
  ins.id,
  'Cozy plant‑based spot serving hearty, feel‑good dishes — a fresh, green twist on Athenian comfort food.'
from ins
where not exists (
  select 1 from public.bandit_event be join public.event ev on ev.id = be.event_id where ev.name = 'Veganaki'
);

-- Romantso → Sonia (Nightlife)
with ins as (
  insert into public.event (
    name, genre, start_time, end_time, timing_info, location_lat, location_lng, address, city, neighborhood, description, rating, image_url, link
  )
  select
    'Romantso',
    'Nightlife',
    '2025-06-01T18:00:00+03:00',
    '2025-06-01T23:59:00+03:00',
    'Events & exhibitions — varies',
    37.981708,
    23.721163,
    'Anaxagora 3–5, Athens',
    'Athens',
    'Athens',
    'A cultural maze of underground beats, art shows, drag nights and urban creativity — bar + incubator.

Because it’s a cornerstone of Athens’ alternative culture.',
    4,
    'https://images.pexels.com/photos/1763075/pexels-photo-1763075.jpeg?auto=compress&cs=tinysrgb&w=1200&h=900&fit=crop',
    'https://www.google.com/maps/search/?api=1&query=Romantso%20Anaxagora%203%E2%80%935%2C%20Athens'
  where not exists (
    select 1 from public.event e where lower(trim(e.name)) = lower(trim('Romantso'))
  )
  returning id
)
insert into public.bandit_event (bandit_id, event_id, personal_tip)
select
  (select id from public.bandit where name ilike 'Sonia' limit 1),
  ins.id,
  'A cultural maze of underground beats, art shows, drag nights and urban creativity — bar + incubator.'
from ins
where not exists (
  select 1 from public.bandit_event be join public.event ev on ev.id = be.event_id where ev.name = 'Romantso'
);

-- Joshua Tree Café → Elia (Coffee)
with ins as (
  insert into public.event (
    name, genre, start_time, end_time, timing_info, location_lat, location_lng, address, city, neighborhood, description, rating, image_url, link
  )
  select
    'Joshua Tree Café',
    'Coffee',
    '2025-06-01T18:00:00+03:00',
    '2025-06-01T23:59:00+03:00',
    'Mon–Fri: 09:00 – 20:00 | Sat–Sun: 10:00 – 18:00',
    37.984197,
    23.716277,
    'Skoufa 47, Kolonaki, Athens',
    'Athens',
    'Kolonaki',
    'Colorful plates, smooth coffee and fresh salads — creativity meets comfort in every dish.

Because brunch here is a whole vibe — easy, tasty and photogenic.',
    4,
    'https://images.pexels.com/photos/302899/pexels-photo-302899.jpeg?auto=compress&cs=tinysrgb&w=1200&h=900&fit=crop',
    'https://www.google.com/maps/search/?api=1&query=Joshua%20Tree%20Caf%C3%A9%20Skoufa%2047%2C%20Kolonaki%2C%20Athens'
  where not exists (
    select 1 from public.event e where lower(trim(e.name)) = lower(trim('Joshua Tree Café'))
  )
  returning id
)
insert into public.bandit_event (bandit_id, event_id, personal_tip)
select
  (select id from public.bandit where name ilike 'Elia' limit 1),
  ins.id,
  'Colorful plates, smooth coffee and fresh salads — creativity meets comfort in every dish.'
from ins
where not exists (
  select 1 from public.bandit_event be join public.event ev on ev.id = be.event_id where ev.name = 'Joshua Tree Café'
);

-- Avioti Fashion ED → Neo (Culture)
with ins as (
  insert into public.event (
    name, genre, start_time, end_time, timing_info, location_lat, location_lng, address, city, neighborhood, description, rating, image_url, link
  )
  select
    'Avioti Fashion ED',
    'Culture',
    '2025-06-01T18:00:00+03:00',
    '2025-06-01T23:59:00+03:00',
    'By appointment / workshop schedule',
    37.977693,
    23.715115,
    'Ermou 51, Athens',
    'Athens',
    'Athens',
    'Exclusive fashion & visual art lab offering courses, workshops and collaborations with new designers.

Because it’s where fashion meets art — front‑row to Athens’ rising talent.',
    4,
    'https://images.pexels.com/photos/237294/pexels-photo-237294.jpeg?auto=compress&cs=tinysrgb&w=1200&h=900&fit=crop',
    'https://www.google.com/maps/search/?api=1&query=Avioti%20Fashion%20ED%20Ermou%2051%2C%20Athens'
  where not exists (
    select 1 from public.event e where lower(trim(e.name)) = lower(trim('Avioti Fashion ED'))
  )
  returning id
)
insert into public.bandit_event (bandit_id, event_id, personal_tip)
select
  (select id from public.bandit where name ilike 'Neo' limit 1),
  ins.id,
  'Exclusive fashion & visual art lab offering courses, workshops and collaborations with new designers.'
from ins
where not exists (
  select 1 from public.bandit_event be join public.event ev on ev.id = be.event_id where ev.name = 'Avioti Fashion ED'
);

-- Avant‑Drag! → Joanna (Culture)
with ins as (
  insert into public.event (
    name, genre, start_time, end_time, timing_info, location_lat, location_lng, address, city, neighborhood, description, rating, image_url, link
  )
  select
    'Avant‑Drag!',
    'Culture',
    '2025-06-01T18:00:00+03:00',
    '2025-06-01T23:59:00+03:00',
    'Special screenings & events',
    37.977762,
    23.717988,
    'Various venues (check program)',
    'Athens',
    'Athens',
    'Radical performers reimagine Athens through art, cinema and live shows. Bold, unapologetic, boundary‑pushing.

Because it’s resistance, poetry and celebration — all in one.',
    4,
    'https://images.pexels.com/photos/237294/pexels-photo-237294.jpeg?auto=compress&cs=tinysrgb&w=1200&h=900&fit=crop',
    'https://www.google.com/maps/search/?api=1&query=Avant%E2%80%91Drag!%20Various%20venues%20(check%20program)'
  where not exists (
    select 1 from public.event e where lower(trim(e.name)) = lower(trim('Avant‑Drag!'))
  )
  returning id
)
insert into public.bandit_event (bandit_id, event_id, personal_tip)
select
  (select id from public.bandit where name ilike 'Joanna' limit 1),
  ins.id,
  'Radical performers reimagine Athens through art, cinema and live shows. Bold, unapologetic, boundary‑pushing.'
from ins
where not exists (
  select 1 from public.bandit_event be join public.event ev on ev.id = be.event_id where ev.name = 'Avant‑Drag!'
);

-- Koukles Club Athens → Sonia (Culture)
with ins as (
  insert into public.event (
    name, genre, start_time, end_time, timing_info, location_lat, location_lng, address, city, neighborhood, description, rating, image_url, link
  )
  select
    'Koukles Club Athens',
    'Culture',
    '2025-06-01T18:00:00+03:00',
    '2025-06-01T23:59:00+03:00',
    'Currently closed (archival / legacy spot)',
    37.982624,
    23.715885,
    'Drosopoulou 47, Kypseli, Athens, Greece',
    'Athens',
    'Kypseli',
    'One of Athens’ most iconic drag cabaret clubs — home to legendary queens and unforgettable nights.

Because it’s a cornerstone of Athens’ queer history and nightlife legacy.



1. Vezené Greek Restaurant',
    4,
    'https://images.pexels.com/photos/237294/pexels-photo-237294.jpeg?auto=compress&cs=tinysrgb&w=1200&h=900&fit=crop',
    'https://www.google.com/maps/search/?api=1&query=Koukles%20Club%20Athens%20Drosopoulou%2047%2C%20Kypseli%2C%20Athens%2C%20Greece'
  where not exists (
    select 1 from public.event e where lower(trim(e.name)) = lower(trim('Koukles Club Athens'))
  )
  returning id
)
insert into public.bandit_event (bandit_id, event_id, personal_tip)
select
  (select id from public.bandit where name ilike 'Sonia' limit 1),
  ins.id,
  'One of Athens’ most iconic drag cabaret clubs — home to legendary queens and unforgettable nights.'
from ins
where not exists (
  select 1 from public.bandit_event be join public.event ev on ev.id = be.event_id where ev.name = 'Koukles Club Athens'
);

-- Potential Project → Elia (Culture)
with ins as (
  insert into public.event (
    name, genre, start_time, end_time, timing_info, location_lat, location_lng, address, city, neighborhood, description, rating, image_url, link
  )
  select
    'Potential Project',
    'Culture',
    '2025-06-01T18:00:00+03:00',
    '2025-06-01T23:59:00+03:00',
    'Event‑based',
    37.981756,
    23.71705,
    'Andrea Metaxa 25, Exarchia, Athens',
    'Athens',
    'Exarchia',
    'Artist‑run initiative hosting experimental exhibitions, performances and talks in the heart of Exarchia.

Because it’s a hub for cutting‑edge artistic experimentation.',
    4,
    'https://images.pexels.com/photos/237294/pexels-photo-237294.jpeg?auto=compress&cs=tinysrgb&w=1200&h=900&fit=crop',
    'https://www.google.com/maps/search/?api=1&query=Potential%20Project%20Andrea%20Metaxa%2025%2C%20Exarchia%2C%20Athens'
  where not exists (
    select 1 from public.event e where lower(trim(e.name)) = lower(trim('Potential Project'))
  )
  returning id
)
insert into public.bandit_event (bandit_id, event_id, personal_tip)
select
  (select id from public.bandit where name ilike 'Elia' limit 1),
  ins.id,
  'Artist‑run initiative hosting experimental exhibitions, performances and talks in the heart of Exarchia.'
from ins
where not exists (
  select 1 from public.bandit_event be join public.event ev on ev.id = be.event_id where ev.name = 'Potential Project'
);

-- Krabo Beach Bar & Restaurant → Neo (Food)
with ins as (
  insert into public.event (
    name, genre, start_time, end_time, timing_info, location_lat, location_lng, address, city, neighborhood, description, rating, image_url, link
  )
  select
    'Krabo Beach Bar & Restaurant',
    'Food',
    '2025-06-01T18:00:00+03:00',
    '2025-06-01T23:59:00+03:00',
    'Daily: 10:00 – 01:00',
    37.975938,
    23.718738,
    'Leof. Athinon Souniou 130, Vouliagmeni, Athens Riviera',
    'Athens',
    'Vouliagmeni',
    'A hidden escape where Athens meets the Aegean — golden sand, crystal waters and cocktails by the waves. Fresh seafood with a sunset soundtrack.

Because it’s the Athens Riviera lifestyle — stylish, chilled, unforgettable.',
    4,
    'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=1200&h=900&fit=crop',
    'https://www.google.com/maps/search/?api=1&query=Krabo%20Beach%20Bar%20%26%20Restaurant%20Leof.%20Athinon%20Souniou%20130%2C%20Vouliagmeni%2C%20Athens%20Riviera'
  where not exists (
    select 1 from public.event e where lower(trim(e.name)) = lower(trim('Krabo Beach Bar & Restaurant'))
  )
  returning id
)
insert into public.bandit_event (bandit_id, event_id, personal_tip)
select
  (select id from public.bandit where name ilike 'Neo' limit 1),
  ins.id,
  'A hidden escape where Athens meets the Aegean — golden sand, crystal waters and cocktails by the waves. Fresh seafood with a sunset soundtrack.'
from ins
where not exists (
  select 1 from public.bandit_event be join public.event ev on ev.id = be.event_id where ev.name = 'Krabo Beach Bar & Restaurant'
);

-- Avant‑Drag! (Film / Events) → Joanna (Culture)
with ins as (
  insert into public.event (
    name, genre, start_time, end_time, timing_info, location_lat, location_lng, address, city, neighborhood, description, rating, image_url, link
  )
  select
    'Avant‑Drag! (Film / Events)',
    'Culture',
    '2025-06-01T18:00:00+03:00',
    '2025-06-01T23:59:00+03:00',
    'Screenings & pop‑ups – check socials',
    37.981746,
    23.722133,
    'Athens – venues vary',
    'Athens',
    'Athens',
    'Radical performers re‑imagining Athens—docu screenings + live acts.

A window into the city’s experimental queer scene.',
    4,
    'https://images.pexels.com/photos/237294/pexels-photo-237294.jpeg?auto=compress&cs=tinysrgb&w=1200&h=900&fit=crop',
    'https://www.google.com/maps/search/?api=1&query=Avant%E2%80%91Drag!%20(Film%20%2F%20Events)%20Athens%20%E2%80%93%20venues%20vary'
  where not exists (
    select 1 from public.event e where lower(trim(e.name)) = lower(trim('Avant‑Drag! (Film / Events)'))
  )
  returning id
)
insert into public.bandit_event (bandit_id, event_id, personal_tip)
select
  (select id from public.bandit where name ilike 'Joanna' limit 1),
  ins.id,
  'Radical performers re‑imagining Athens—docu screenings + live acts.'
from ins
where not exists (
  select 1 from public.bandit_event be join public.event ev on ev.id = be.event_id where ev.name = 'Avant‑Drag! (Film / Events)'
);

-- The Agora Project (Impact Hub) → Sonia (Culture)
with ins as (
  insert into public.event (
    name, genre, start_time, end_time, timing_info, location_lat, location_lng, address, city, neighborhood, description, rating, image_url, link
  )
  select
    'The Agora Project (Impact Hub)',
    'Culture',
    '2025-06-01T18:00:00+03:00',
    '2025-06-01T23:59:00+03:00',
    'Events & markets – check socials',
    37.979103,
    23.715864,
    'Karaiskaki 28, Athens',
    'Athens',
    'Athens',
    'Community hub with social markets, cultural events and workshops.

Great place to meet locals doing meaningful work.',
    4,
    'https://images.pexels.com/photos/237294/pexels-photo-237294.jpeg?auto=compress&cs=tinysrgb&w=1200&h=900&fit=crop',
    'https://www.google.com/maps/search/?api=1&query=The%20Agora%20Project%20(Impact%20Hub)%20Karaiskaki%2028%2C%20Athens'
  where not exists (
    select 1 from public.event e where lower(trim(e.name)) = lower(trim('The Agora Project (Impact Hub)'))
  )
  returning id
)
insert into public.bandit_event (bandit_id, event_id, personal_tip)
select
  (select id from public.bandit where name ilike 'Sonia' limit 1),
  ins.id,
  'Community hub with social markets, cultural events and workshops.'
from ins
where not exists (
  select 1 from public.bandit_event be join public.event ev on ev.id = be.event_id where ev.name = 'The Agora Project (Impact Hub)'
);

-- Cookoomela Grill → Elia (Food)
with ins as (
  insert into public.event (
    name, genre, start_time, end_time, timing_info, location_lat, location_lng, address, city, neighborhood, description, rating, image_url, link
  )
  select
    'Cookoomela Grill',
    'Food',
    '2025-06-01T18:00:00+03:00',
    '2025-06-01T23:59:00+03:00',
    'Mon–Sat: 13:00 – 23:30 | Sun: Closed',
    37.976833,
    23.716906,
    'Asklipiou 42, Exarchia, Athens',
    'Athens',
    'Exarchia',
    'Plant‑based souvlaki that somehow tastes even juicier than the real thing. Wraps loaded with mushrooms, halloumi, hummus and roasted veggies.

Because Athens isn’t only about pork gyros — this is smart modern street food.',
    4,
    'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=1200&h=900&fit=crop',
    'https://www.google.com/maps/search/?api=1&query=Cookoomela%20Grill%20Asklipiou%2042%2C%20Exarchia%2C%20Athens'
  where not exists (
    select 1 from public.event e where lower(trim(e.name)) = lower(trim('Cookoomela Grill'))
  )
  returning id
)
insert into public.bandit_event (bandit_id, event_id, personal_tip)
select
  (select id from public.bandit where name ilike 'Elia' limit 1),
  ins.id,
  'Plant‑based souvlaki that somehow tastes even juicier than the real thing. Wraps loaded with mushrooms, halloumi, hummus and roasted veggies.'
from ins
where not exists (
  select 1 from public.bandit_event be join public.event ev on ev.id = be.event_id where ev.name = 'Cookoomela Grill'
);

-- BeQueer Athens → Neo (Nightlife)
with ins as (
  insert into public.event (
    name, genre, start_time, end_time, timing_info, location_lat, location_lng, address, city, neighborhood, description, rating, image_url, link
  )
  select
    'BeQueer Athens',
    'Nightlife',
    '2025-06-01T18:00:00+03:00',
    '2025-06-01T23:59:00+03:00',
    'Fri–Sat: Midnight – 06:00',
    37.982439,
    23.716194,
    'Central Athens (exact location via socials)',
    'Athens',
    'Athens',
    'Athens’ iconic queer club, famous for wild drag shows, a no‑reservations policy and an all‑night dance floor.

Because it’s the beating heart of queer nightlife in Athens — bold and fabulous.',
    4,
    'https://images.pexels.com/photos/1763075/pexels-photo-1763075.jpeg?auto=compress&cs=tinysrgb&w=1200&h=900&fit=crop',
    'https://www.google.com/maps/search/?api=1&query=BeQueer%20Athens%20Central%20Athens%20(exact%20location%20via%20socials)'
  where not exists (
    select 1 from public.event e where lower(trim(e.name)) = lower(trim('BeQueer Athens'))
  )
  returning id
)
insert into public.bandit_event (bandit_id, event_id, personal_tip)
select
  (select id from public.bandit where name ilike 'Neo' limit 1),
  ins.id,
  'Athens’ iconic queer club, famous for wild drag shows, a no‑reservations policy and an all‑night dance floor.'
from ins
where not exists (
  select 1 from public.bandit_event be join public.event ev on ev.id = be.event_id where ev.name = 'BeQueer Athens'
);

-- Share Wish Tea → Joanna (Coffee)
with ins as (
  insert into public.event (
    name, genre, start_time, end_time, timing_info, location_lat, location_lng, address, city, neighborhood, description, rating, image_url, link
  )
  select
    'Share Wish Tea',
    'Coffee',
    '2025-06-01T18:00:00+03:00',
    '2025-06-01T23:59:00+03:00',
    'Varies (check socials)',
    37.983357,
    23.719276,
    'City Center, Athens',
    'Athens',
    'Athens Center',
    'Asian‑style tea bar mixing creamy matcha, fruit teas and chewy pearls.

A sweet pit‑stop between galleries and shopping.',
    4,
    'https://images.pexels.com/photos/302899/pexels-photo-302899.jpeg?auto=compress&cs=tinysrgb&w=1200&h=900&fit=crop',
    'https://www.google.com/maps/search/?api=1&query=Share%20Wish%20Tea%20City%20Center%2C%20Athens'
  where not exists (
    select 1 from public.event e where lower(trim(e.name)) = lower(trim('Share Wish Tea'))
  )
  returning id
)
insert into public.bandit_event (bandit_id, event_id, personal_tip)
select
  (select id from public.bandit where name ilike 'Joanna' limit 1),
  ins.id,
  'Asian‑style tea bar mixing creamy matcha, fruit teas and chewy pearls.'
from ins
where not exists (
  select 1 from public.bandit_event be join public.event ev on ev.id = be.event_id where ev.name = 'Share Wish Tea'
);

-- Greek Drag Shows (Aggregator) → Sonia (Food)
with ins as (
  insert into public.event (
    name, genre, start_time, end_time, timing_info, location_lat, location_lng, address, city, neighborhood, description, rating, image_url, link
  )
  select
    'Greek Drag Shows (Aggregator)',
    'Food',
    '2025-06-01T18:00:00+03:00',
    '2025-06-01T23:59:00+03:00',
    'Weekly updates',
    37.981872,
    23.722532,
    'Across Greece (Athens focus)',
    'Athens',
    'Athens',
    'Tracks drag shows and cabaret nights around Greece—DM to submit events.

One follow to know where the queens are tonight.',
    4,
    'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=1200&h=900&fit=crop',
    'https://www.google.com/maps/search/?api=1&query=Greek%20Drag%20Shows%20(Aggregator)%20Across%20Greece%20(Athens%20focus)'
  where not exists (
    select 1 from public.event e where lower(trim(e.name)) = lower(trim('Greek Drag Shows (Aggregator)'))
  )
  returning id
)
insert into public.bandit_event (bandit_id, event_id, personal_tip)
select
  (select id from public.bandit where name ilike 'Sonia' limit 1),
  ins.id,
  'Tracks drag shows and cabaret nights around Greece—DM to submit events.'
from ins
where not exists (
  select 1 from public.bandit_event be join public.event ev on ev.id = be.event_id where ev.name = 'Greek Drag Shows (Aggregator)'
);

-- Ronit Baranga (Exhibitions) → Elia (Culture)
with ins as (
  insert into public.event (
    name, genre, start_time, end_time, timing_info, location_lat, location_lng, address, city, neighborhood, description, rating, image_url, link
  )
  select
    'Ronit Baranga (Exhibitions)',
    'Culture',
    '2025-06-01T18:00:00+03:00',
    '2025-06-01T23:59:00+03:00',
    'By exhibition schedule',
    37.982739,
    23.715528,
    'Athens — venues vary (check galleries)',
    'Athens',
    'Athens',
    'Surreal sculptures merging the human body with everyday objects — provocative, playful and a little unsettling.

Because the works stare back at you — and you don’t forget them.',
    4,
    'https://images.pexels.com/photos/237294/pexels-photo-237294.jpeg?auto=compress&cs=tinysrgb&w=1200&h=900&fit=crop',
    'https://www.google.com/maps/search/?api=1&query=Ronit%20Baranga%20(Exhibitions)%20Athens%20%E2%80%94%20venues%20vary%20(check%20galleries)'
  where not exists (
    select 1 from public.event e where lower(trim(e.name)) = lower(trim('Ronit Baranga (Exhibitions)'))
  )
  returning id
)
insert into public.bandit_event (bandit_id, event_id, personal_tip)
select
  (select id from public.bandit where name ilike 'Elia' limit 1),
  ins.id,
  'Surreal sculptures merging the human body with everyday objects — provocative, playful and a little unsettling.'
from ins
where not exists (
  select 1 from public.bandit_event be join public.event ev on ev.id = be.event_id where ev.name = 'Ronit Baranga (Exhibitions)'
);

-- Eutopia Art Residency → Neo (Culture)
with ins as (
  insert into public.event (
    name, genre, start_time, end_time, timing_info, location_lat, location_lng, address, city, neighborhood, description, rating, image_url, link
  )
  select
    'Eutopia Art Residency',
    'Culture',
    '2025-06-01T18:00:00+03:00',
    '2025-06-01T23:59:00+03:00',
    'By appointment & during exhibitions',
    37.981083,
    23.7222,
    'Byron House, Athens (plus satellite sites)',
    'Athens',
    'Athens',
    'A creative haven where artists live, work and show in Athens. Open calls, exchanges and experimentation.

Because it’s where global creativity plugs into the Athenian vibe.',
    4,
    'https://images.pexels.com/photos/237294/pexels-photo-237294.jpeg?auto=compress&cs=tinysrgb&w=1200&h=900&fit=crop',
    'https://www.google.com/maps/search/?api=1&query=Eutopia%20Art%20Residency%20Byron%20House%2C%20Athens%20(plus%20satellite%20sites)'
  where not exists (
    select 1 from public.event e where lower(trim(e.name)) = lower(trim('Eutopia Art Residency'))
  )
  returning id
)
insert into public.bandit_event (bandit_id, event_id, personal_tip)
select
  (select id from public.bandit where name ilike 'Neo' limit 1),
  ins.id,
  'A creative haven where artists live, work and show in Athens. Open calls, exchanges and experimentation.'
from ins
where not exists (
  select 1 from public.bandit_event be join public.event ev on ev.id = be.event_id where ev.name = 'Eutopia Art Residency'
);

-- Sessions (sesSSSions) → Joanna (Food)
with ins as (
  insert into public.event (
    name, genre, start_time, end_time, timing_info, location_lat, location_lng, address, city, neighborhood, description, rating, image_url, link
  )
  select
    'Sessions (sesSSSions)',
    'Food',
    '2025-06-01T18:00:00+03:00',
    '2025-06-01T23:59:00+03:00',
    'Events – check socials',
    37.977682,
    23.718498,
    'Nicosia, Cyprus (friends of the Athens scene)',
    'Athens',
    'Athens',
    'A series of boundary‑pushing queer events—collabs with Athens artists.

Worth the hop—shared DNA with Athens’ DIY culture.',
    4,
    'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=1200&h=900&fit=crop',
    'https://www.google.com/maps/search/?api=1&query=Sessions%20(sesSSSions)%20Nicosia%2C%20Cyprus%20(friends%20of%20the%20Athens%20scene)'
  where not exists (
    select 1 from public.event e where lower(trim(e.name)) = lower(trim('Sessions (sesSSSions)'))
  )
  returning id
)
insert into public.bandit_event (bandit_id, event_id, personal_tip)
select
  (select id from public.bandit where name ilike 'Joanna' limit 1),
  ins.id,
  'A series of boundary‑pushing queer events—collabs with Athens artists.'
from ins
where not exists (
  select 1 from public.bandit_event be join public.event ev on ev.id = be.event_id where ev.name = 'Sessions (sesSSSions)'
);

-- ASFA BBQ (Athens School of Fine Arts Festival) → Sonia (Culture)
with ins as (
  insert into public.event (
    name, genre, start_time, end_time, timing_info, location_lat, location_lng, address, city, neighborhood, description, rating, image_url, link
  )
  select
    'ASFA BBQ (Athens School of Fine Arts Festival)',
    'Culture',
    '2025-06-01T18:00:00+03:00',
    '2025-06-01T23:59:00+03:00',
    'Annual – dates vary',
    37.983615,
    23.722248,
    'Peiraios 256, Athens',
    'Athens',
    'Athens',
    'Chaotic, brilliant student‑run art/performance festival—Athens underground energy.

Where you meet tomorrow’s artists today.',
    4,
    'https://images.pexels.com/photos/237294/pexels-photo-237294.jpeg?auto=compress&cs=tinysrgb&w=1200&h=900&fit=crop',
    'https://www.google.com/maps/search/?api=1&query=ASFA%20BBQ%20(Athens%20School%20of%20Fine%20Arts%20Festival)%20Peiraios%20256%2C%20Athens'
  where not exists (
    select 1 from public.event e where lower(trim(e.name)) = lower(trim('ASFA BBQ (Athens School of Fine Arts Festival)'))
  )
  returning id
)
insert into public.bandit_event (bandit_id, event_id, personal_tip)
select
  (select id from public.bandit where name ilike 'Sonia' limit 1),
  ins.id,
  'Chaotic, brilliant student‑run art/performance festival—Athens underground energy.'
from ins
where not exists (
  select 1 from public.bandit_event be join public.event ev on ev.id = be.event_id where ev.name = 'ASFA BBQ (Athens School of Fine Arts Festival)'
);

-- Zurbaran Athens → Elia (Food)
with ins as (
  insert into public.event (
    name, genre, start_time, end_time, timing_info, location_lat, location_lng, address, city, neighborhood, description, rating, image_url, link
  )
  select
    'Zurbaran Athens',
    'Food',
    '2025-06-01T18:00:00+03:00',
    '2025-06-01T23:59:00+03:00',
    'Mon–Sun: 10:00 – 02:00',
    37.981569,
    23.721971,
    'Voukourestiou 20, Kolonaki, Athens',
    'Athens',
    'Kolonaki',
    'A stylish Kolonaki hotspot — creative plates, photogenic presentation and a buzzing, elegant atmosphere.

Because it’s where flavor meets finesse — chic night out guaranteed.',
    4,
    'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=1200&h=900&fit=crop',
    'https://www.google.com/maps/search/?api=1&query=Zurbaran%20Athens%20Voukourestiou%2020%2C%20Kolonaki%2C%20Athens'
  where not exists (
    select 1 from public.event e where lower(trim(e.name)) = lower(trim('Zurbaran Athens'))
  )
  returning id
)
insert into public.bandit_event (bandit_id, event_id, personal_tip)
select
  (select id from public.bandit where name ilike 'Elia' limit 1),
  ins.id,
  'A stylish Kolonaki hotspot — creative plates, photogenic presentation and a buzzing, elegant atmosphere.'
from ins
where not exists (
  select 1 from public.bandit_event be join public.event ev on ev.id = be.event_id where ev.name = 'Zurbaran Athens'
);

-- ASFA BBQ (Athens School of Fine Arts) → Neo (Culture)
with ins as (
  insert into public.event (
    name, genre, start_time, end_time, timing_info, location_lat, location_lng, address, city, neighborhood, description, rating, image_url, link
  )
  select
    'ASFA BBQ (Athens School of Fine Arts)',
    'Culture',
    '2025-06-01T18:00:00+03:00',
    '2025-06-01T23:59:00+03:00',
    'Annual event (check dates each year)',
    37.981837,
    23.717796,
    'Peiraios 256, Athens',
    'Athens',
    'Athens',
    'The legendary student‑run performance festival — experimental art, installations and unforgettable happenings.

Because it’s Athens at its rawest and most creative.',
    4,
    'https://images.pexels.com/photos/237294/pexels-photo-237294.jpeg?auto=compress&cs=tinysrgb&w=1200&h=900&fit=crop',
    'https://www.google.com/maps/search/?api=1&query=ASFA%20BBQ%20(Athens%20School%20of%20Fine%20Arts)%20Peiraios%20256%2C%20Athens'
  where not exists (
    select 1 from public.event e where lower(trim(e.name)) = lower(trim('ASFA BBQ (Athens School of Fine Arts)'))
  )
  returning id
)
insert into public.bandit_event (bandit_id, event_id, personal_tip)
select
  (select id from public.bandit where name ilike 'Neo' limit 1),
  ins.id,
  'The legendary student‑run performance festival — experimental art, installations and unforgettable happenings.'
from ins
where not exists (
  select 1 from public.bandit_event be join public.event ev on ev.id = be.event_id where ev.name = 'ASFA BBQ (Athens School of Fine Arts)'
);

-- S‑CAPE Club → Joanna (Nightlife)
with ins as (
  insert into public.event (
    name, genre, start_time, end_time, timing_info, location_lat, location_lng, address, city, neighborhood, description, rating, image_url, link
  )
  select
    'S‑CAPE Club',
    'Nightlife',
    '2025-06-01T18:00:00+03:00',
    '2025-06-01T23:59:00+03:00',
    'Fri–Sat: 23:30 – late (weekdays vary; check socials)',
    37.97973,
    23.724263,
    'Gazi, Athens',
    'Athens',
    'Gazi',
    'Looking for a night that doesn’t end? S‑CAPE is one of the hottest LGBTQ+ clubs in Athens, packed with locals and travelers moving as one under the disco ball.

Because sometimes Athens feels like Berlin — DJs till sunrise and pure freedom on the dance floor.',
    4,
    'https://images.pexels.com/photos/1763075/pexels-photo-1763075.jpeg?auto=compress&cs=tinysrgb&w=1200&h=900&fit=crop',
    'https://www.google.com/maps/search/?api=1&query=S%E2%80%91CAPE%20Club%20Gazi%2C%20Athens'
  where not exists (
    select 1 from public.event e where lower(trim(e.name)) = lower(trim('S‑CAPE Club'))
  )
  returning id
)
insert into public.bandit_event (bandit_id, event_id, personal_tip)
select
  (select id from public.bandit where name ilike 'Joanna' limit 1),
  ins.id,
  'Looking for a night that doesn’t end? S‑CAPE is one of the hottest LGBTQ+ clubs in Athens, packed with locals and travelers moving as one under the disco ball.'
from ins
where not exists (
  select 1 from public.bandit_event be join public.event ev on ev.id = be.event_id where ev.name = 'S‑CAPE Club'
);

-- Cultterra → Sonia (Food)
with ins as (
  insert into public.event (
    name, genre, start_time, end_time, timing_info, location_lat, location_lng, address, city, neighborhood, description, rating, image_url, link
  )
  select
    'Cultterra',
    'Food',
    '2025-06-01T18:00:00+03:00',
    '2025-06-01T23:59:00+03:00',
    'Event‑based',
    37.977987,
    23.722137,
    'Elefsina, Attiki (check socials)',
    'Athens',
    'Elefsina',
    'Youth‑led collective transforming Elefsina with grassroots energy — art, education, drag shows and underground performances.

Because it’s raw, inclusive DIY culture that amplifies new voices.',
    4,
    'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=1200&h=900&fit=crop',
    'https://www.google.com/maps/search/?api=1&query=Cultterra%20Elefsina%2C%20Attiki%20(check%20socials)'
  where not exists (
    select 1 from public.event e where lower(trim(e.name)) = lower(trim('Cultterra'))
  )
  returning id
)
insert into public.bandit_event (bandit_id, event_id, personal_tip)
select
  (select id from public.bandit where name ilike 'Sonia' limit 1),
  ins.id,
  'Youth‑led collective transforming Elefsina with grassroots energy — art, education, drag shows and underground performances.'
from ins
where not exists (
  select 1 from public.bandit_event be join public.event ev on ev.id = be.event_id where ev.name = 'Cultterra'
);

-- Lukumades → Elia (Food)
with ins as (
  insert into public.event (
    name, genre, start_time, end_time, timing_info, location_lat, location_lng, address, city, neighborhood, description, rating, image_url, link
  )
  select
    'Lukumades',
    'Food',
    '2025-06-01T18:00:00+03:00',
    '2025-06-01T23:59:00+03:00',
    'Mon–Sun: 09:00 – 01:00',
    37.984758,
    23.723363,
    'Multiple locations, Athens',
    'Athens',
    'Athens',
    'Crispy on the outside, soft inside — Greece’s answer to donuts with playful toppings like chocolate, nuts and ice cream.

Because it nails the balance between nostalgic and modern indulgence.',
    4,
    'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=1200&h=900&fit=crop',
    'https://www.google.com/maps/search/?api=1&query=Lukumades%20Multiple%20locations%2C%20Athens'
  where not exists (
    select 1 from public.event e where lower(trim(e.name)) = lower(trim('Lukumades'))
  )
  returning id
)
insert into public.bandit_event (bandit_id, event_id, personal_tip)
select
  (select id from public.bandit where name ilike 'Elia' limit 1),
  ins.id,
  'Crispy on the outside, soft inside — Greece’s answer to donuts with playful toppings like chocolate, nuts and ice cream.'
from ins
where not exists (
  select 1 from public.bandit_event be join public.event ev on ev.id = be.event_id where ev.name = 'Lukumades'
);

-- Dybbuk Club → Neo (Nightlife)
with ins as (
  insert into public.event (
    name, genre, start_time, end_time, timing_info, location_lat, location_lng, address, city, neighborhood, description, rating, image_url, link
  )
  select
    'Dybbuk Club',
    'Nightlife',
    '2025-06-01T18:00:00+03:00',
    '2025-06-01T23:59:00+03:00',
    'Thu–Sat: 23:30 – 06:00',
    37.977145,
    23.716009,
    'Stadiou 7, Syntagma, Athens',
    'Athens',
    'Syntagma',
    'Dybbuk isn’t just a nightclub – it’s an Athens nightlife legend. Deep house vibes, international DJs and a dance floor that never cools down.

Because if you haven’t lost yourself on Dybbuk’s floor, you haven’t really done Athens nightlife.',
    4,
    'https://images.pexels.com/photos/1763075/pexels-photo-1763075.jpeg?auto=compress&cs=tinysrgb&w=1200&h=900&fit=crop',
    'https://www.google.com/maps/search/?api=1&query=Dybbuk%20Club%20Stadiou%207%2C%20Syntagma%2C%20Athens'
  where not exists (
    select 1 from public.event e where lower(trim(e.name)) = lower(trim('Dybbuk Club'))
  )
  returning id
)
insert into public.bandit_event (bandit_id, event_id, personal_tip)
select
  (select id from public.bandit where name ilike 'Neo' limit 1),
  ins.id,
  'Dybbuk isn’t just a nightclub – it’s an Athens nightlife legend. Deep house vibes, international DJs and a dance floor that never cools down.'
from ins
where not exists (
  select 1 from public.bandit_event be join public.event ev on ev.id = be.event_id where ev.name = 'Dybbuk Club'
);

-- Dybbuk Athens → Joanna (Nightlife)
with ins as (
  insert into public.event (
    name, genre, start_time, end_time, timing_info, location_lat, location_lng, address, city, neighborhood, description, rating, image_url, link
  )
  select
    'Dybbuk Athens',
    'Nightlife',
    '2025-06-01T18:00:00+03:00',
    '2025-06-01T23:59:00+03:00',
    'Varies – late night (check socials)',
    37.977397,
    23.719112,
    'Central Athens (Kolonaki area)',
    'Athens',
    'Kolonaki',
    'A legendary Athens club for sweaty, big‑room nights and guest DJs.

For the peak‑hour chaos—lasers, bass, and a crowd that goes till sunrise.',
    4,
    'https://images.pexels.com/photos/1763075/pexels-photo-1763075.jpeg?auto=compress&cs=tinysrgb&w=1200&h=900&fit=crop',
    'https://www.google.com/maps/search/?api=1&query=Dybbuk%20Athens%20Central%20Athens%20(Kolonaki%20area)'
  where not exists (
    select 1 from public.event e where lower(trim(e.name)) = lower(trim('Dybbuk Athens'))
  )
  returning id
)
insert into public.bandit_event (bandit_id, event_id, personal_tip)
select
  (select id from public.bandit where name ilike 'Joanna' limit 1),
  ins.id,
  'A legendary Athens club for sweaty, big‑room nights and guest DJs.'
from ins
where not exists (
  select 1 from public.bandit_event be join public.event ev on ev.id = be.event_id where ev.name = 'Dybbuk Athens'
);

-- Astir Beach → Sonia (Food)
with ins as (
  insert into public.event (
    name, genre, start_time, end_time, timing_info, location_lat, location_lng, address, city, neighborhood, description, rating, image_url, link
  )
  select
    'Astir Beach',
    'Food',
    '2025-06-01T18:00:00+03:00',
    '2025-06-01T23:59:00+03:00',
    'Daily: 08:00 – 21:00',
    37.978197,
    23.720055,
    'Apollonos 40, Vouliagmeni, Athens Riviera',
    'Athens',
    'Vouliagmeni',
    'Soft golden sand, crystal‑clear water and premium service — the polished Greek summer experience.

Because sometimes you want the postcard version of Athens — and it delivers.',
    4,
    'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=1200&h=900&fit=crop',
    'https://www.google.com/maps/search/?api=1&query=Astir%20Beach%20Apollonos%2040%2C%20Vouliagmeni%2C%20Athens%20Riviera'
  where not exists (
    select 1 from public.event e where lower(trim(e.name)) = lower(trim('Astir Beach'))
  )
  returning id
)
insert into public.bandit_event (bandit_id, event_id, personal_tip)
select
  (select id from public.bandit where name ilike 'Sonia' limit 1),
  ins.id,
  'Soft golden sand, crystal‑clear water and premium service — the polished Greek summer experience.'
from ins
where not exists (
  select 1 from public.bandit_event be join public.event ev on ev.id = be.event_id where ev.name = 'Astir Beach'
);

-- Sugar Killer → Elia (Food)
with ins as (
  insert into public.event (
    name, genre, start_time, end_time, timing_info, location_lat, location_lng, address, city, neighborhood, description, rating, image_url, link
  )
  select
    'Sugar Killer',
    'Food',
    '2025-06-01T18:00:00+03:00',
    '2025-06-01T23:59:00+03:00',
    'Mon–Sat: 12:00 – 22:00 | Sun: Closed',
    37.978691,
    23.715756,
    'Emmanouil Benaki 18, Athens',
    'Athens',
    'Athens',
    'Desserts without sugar or animal products that still hit the spot — cakes, ice creams and colorful sweets.

Because ‘healthy’ here doesn’t mean boring — rich textures and vibrant flavors.',
    4,
    'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=1200&h=900&fit=crop',
    'https://www.google.com/maps/search/?api=1&query=Sugar%20Killer%20Emmanouil%20Benaki%2018%2C%20Athens'
  where not exists (
    select 1 from public.event e where lower(trim(e.name)) = lower(trim('Sugar Killer'))
  )
  returning id
)
insert into public.bandit_event (bandit_id, event_id, personal_tip)
select
  (select id from public.bandit where name ilike 'Elia' limit 1),
  ins.id,
  'Desserts without sugar or animal products that still hit the spot — cakes, ice creams and colorful sweets.'
from ins
where not exists (
  select 1 from public.bandit_event be join public.event ev on ev.id = be.event_id where ev.name = 'Sugar Killer'
);

-- Peas Vegan & Raw Food → Neo (Food)
with ins as (
  insert into public.event (
    name, genre, start_time, end_time, timing_info, location_lat, location_lng, address, city, neighborhood, description, rating, image_url, link
  )
  select
    'Peas Vegan & Raw Food',
    'Food',
    '2025-06-01T18:00:00+03:00',
    '2025-06-01T23:59:00+03:00',
    'Mon–Sat: 12:00 – 22:30 | Sun: Closed',
    37.97695,
    23.721505,
    'Spyridonos Trikoupi 44, Athens',
    'Athens',
    'Athens',
    'One of the few spots where ‘healthy’ equals ‘delicious.’ Raw vegan creations with organic ingredients — light yet flavorful.

Because you don’t have to be vegan to love it — pure energy on a plate.',
    4,
    'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=1200&h=900&fit=crop',
    'https://www.google.com/maps/search/?api=1&query=Peas%20Vegan%20%26%20Raw%20Food%20Spyridonos%20Trikoupi%2044%2C%20Athens'
  where not exists (
    select 1 from public.event e where lower(trim(e.name)) = lower(trim('Peas Vegan & Raw Food'))
  )
  returning id
)
insert into public.bandit_event (bandit_id, event_id, personal_tip)
select
  (select id from public.bandit where name ilike 'Neo' limit 1),
  ins.id,
  'One of the few spots where ‘healthy’ equals ‘delicious.’ Raw vegan creations with organic ingredients — light yet flavorful.'
from ins
where not exists (
  select 1 from public.bandit_event be join public.event ev on ev.id = be.event_id where ev.name = 'Peas Vegan & Raw Food'
);

-- Bolivar Beach Bar → Joanna (Nightlife)
with ins as (
  insert into public.event (
    name, genre, start_time, end_time, timing_info, location_lat, location_lng, address, city, neighborhood, description, rating, image_url, link
  )
  select
    'Bolivar Beach Bar',
    'Nightlife',
    '2025-06-01T18:00:00+03:00',
    '2025-06-01T23:59:00+03:00',
    'Daily: 10:00 – 04:00 (varies by events)',
    37.97675,
    23.71661,
    'Poseidonos Avenue, Alimos Beach, Athens',
    'Athens',
    'Alimos',
    'By day it’s a tropical escape with cocktails and sunbeds; by night it explodes with world‑class DJs, lasers and a barefoot crowd.

Because dancing under the stars with your feet in the sand is a summer ritual.',
    4,
    'https://images.pexels.com/photos/1763075/pexels-photo-1763075.jpeg?auto=compress&cs=tinysrgb&w=1200&h=900&fit=crop',
    'https://www.google.com/maps/search/?api=1&query=Bolivar%20Beach%20Bar%20Poseidonos%20Avenue%2C%20Alimos%20Beach%2C%20Athens'
  where not exists (
    select 1 from public.event e where lower(trim(e.name)) = lower(trim('Bolivar Beach Bar'))
  )
  returning id
)
insert into public.bandit_event (bandit_id, event_id, personal_tip)
select
  (select id from public.bandit where name ilike 'Joanna' limit 1),
  ins.id,
  'By day it’s a tropical escape with cocktails and sunbeds; by night it explodes with world‑class DJs, lasers and a barefoot crowd.'
from ins
where not exists (
  select 1 from public.bandit_event be join public.event ev on ev.id = be.event_id where ev.name = 'Bolivar Beach Bar'
);

-- Balthazar → Sonia (Nightlife)
with ins as (
  insert into public.event (
    name, genre, start_time, end_time, timing_info, location_lat, location_lng, address, city, neighborhood, description, rating, image_url, link
  )
  select
    'Balthazar',
    'Nightlife',
    '2025-06-01T18:00:00+03:00',
    '2025-06-01T23:59:00+03:00',
    'Mon–Sun: 19:00 – 03:00',
    37.975997,
    23.720416,
    'Ampelokipoi, Athens',
    'Athens',
    'Ampelokipoi',
    'A chic bar‑restaurant in a neoclassical mansion with a French spirit. Creative cocktails, elegant décor, and a cosmopolitan vibe.

Because it’s the place to dress up and feel part of Athens’ glamorous scene.',
    4,
    'https://images.pexels.com/photos/1763075/pexels-photo-1763075.jpeg?auto=compress&cs=tinysrgb&w=1200&h=900&fit=crop',
    'https://www.google.com/maps/search/?api=1&query=Balthazar%20Ampelokipoi%2C%20Athens'
  where not exists (
    select 1 from public.event e where lower(trim(e.name)) = lower(trim('Balthazar'))
  )
  returning id
)
insert into public.bandit_event (bandit_id, event_id, personal_tip)
select
  (select id from public.bandit where name ilike 'Sonia' limit 1),
  ins.id,
  'A chic bar‑restaurant in a neoclassical mansion with a French spirit. Creative cocktails, elegant décor, and a cosmopolitan vibe.'
from ins
where not exists (
  select 1 from public.bandit_event be join public.event ev on ev.id = be.event_id where ev.name = 'Balthazar'
);

-- Le Greche → Elia (Food)
with ins as (
  insert into public.event (
    name, genre, start_time, end_time, timing_info, location_lat, location_lng, address, city, neighborhood, description, rating, image_url, link
  )
  select
    'Le Greche',
    'Food',
    '2025-06-01T18:00:00+03:00',
    '2025-06-01T23:59:00+03:00',
    'Mon–Sun: 12:00 – 23:30',
    37.984526,
    23.720812,
    'Mitropoleos 16, Athens',
    'Athens',
    'Athens',
    'Italian craftsmanship meets Greek passion — authentic gelato from top‑quality natural ingredients with playful seasonal flavors.

Because gelato here is not just dessert — it’s art.',
    4,
    'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=1200&h=900&fit=crop',
    'https://www.google.com/maps/search/?api=1&query=Le%20Greche%20Mitropoleos%2016%2C%20Athens'
  where not exists (
    select 1 from public.event e where lower(trim(e.name)) = lower(trim('Le Greche'))
  )
  returning id
)
insert into public.bandit_event (bandit_id, event_id, personal_tip)
select
  (select id from public.bandit where name ilike 'Elia' limit 1),
  ins.id,
  'Italian craftsmanship meets Greek passion — authentic gelato from top‑quality natural ingredients with playful seasonal flavors.'
from ins
where not exists (
  select 1 from public.bandit_event be join public.event ev on ev.id = be.event_id where ev.name = 'Le Greche'
);

-- Krabo Beach → Neo (Nightlife)
with ins as (
  insert into public.event (
    name, genre, start_time, end_time, timing_info, location_lat, location_lng, address, city, neighborhood, description, rating, image_url, link
  )
  select
    'Krabo Beach',
    'Nightlife',
    '2025-06-01T18:00:00+03:00',
    '2025-06-01T23:59:00+03:00',
    'Seasonal; day to night (check socials)',
    37.978193,
    23.716782,
    'Kavouri / Vouliagmeni, Athens Riviera',
    'Athens',
    'Vouliagmeni',
    'Designy sunbeds, quality cocktails and sunset‑flirting over the Aegean.

A polished beach day that slides into a golden‑hour dinner.',
    4,
    'https://images.pexels.com/photos/1763075/pexels-photo-1763075.jpeg?auto=compress&cs=tinysrgb&w=1200&h=900&fit=crop',
    'https://www.google.com/maps/search/?api=1&query=Krabo%20Beach%20Kavouri%20%2F%20Vouliagmeni%2C%20Athens%20Riviera'
  where not exists (
    select 1 from public.event e where lower(trim(e.name)) = lower(trim('Krabo Beach'))
  )
  returning id
)
insert into public.bandit_event (bandit_id, event_id, personal_tip)
select
  (select id from public.bandit where name ilike 'Neo' limit 1),
  ins.id,
  'Designy sunbeds, quality cocktails and sunset‑flirting over the Aegean.'
from ins
where not exists (
  select 1 from public.bandit_event be join public.event ev on ev.id = be.event_id where ev.name = 'Krabo Beach'
);

-- Share Wish → Joanna (Coffee)
with ins as (
  insert into public.event (
    name, genre, start_time, end_time, timing_info, location_lat, location_lng, address, city, neighborhood, description, rating, image_url, link
  )
  select
    'Share Wish',
    'Coffee',
    '2025-06-01T18:00:00+03:00',
    '2025-06-01T23:59:00+03:00',
    'Mon–Sun: 11:00 – 23:00',
    37.982811,
    23.721154,
    'Amerikis 11, Athens (city center)',
    'Athens',
    'Athens Center',
    'Bubble tea heaven — classic milk tea, fruity blends and matcha with chewy pearls. A refreshing pause in the middle of the city.

Because sometimes you need a sweet, trendy and photogenic break from Greek coffee.',
    4,
    'https://images.pexels.com/photos/302899/pexels-photo-302899.jpeg?auto=compress&cs=tinysrgb&w=1200&h=900&fit=crop',
    'https://www.google.com/maps/search/?api=1&query=Share%20Wish%20Amerikis%2011%2C%20Athens%20(city%20center)'
  where not exists (
    select 1 from public.event e where lower(trim(e.name)) = lower(trim('Share Wish'))
  )
  returning id
)
insert into public.bandit_event (bandit_id, event_id, personal_tip)
select
  (select id from public.bandit where name ilike 'Joanna' limit 1),
  ins.id,
  'Bubble tea heaven — classic milk tea, fruity blends and matcha with chewy pearls. A refreshing pause in the middle of the city.'
from ins
where not exists (
  select 1 from public.bandit_event be join public.event ev on ev.id = be.event_id where ev.name = 'Share Wish'
);

-- Happy Blender → Sonia (Coffee)
with ins as (
  insert into public.event (
    name, genre, start_time, end_time, timing_info, location_lat, location_lng, address, city, neighborhood, description, rating, image_url, link
  )
  select
    'Happy Blender',
    'Coffee',
    '2025-06-01T18:00:00+03:00',
    '2025-06-01T23:59:00+03:00',
    'Mon–Sat: 10:00 – 20:00 | Sun: Closed (hours vary by branch)',
    37.978493,
    23.723314,
    'Sina 21 (and Nikis 24), Athens',
    'Athens',
    'Athens',
    'Colorful smoothie bowls, fresh juices and plant‑based bites — a peaceful corner to recharge.

Because a pretty bowl after a long walk tastes like a reset button.',
    4,
    'https://images.pexels.com/photos/302899/pexels-photo-302899.jpeg?auto=compress&cs=tinysrgb&w=1200&h=900&fit=crop',
    'https://www.google.com/maps/search/?api=1&query=Happy%20Blender%20Sina%2021%20(and%20Nikis%2024)%2C%20Athens'
  where not exists (
    select 1 from public.event e where lower(trim(e.name)) = lower(trim('Happy Blender'))
  )
  returning id
)
insert into public.bandit_event (bandit_id, event_id, personal_tip)
select
  (select id from public.bandit where name ilike 'Sonia' limit 1),
  ins.id,
  'Colorful smoothie bowls, fresh juices and plant‑based bites — a peaceful corner to recharge.'
from ins
where not exists (
  select 1 from public.bandit_event be join public.event ev on ev.id = be.event_id where ev.name = 'Happy Blender'
);

-- AMOQA – Athens Museum of Queer Arts → Elia (Culture)
with ins as (
  insert into public.event (
    name, genre, start_time, end_time, timing_info, location_lat, location_lng, address, city, neighborhood, description, rating, image_url, link
  )
  select
    'AMOQA – Athens Museum of Queer Arts',
    'Culture',
    '2025-06-01T18:00:00+03:00',
    '2025-06-01T23:59:00+03:00',
    'Check socials for events & exhibitions',
    37.975772,
    23.716642,
    'Manousogianni 6, Athens',
    'Athens',
    'Athens',
    'Unapologetic space dedicated to queer arts and activism since 2015 — exhibitions, screenings, workshops and gatherings.

Because art here is resistance, identity and community power.',
    4,
    'https://images.pexels.com/photos/237294/pexels-photo-237294.jpeg?auto=compress&cs=tinysrgb&w=1200&h=900&fit=crop',
    'https://www.google.com/maps/search/?api=1&query=AMOQA%20%E2%80%93%20Athens%20Museum%20of%20Queer%20Arts%20Manousogianni%206%2C%20Athens'
  where not exists (
    select 1 from public.event e where lower(trim(e.name)) = lower(trim('AMOQA – Athens Museum of Queer Arts'))
  )
  returning id
)
insert into public.bandit_event (bandit_id, event_id, personal_tip)
select
  (select id from public.bandit where name ilike 'Elia' limit 1),
  ins.id,
  'Unapologetic space dedicated to queer arts and activism since 2015 — exhibitions, screenings, workshops and gatherings.'
from ins
where not exists (
  select 1 from public.bandit_event be join public.event ev on ev.id = be.event_id where ev.name = 'AMOQA – Athens Museum of Queer Arts'
);

-- Iceroll Athens → Neo (Food)
with ins as (
  insert into public.event (
    name, genre, start_time, end_time, timing_info, location_lat, location_lng, address, city, neighborhood, description, rating, image_url, link
  )
  select
    'Iceroll Athens',
    'Food',
    '2025-06-01T18:00:00+03:00',
    '2025-06-01T23:59:00+03:00',
    'Mon–Sun: 12:00 – 23:00',
    37.976099,
    23.724643,
    '4 Navarchou Nikodimou, Athens (center)',
    'Athens',
    'Athens Center',
    'Rolled ice cream made on a frozen plate right in front of you. Sweet, fun, and a little nostalgic — like being a kid again.

Because it’s both Instagrammable and addictive — the perfect cool‑down in Athens’ heat.',
    4,
    'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=1200&h=900&fit=crop',
    'https://www.google.com/maps/search/?api=1&query=Iceroll%20Athens%204%20Navarchou%20Nikodimou%2C%20Athens%20(center)'
  where not exists (
    select 1 from public.event e where lower(trim(e.name)) = lower(trim('Iceroll Athens'))
  )
  returning id
)
insert into public.bandit_event (bandit_id, event_id, personal_tip)
select
  (select id from public.bandit where name ilike 'Neo' limit 1),
  ins.id,
  'Rolled ice cream made on a frozen plate right in front of you. Sweet, fun, and a little nostalgic — like being a kid again.'
from ins
where not exists (
  select 1 from public.bandit_event be join public.event ev on ev.id = be.event_id where ev.name = 'Iceroll Athens'
);

-- Humana Second Hand Greece → Joanna (Shopping)
with ins as (
  insert into public.event (
    name, genre, start_time, end_time, timing_info, location_lat, location_lng, address, city, neighborhood, description, rating, image_url, link
  )
  select
    'Humana Second Hand Greece',
    'Shopping',
    '2025-06-01T18:00:00+03:00',
    '2025-06-01T23:59:00+03:00',
    'Mon–Sat: 10:00 – 20:00 | Sun: Closed',
    37.98012,
    23.71812,
    'Filolaou 143, Pangrati & Patission 119, Athens',
    'Athens',
    'Pangrati',
    'Second‑hand shopping with a cause — affordable retro finds while supporting social and environmental initiatives.

Because style can be sustainable — treasure hunts for a few euros.',
    4,
    'https://images.pexels.com/photos/264636/pexels-photo-264636.jpeg?auto=compress&cs=tinysrgb&w=1200&h=900&fit=crop',
    'https://www.google.com/maps/search/?api=1&query=Humana%20Second%20Hand%20Greece%20Filolaou%20143%2C%20Pangrati%20%26%20Patission%20119%2C%20Athens'
  where not exists (
    select 1 from public.event e where lower(trim(e.name)) = lower(trim('Humana Second Hand Greece'))
  )
  returning id
)
insert into public.bandit_event (bandit_id, event_id, personal_tip)
select
  (select id from public.bandit where name ilike 'Joanna' limit 1),
  ins.id,
  'Second‑hand shopping with a cause — affordable retro finds while supporting social and environmental initiatives.'
from ins
where not exists (
  select 1 from public.bandit_event be join public.event ev on ev.id = be.event_id where ev.name = 'Humana Second Hand Greece'
);

-- Noiz Club → Sonia (Nightlife)
with ins as (
  insert into public.event (
    name, genre, start_time, end_time, timing_info, location_lat, location_lng, address, city, neighborhood, description, rating, image_url, link
  )
  select
    'Noiz Club',
    'Nightlife',
    '2025-06-01T18:00:00+03:00',
    '2025-06-01T23:59:00+03:00',
    'Fri–Sat: 23:30 – late (events vary)',
    37.984436,
    23.718902,
    'Gazi, Athens',
    'Athens',
    'Gazi',
    'Noiz is one of Athens’ most popular LGBTQ+ clubs, where the beats are heavy, the lights are wild, and the energy is contagious.

Because it’s not just a club — it’s a safe space where freedom, diversity, and music collide.',
    4,
    'https://images.pexels.com/photos/1763075/pexels-photo-1763075.jpeg?auto=compress&cs=tinysrgb&w=1200&h=900&fit=crop',
    'https://www.google.com/maps/search/?api=1&query=Noiz%20Club%20Gazi%2C%20Athens'
  where not exists (
    select 1 from public.event e where lower(trim(e.name)) = lower(trim('Noiz Club'))
  )
  returning id
)
insert into public.bandit_event (bandit_id, event_id, personal_tip)
select
  (select id from public.bandit where name ilike 'Sonia' limit 1),
  ins.id,
  'Noiz is one of Athens’ most popular LGBTQ+ clubs, where the beats are heavy, the lights are wild, and the energy is contagious.'
from ins
where not exists (
  select 1 from public.bandit_event be join public.event ev on ev.id = be.event_id where ev.name = 'Noiz Club'
);

-- Greek Drag Shows → Elia (Culture)
with ins as (
  insert into public.event (
    name, genre, start_time, end_time, timing_info, location_lat, location_lng, address, city, neighborhood, description, rating, image_url, link
  )
  select
    'Greek Drag Shows',
    'Culture',
    '2025-06-01T18:00:00+03:00',
    '2025-06-01T23:59:00+03:00',
    'Event‑based (weekly updates)',
    37.982635,
    23.719984,
    'Across Athens & Greece (check socials)',
    'Athens',
    'Athens',
    'A platform mapping drag shows across Greece — spotlighting performers, events and queer artistry.

Because it’s your go‑to map for drag in Greece.',
    4,
    'https://images.pexels.com/photos/237294/pexels-photo-237294.jpeg?auto=compress&cs=tinysrgb&w=1200&h=900&fit=crop',
    'https://www.google.com/maps/search/?api=1&query=Greek%20Drag%20Shows%20Across%20Athens%20%26%20Greece%20(check%20socials)'
  where not exists (
    select 1 from public.event e where lower(trim(e.name)) = lower(trim('Greek Drag Shows'))
  )
  returning id
)
insert into public.bandit_event (bandit_id, event_id, personal_tip)
select
  (select id from public.bandit where name ilike 'Elia' limit 1),
  ins.id,
  'A platform mapping drag shows across Greece — spotlighting performers, events and queer artistry.'
from ins
where not exists (
  select 1 from public.bandit_event be join public.event ev on ev.id = be.event_id where ev.name = 'Greek Drag Shows'
);

-- The Agora Project → Neo (Culture)
with ins as (
  insert into public.event (
    name, genre, start_time, end_time, timing_info, location_lat, location_lng, address, city, neighborhood, description, rating, image_url, link
  )
  select
    'The Agora Project',
    'Culture',
    '2025-06-01T18:00:00+03:00',
    '2025-06-01T23:59:00+03:00',
    'Varies by program and events',
    37.976473,
    23.720783,
    'Karaiskaki 28, Athens',
    'Athens',
    'Athens',
    'A vibrant hub combining community markets, cultural events and learning. Locals, artists and innovators creating real impact.

Because it’s more than a space — it’s a movement for sustainable living and creativity.',
    4,
    'https://images.pexels.com/photos/237294/pexels-photo-237294.jpeg?auto=compress&cs=tinysrgb&w=1200&h=900&fit=crop',
    'https://www.google.com/maps/search/?api=1&query=The%20Agora%20Project%20Karaiskaki%2028%2C%20Athens'
  where not exists (
    select 1 from public.event e where lower(trim(e.name)) = lower(trim('The Agora Project'))
  )
  returning id
)
insert into public.bandit_event (bandit_id, event_id, personal_tip)
select
  (select id from public.bandit where name ilike 'Neo' limit 1),
  ins.id,
  'A vibrant hub combining community markets, cultural events and learning. Locals, artists and innovators creating real impact.'
from ins
where not exists (
  select 1 from public.bandit_event be join public.event ev on ev.id = be.event_id where ev.name = 'The Agora Project'
);

-- SNAP – Athens Queer Comedy Club → Joanna (Culture)
with ins as (
  insert into public.event (
    name, genre, start_time, end_time, timing_info, location_lat, location_lng, address, city, neighborhood, description, rating, image_url, link
  )
  select
    'SNAP – Athens Queer Comedy Club',
    'Culture',
    '2025-06-01T18:00:00+03:00',
    '2025-06-01T23:59:00+03:00',
    'Event‑based (check socials)',
    37.976252,
    23.721521,
    'Various venues (Kypseli focus)',
    'Athens',
    'Kypseli',
    'The first queer comedy club in Athens — drag, stand‑up and improv for nights of laughter and freedom.

Because comedy has never been queerer, sharper or more liberating.',
    4,
    'https://images.pexels.com/photos/237294/pexels-photo-237294.jpeg?auto=compress&cs=tinysrgb&w=1200&h=900&fit=crop',
    'https://www.google.com/maps/search/?api=1&query=SNAP%20%E2%80%93%20Athens%20Queer%20Comedy%20Club%20Various%20venues%20(Kypseli%20focus)'
  where not exists (
    select 1 from public.event e where lower(trim(e.name)) = lower(trim('SNAP – Athens Queer Comedy Club'))
  )
  returning id
)
insert into public.bandit_event (bandit_id, event_id, personal_tip)
select
  (select id from public.bandit where name ilike 'Joanna' limit 1),
  ins.id,
  'The first queer comedy club in Athens — drag, stand‑up and improv for nights of laughter and freedom.'
from ins
where not exists (
  select 1 from public.bandit_event be join public.event ev on ev.id = be.event_id where ev.name = 'SNAP – Athens Queer Comedy Club'
);

-- Sessions → Sonia (Food)
with ins as (
  insert into public.event (
    name, genre, start_time, end_time, timing_info, location_lat, location_lng, address, city, neighborhood, description, rating, image_url, link
  )
  select
    'Sessions',
    'Food',
    '2025-06-01T18:00:00+03:00',
    '2025-06-01T23:59:00+03:00',
    'Event‑based (check Instagram)',
    37.975709,
    23.721813,
    'Sapfous 6 (ex‑Drive), Nicosia, Cyprus',
    'Athens',
    'Athens',
    'Queer gatherings mixing performance, art and nightlife — creating temporary spaces of freedom and radical joy.

Because it connects communities and pushes boundaries.',
    4,
    'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=1200&h=900&fit=crop',
    'https://www.google.com/maps/search/?api=1&query=Sessions%20Sapfous%206%20(ex%E2%80%91Drive)%2C%20Nicosia%2C%20Cyprus'
  where not exists (
    select 1 from public.event e where lower(trim(e.name)) = lower(trim('Sessions'))
  )
  returning id
)
insert into public.bandit_event (bandit_id, event_id, personal_tip)
select
  (select id from public.bandit where name ilike 'Sonia' limit 1),
  ins.id,
  'Queer gatherings mixing performance, art and nightlife — creating temporary spaces of freedom and radical joy.'
from ins
where not exists (
  select 1 from public.bandit_event be join public.event ev on ev.id = be.event_id where ev.name = 'Sessions'
);

commit;