-- Create local_friend_profiles table and seed pilot identities

create table if not exists public.local_friend_profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  vibe text not null,
  interests text not null,
  city text not null,
  avatar_url text,
  created_at timestamptz not null default now()
);

insert into public.local_friend_profiles (name, vibe, interests, city, avatar_url)
values
  (
    'Athens Night Owl',
    'nightlife expert',
    'bars, music, clubs, late food',
    'Athens',
    null
  ),
  (
    'Vintage Local',
    'treasure hunter',
    'vintage shops, flea markets, retro fashion',
    'Athens',
    null
  ),
  (
    'Coffee Friend',
    'slow morning person',
    'cafés, bakeries, brunch spots',
    'Athens',
    null
  ),
  (
    'Art Walk Friend',
    'creative explorer',
    'galleries, street art, design stores',
    'Athens',
    null
  ),
  (
    'Foodie Friend',
    'street food addict',
    'markets, local restaurants, hidden food spots',
    'Athens',
    null
  ),
  (
    'Queer Athens Friend',
    'inclusive nightlife guide',
    'queer bars, LGBTQ community spaces',
    'Athens',
    null
  );

