-- Seed 10 curated trails for Joanna, Sonia, Elia, Neo
-- All stops use spot_id = null; stop_name and note store the content

-- 1. Joanna After Dark
insert into public.trails (title, description, mood, duration, bandit_id)
values (
  'Joanna After Dark',
  'Athens through the eyes of a filmmaker: dim lights, strong cocktails, and a late bite before sunrise.',
  'Night adventure',
  '3 hours',
  (select id from public.bandit where name ilike 'Joanna' limit 1)
);

insert into public.trail_stops (trail_id, spot_id, position, note, stop_name)
with t as (
  select id, bandit_id
  from public.trails
  where title = 'Joanna After Dark'
  limit 1
),
stops as (
  values
    (1, 'The Clumsies', 'Start the night with a cinematic cocktail.'),
    (2, 'Baba Au Rum', 'Experimental rum bar energy.'),
    (3, 'Six d.o.g.s Courtyard', 'Creative crowd and late music.'),
    (4, 'Feyrouz', 'Late-night street food stop.')
),
stops_resolved as (
  select
    t.id as trail_id,
    (
      select s.id
      from public.spots s
      where lower(s.name) = lower(stops.column2)
      limit 1
    ) as spot_id,
    stops.column1 as position,
    stops.column3 as note,
    stops.column2 as stop_name
  from stops
  cross join t
)
select
  trail_id,
  coalesce(spot_id, null::uuid) as spot_id,
  position,
  note,
  stop_name
from stops_resolved;

-- 2. Sonia's Coffee Ritual
insert into public.trails (title, description, mood, duration, bandit_id)
values (
  'Sonia''s Coffee Ritual',
  'Coffee, ceramics and quiet streets — the way Sonia starts her Athens mornings.',
  'Slow morning',
  '2.5 hours',
  (select id from public.bandit where name ilike 'Sonia' limit 1)
);

insert into public.trail_stops (trail_id, spot_id, position, note, stop_name)
with t as (
  select id, bandit_id
  from public.trails
  where title = 'Sonia''s Coffee Ritual'
  limit 1
),
stops as (
  values
    (1, 'Taf Coffee', 'Serious specialty coffee.'),
    (2, 'Anäna Coffee & Food', 'Healthy brunch break.'),
    (3, 'Ceramic Studio Street Shop', 'Handmade ceramics inspiration.'),
    (4, 'Yesterday''s Bread Bakery', 'Finish with pastries.')
),
stops_resolved as (
  select
    t.id as trail_id,
    (
      select s.id
      from public.spots s
      where lower(s.name) = lower(stops.column2)
      limit 1
    ) as spot_id,
    stops.column1 as position,
    stops.column3 as note,
    stops.column2 as stop_name
  from stops
  cross join t
)
select
  trail_id,
  coalesce(spot_id, null::uuid) as spot_id,
  position,
  note,
  stop_name
from stops_resolved;

-- 3. Elia's Creative Walk
insert into public.trails (title, description, mood, duration, bandit_id)
values (
  'Elia''s Creative Walk',
  'Street art, small galleries and design cafés across creative Athens.',
  'Creative day',
  '3 hours',
  (select id from public.bandit where name ilike 'Elia' limit 1)
);

insert into public.trail_stops (trail_id, spot_id, position, note, stop_name)
with t as (
  select id, bandit_id
  from public.trails
  where title = 'Elia''s Creative Walk'
  limit 1
),
stops as (
  values
    (1, 'Exarchia Street Art Corner', 'Start with murals.'),
    (2, 'CAN Gallery', 'Young contemporary artists.'),
    (3, 'Dope Roasting Co', 'Coffee with creatives.'),
    (4, 'Hyper Hypo Design Shop', 'Concept store browsing.')
),
stops_resolved as (
  select
    t.id as trail_id,
    (
      select s.id
      from public.spots s
      where lower(s.name) = lower(stops.column2)
      limit 1
    ) as spot_id,
    stops.column1 as position,
    stops.column3 as note,
    stops.column2 as stop_name
  from stops
  cross join t
)
select
  trail_id,
  coalesce(spot_id, null::uuid) as spot_id,
  position,
  note,
  stop_name
from stops_resolved;

-- 4. Neo's Vintage Hunt
insert into public.trails (title, description, mood, duration, bandit_id)
values (
  'Neo''s Vintage Hunt',
  'Vintage treasures, vinyl and jazz — Neo''s natural habitat.',
  'Urban explorer',
  '3 hours',
  (select id from public.bandit where name ilike 'Neo' limit 1)
);

