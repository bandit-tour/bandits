-- Seed trail_stops for "Neo Urban Stories"
-- Data / linkage only – no schema changes.

-- This assumes:
-- - public.trails has a row with title = 'Neo Urban Stories'
-- - public.spots contains matching rows by name for the chosen stops

insert into public.trail_stops (trail_id, spot_id, position, note, stop_name)
with t as (
  select id
  from public.trails
  where title = 'Neo Urban Stories'
  limit 1
),
stops as (
  values
    (1, 'Jazz In Jazz', 'Tiny room, big sound – slip into the back corner and let the horns do the talking.'),
    (2, 'Monastiraki Flea Market', 'Come early for the crates and late for the chaos – the sweet spot is somewhere in between.'),
    (3, 'Feyrouz', 'Street‑side energy, line that moves fast, spice that doesn’t.')
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

