import type { Database } from '@/lib/database.types';

type Event = Database['public']['Tables']['event']['Row'];

export const EXPLORE_CATEGORY_CHIPS = [
  'All',
  'Coffee',
  'Food',
  'Nightlife',
  'Shopping',
  'Culture',
  'Art',
  'LGBTQ+',
  'Wellness',
  'Nature',
] as const;

export type ExploreCategoryChip = (typeof EXPLORE_CATEGORY_CHIPS)[number];

const GENRE_CHIPS = new Set(['Coffee', 'Food', 'Nightlife', 'Shopping', 'Culture']);

const ART_RE =
  /\b(art|gallery|galleries|museum|museums|exhibit|exhibition|residency|fine arts|asfa|amoqa|eutopia|street art|queer arts)\b/i;
const LGBTQ_RE =
  /\b(lgbtq\+?|queer|gay|pride|bequeer|s-?scape|noiz|snap comedy|fabulous)\b/i;
const WELLNESS_RE = /\b(spa|wellness|hammam|massage|yoga|bath|thermal|sauna)\b/i;
const NATURE_RE = /\b(park|garden|gardens|nature|hike|hiking|beach|forest|trail|escape|mountain|lake)\b/i;

function eventHaystack(event: Event): string {
  return [event.name, event.description, event.neighborhood, event.city]
    .map((v) => String(v ?? '').trim())
    .filter(Boolean)
    .join(' ');
}

export function eventMatchesExploreCategory(event: Event, chip: ExploreCategoryChip): boolean {
  if (chip === 'All') return true;
  if (GENRE_CHIPS.has(chip)) return event.genre === chip;
  const hay = eventHaystack(event);
  if (chip === 'Art') return event.genre === 'Culture' && ART_RE.test(hay);
  if (chip === 'LGBTQ+') return LGBTQ_RE.test(hay);
  if (chip === 'Wellness') return WELLNESS_RE.test(hay);
  if (chip === 'Nature') return NATURE_RE.test(hay);
  return true;
}

export function filterEventsByExploreCategory(events: Event[], chip: ExploreCategoryChip): Event[] {
  if (chip === 'All') return events;
  return events.filter((event) => eventMatchesExploreCategory(event, chip));
}

export function exploreChipFromGenreParam(genre: string | undefined): ExploreCategoryChip {
  const g = String(genre ?? '').trim();
  if (!g) return 'All';
  if ((EXPLORE_CATEGORY_CHIPS as readonly string[]).includes(g)) return g as ExploreCategoryChip;
  return 'All';
}