insert into public.trail_stops (trail_id, spot_id, position, note, stop_name)
with t as (
  select id, bandit_id
  from public.trails
  where title = 'Neo''s Vintage Hunt'
  limit 1
),
stops as (
  values
    (1, 'Yesterday''s Bread Vintage', 'Start the hunt.'),
    (2, 'Monastiraki Flea Market', 'Hidden treasures.'),
    (3, 'Jazz In Jazz', 'Classic jazz bar.'),
    (4, 'Warehouse Wine Bar', 'Natural wine finish.')
),
stops_resolved as (
  select
    t.id as trail_id,
    (
      select s.id
      from public.spots s
      where lower(s.name) = lower(stops.column2)
      limit 1
    ) as spot_id,
    stops.column1 as position,
    stops.column3 as note,
    stops.column2 as stop_name
  from stops
  cross join t
)
select
  trail_id,
  coalesce(spot_id, null::uuid) as spot_id,
  position,
  note,
  stop_name
from stops_resolved;

-- 5. Athens Slow Sunday (Joanna)
insert into public.trails (title, description, mood, duration, bandit_id)
values (
  'Athens Slow Sunday',
  'A gentle Sunday with brunch, wandering streets and sunset wine.',
  'Lazy Sunday',
  '3 hours',
  (select id from public.bandit where name ilike 'Joanna' limit 1)
);

insert into public.trail_stops (trail_id, spot_id, position, note, stop_name)
with t as (
  select id, bandit_id
  from public.trails
  where title = 'Athens Slow Sunday'
  limit 1
),
stops as (
  values
    (1, 'The Underdog', 'Coffee and brunch.'),
    (2, 'Kypseli Walk', 'Neighborhood wandering.'),
    (3, 'Local Vintage Corner', 'Browse hidden shops.'),
    (4, 'Wine Bar Sunset', 'Relaxed evening drink.')
),
stops_resolved as (
  select
    t.id as trail_id,
    (
      select s.id
      from public.spots s
      where lower(s.name) = lower(stops.column2)
      limit 1
    ) as spot_id,
    stops.column1 as position,
    stops.column3 as note,
    stops.column2 as stop_name
  from stops
  cross join t
)
select
  trail_id,
  coalesce(spot_id, null::uuid) as spot_id,
  position,
  note,
  stop_name
from stops_resolved;

-- 6. Athens Street Food Crawl (Neo)
insert into public.trails (title, description, mood, duration, bandit_id)
values (
  'Athens Street Food Crawl',
  'Fast bites, street flavor and unexpected discoveries.',
  'Food adventure',
  '2.5 hours',
  (select id from public.bandit where name ilike 'Neo' limit 1)
);

insert into public.trail_stops (trail_id, spot_id, position, note, stop_name)
with t as (
  select id, bandit_id
  from public.trails
  where title = 'Athens Street Food Crawl'
  limit 1
),
stops as (
  values
    (1, 'Feyrouz', 'Start with Lebanese street food.'),
    (2, 'O Kostas Souvlaki', 'Classic Athens flavor.'),
    (3, 'Falafel Stop', 'Quick street snack.'),
    (4, 'Loukoumades Dessert', 'Sweet finish.')
),
stops_resolved as (
  select
    t.id as trail_id,
    (
      select s.id
      from public.spots s
      where lower(s.name) = lower(stops.column2)
      limit 1
    ) as spot_id,
    stops.column1 as position,
    stops.column3 as note,
    stops.column2 as stop_name
  from stops
  cross join t
)
select
  trail_id,
  coalesce(spot_id, null::uuid) as spot_id,
  position,
  note,
  stop_name
from stops_resolved;

-- 7. Gallery & Espresso Route (Elia)
insert into public.trails (title, description, mood, duration, bandit_id)
values (
  'Gallery & Espresso Route',
  'Athens art spaces with espresso breaks in between.',
  'Art mood',
  '3 hours',
  (select id from public.bandit where name ilike 'Elia' limit 1)
);

