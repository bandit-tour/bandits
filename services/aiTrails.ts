import { Database } from '@/lib/database.types';

type Spot = Database['public']['Tables']['spots']['Row'];

export type GeneratedTrailStop = {
  position: number;
  stop_name: string;
  note: string;
  spot_id: string | null;
};

export type GeneratedTrail = {
  title: string;
  description: string;
  mood: string;
  duration: string;
  stops: GeneratedTrailStop[];
};

type MoodKey =
  | 'coffee morning'
  | 'after dark'
  | 'art day'
  | 'vintage hunt'
  | 'hidden gems'
  | 'food crawl';

const MOOD_CONFIG: Record<
  MoodKey,
  { label: string; duration: string; categories: string[]; descriptionTemplate: string }
> = {
  'coffee morning': {
    label: 'Slow morning',
    duration: '2 hours',
    categories: ['coffee', 'brunch', 'breakfast'],
    descriptionTemplate:
      'Soft landings only.\n\nSlow caffeine, side streets waking up, and tables where nobody rushes you out.',
  },
  'after dark': {
    label: 'After dark',
    duration: '3 hours',
    categories: ['bar', 'night', 'cocktail', 'club'],
    descriptionTemplate:
      'Where the night goes off‑map.\n\nDim corners, low bass, and strangers who start to feel like old friends.',
  },
  'art day': {
    label: 'Art day',
    duration: '3 hours',
    categories: ['gallery', 'museum', 'art'],
    descriptionTemplate:
      'For when the city feels like a sketchbook.\n\nWall pieces, tiny galleries, and cafés where everyone is “working on something”.',
  },
  'vintage hunt': {
    label: 'Vintage hunt',
    duration: '3 hours',
    categories: ['vintage', 'flea', 'thrift'],
    descriptionTemplate:
      'Nothing fresh off the rack.\n\nCrates, closets and basements where the good stuff never hits the algorithm.',
  },
  'hidden gems': {
    label: 'Hidden gems',
    duration: '2.5 hours',
    categories: ['hidden', 'local', 'neighborhood'],
    descriptionTemplate:
      'Places locals mention in low voices.\n\nSide doors, back rooms and corners that don’t bother with a sign.',
  },
  'food crawl': {
    label: 'Food crawl',
    duration: '2.5 hours',
    categories: ['food', 'tavern', 'street', 'souvlaki'],
    descriptionTemplate:
      'Snack theology, not fine dining.\n\nCountertops, plastic stools and plates that disappear as fast as they land.',
  },
};

function normalise(text: string | null): string {
  return (text ?? '').toLowerCase();
}

function pickMoodConfig(mood: string): MoodKey {
  const key = mood.toLowerCase().trim() as MoodKey;
  if (MOOD_CONFIG[key]) return key;

  // Simple fallback mapping based on keywords in the input
  if (key.includes('coffee') || key.includes('morning')) return 'coffee morning';
  if (key.includes('night') || key.includes('dark') || key.includes('bar')) return 'after dark';
  if (key.includes('art') || key.includes('gallery')) return 'art day';
  if (key.includes('vintage') || key.includes('flea')) return 'vintage hunt';
  if (key.includes('food') || key.includes('eat') || key.includes('crawl')) return 'food crawl';
  return 'hidden gems';
}

function filterSpotsForMood(spots: Spot[], moodKey: MoodKey): Spot[] {
  const cfg = MOOD_CONFIG[moodKey];
  const categories = cfg.categories.map((c) => c.toLowerCase());

  const matched = spots.filter((spot) => {
    const cat = normalise(spot.category);
    const desc = normalise(spot.description);
    return categories.some(
      (c) => cat.includes(c) || desc.includes(c),
    );
  });

  // Fallback: if nothing matched, just use all spots
  return matched.length > 0 ? matched : spots;
}

function pickSpots(spots: Spot[], maxStops: number): Spot[] {
  if (spots.length <= maxStops) return spots;
  // Simple deterministic-ish selection: take every nth spot
  const step = Math.max(1, Math.floor(spots.length / maxStops));
  const picked: Spot[] = [];
  for (let i = 0; i < spots.length && picked.length < maxStops; i += step) {
    picked.push(spots[i]);
  }
  return picked;
}

export function generateAiTrailFromSpots(mood: string, spots: Spot[]): GeneratedTrail | null {
  if (!spots || spots.length === 0) {
    return null;
  }

  const moodKey = pickMoodConfig(mood);
  const cfg = MOOD_CONFIG[moodKey];
  const filtered = filterSpotsForMood(spots, moodKey);
  const selected = pickSpots(filtered, 5).slice(0, 3); // 3–5; ensure at least 3 when possible

  if (selected.length === 0) {
    return null;
  }

  const stops: GeneratedTrailStop[] = selected.map((spot, index) => ({
    position: index + 1,
    stop_name: spot.name,
    note: spot.description || 'A local spot that fits this vibe.',
    spot_id: spot.id,
  }));

  const title = `AI ${cfg.label} trail`;

  return {
    title,
    description: cfg.descriptionTemplate,
    mood: cfg.label,
    duration: cfg.duration,
    stops,
  };
}