insert into public.trail_stops (trail_id, spot_id, position, note, stop_name)
with t as (
  select id, bandit_id
  from public.trails
  where title = 'Gallery & Espresso Route'
  limit 1
),
stops as (
  values
    (1, 'Breeder Gallery', 'Contemporary art.'),
    (2, 'Coffee Break', 'Espresso recharge.'),
    (3, 'Local Art Bookstore', 'Design books browsing.'),
    (4, 'Wine & Gallery Talk', 'Creative evening drink.')
),
stops_resolved as (
  select
    t.id as trail_id,
    (
      select s.id
      from public.spots s
      where lower(s.name) = lower(stops.column2)
      limit 1
    ) as spot_id,
    stops.column1 as position,
    stops.column3 as note,
    stops.column2 as stop_name
  from stops
  cross join t
)
select
  trail_id,
  coalesce(spot_id, null::uuid) as spot_id,
  position,
  note,
  stop_name
from stops_resolved;

-- 8. Morning Markets (Sonia)
insert into public.trails (title, description, mood, duration, bandit_id)
values (
  'Morning Markets',
  'Experience Athens like a local: markets, coffee and street conversations.',
  'Local life',
  '2 hours',
  (select id from public.bandit where name ilike 'Sonia' limit 1)
);

insert into public.trail_stops (trail_id, spot_id, position, note, stop_name)
with t as (
  select id, bandit_id
  from public.trails
  where title = 'Morning Markets'
  limit 1
),
stops as (
  values
    (1, 'Varvakios Market', 'Morning market energy.'),
    (2, 'Local Coffee Stand', 'Quick Greek coffee.'),
    (3, 'Bakery Stop', 'Fresh bread and pastries.'),
    (4, 'Neighborhood Walk', 'Slow exploration.')
),
stops_resolved as (
  select
    t.id as trail_id,
    (
      select s.id
      from public.spots s
      where lower(s.name) = lower(stops.column2)
      limit 1
    ) as spot_id,
    stops.column1 as position,
    stops.column3 as note,
    stops.column2 as stop_name
  from stops
  cross join t
)
select
  trail_id,
  coalesce(spot_id, null::uuid) as spot_id,
  position,
  note,
  stop_name
from stops_resolved;

-- 9. Sunset Rooftops (Joanna)
insert into public.trails (title, description, mood, duration, bandit_id)
values (
  'Sunset Rooftops',
  'Athens rooftops and views as the sun sets over the Acropolis.',
  'Golden hour',
  '2 hours',
  (select id from public.bandit where name ilike 'Joanna' limit 1)
);

insert into public.trail_stops (trail_id, spot_id, position, note, stop_name)
with t as (
  select id, bandit_id
  from public.trails
  where title = 'Sunset Rooftops'
  limit 1
),
stops as (
  values
    (1, 'The DOLLI Rooftop', 'Acropolis view.'),
    (2, 'City Walk', 'Golden hour streets.'),
    (3, 'Wine Terrace', 'Relaxed sunset drink.'),
    (4, 'Night Photo Spot', 'Capture the moment.')
),
stops_resolved as (
  select
    t.id as trail_id,
    (
      select s.id
      from public.spots s
      where lower(s.name) = lower(stops.column2)
      limit 1
    ) as spot_id,
    stops.column1 as position,
    stops.column3 as note,
    stops.column2 as stop_name
  from stops
  cross join t
)
select
  trail_id,
  coalesce(spot_id, null::uuid) as spot_id,
  position,
  note,
  stop_name
from stops_resolved;

-- 10. Lost in Athens (Elia)
insert into public.trails (title, description, mood, duration, bandit_id)
values (
  'Lost in Athens',
  'No strict plan — just curiosity, side streets and surprises.',
  'Wander mode',
  '3 hours',
  (select id from public.bandit where name ilike 'Elia' limit 1)
);

insert into public.trail_stops (trail_id, spot_id, position, note, stop_name)
with t as (
  select id, bandit_id
  from public.trails
  where title = 'Lost in Athens'
  limit 1
),
stops as (
  values
    (1, 'Hidden Alley', 'Start walking.'),
    (2, 'Unexpected Café', 'Stop wherever feels right.'),
    (3, 'Random Art Wall', 'Discover street art.'),
    (4, 'Small Wine Bar', 'Celebrate getting lost.')
),
stops_resolved as (
  select
    t.id as trail_id,
    (
      select s.id
      from public.spots s
      where lower(s.name) = lower(stops.column2)
      limit 1
    ) as spot_id,
    stops.column1 as position,
    stops.column3 as note,
    stops.column2 as stop_name
  from stops
  cross join t
)
select
  trail_id,
  coalesce(spot_id, null::uuid) as spot_id,
  position,
  note,
  stop_name
from stops_resolved;
